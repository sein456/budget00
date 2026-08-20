import { describe, expect, it } from 'vitest'
import type { BudgetAccountId, LocalDate, LocalMonth, Transaction } from './models'
import {
  calculateMonthlyBudget,
  distributeMonthlyLimit,
  getBudgetBalanceForDate,
} from './dailyBudgetCalculator'

const createTransaction = (
  id: string,
  budgetAccountId: BudgetAccountId,
  localDate: LocalDate,
  amountMinor: number,
): Transaction => ({
  id,
  budgetAccountId,
  localDate,
  amountMinor,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
})

describe('günlük bütçe dağıtımı', () => {
  it.each([
    ['2025-02', 28],
    ['2024-02', 29],
    ['2025-04', 30],
    ['2025-01', 31],
  ] as const)('%s için aylık limitin tamamını %i güne dağıtır', (month, days) => {
    const limitMinor = days * 100 + 7
    const ledger = calculateMonthlyBudget(
      { budgetAccountId: 'personal', month: month as LocalMonth, limitMinor },
      [],
    )

    expect(ledger.days).toHaveLength(days)
    expect(ledger.days.reduce((sum, day) => sum + day.baseEntitlementMinor, 0)).toBe(
      limitMinor,
    )
    expect(ledger.days.slice(0, 7).every((day) => day.baseEntitlementMinor === 101)).toBe(
      true,
    )
    expect(ledger.days.slice(7).every((day) => day.baseEntitlementMinor === 100)).toBe(
      true,
    )
  })

  it('artık kuruşları deterministik olarak ilk günlere dağıtır', () => {
    const distribution = distributeMonthlyLimit(1_000, 28)

    expect(distribution.reduce((sum, amount) => sum + amount, 0)).toBe(1_000)
    expect(Math.max(...distribution) - Math.min(...distribution)).toBe(1)
  })
})

describe('carry-forward bütçe motoru', () => {
  const augustPlan = {
    budgetAccountId: 'personal' as const,
    month: '2026-08' as LocalMonth,
    limitMinor: 3_100,
  }

  it('kullanılmayan hakkı pozitif carry-forward olarak ertesi güne taşır', () => {
    const ledger = calculateMonthlyBudget(augustPlan, [])

    expect(ledger.days[0]).toMatchObject({
      baseEntitlementMinor: 100,
      carryInMinor: 0,
      closingBalanceMinor: 100,
    })
    expect(ledger.days[1]).toMatchObject({
      carryInMinor: 100,
      availableMinor: 200,
      closingBalanceMinor: 200,
    })
  })

  it('aşımı negatif carry-forward olarak ertesi günün hakkından düşer', () => {
    const ledger = calculateMonthlyBudget(augustPlan, [
      createTransaction('expense-1', 'personal', '2026-08-01', 175),
    ])

    expect(ledger.days[0].closingBalanceMinor).toBe(-75)
    expect(ledger.days[1]).toMatchObject({
      carryInMinor: -75,
      availableMinor: 25,
    })
  })

  it('aynı gündeki birden fazla işlemi toplar', () => {
    const ledger = calculateMonthlyBudget(augustPlan, [
      createTransaction('expense-1', 'personal', '2026-08-01', 40),
      createTransaction('expense-2', 'personal', '2026-08-01', 35),
    ])

    expect(ledger.days[0].spentMinor).toBe(75)
    expect(ledger.totalSpentMinor).toBe(75)
  })

  it('geçmiş işlem değiştiğinde o günden sonraki tüm bakiyeleri yeniden hesaplar', () => {
    const original = calculateMonthlyBudget(augustPlan, [
      createTransaction('expense-1', 'personal', '2026-08-02', 50),
    ])
    const edited = calculateMonthlyBudget(augustPlan, [
      createTransaction('expense-1', 'personal', '2026-08-02', 180),
    ])

    expect(edited.days[0]).toEqual(original.days[0])
    expect(edited.days[1].closingBalanceMinor).toBe(
      original.days[1].closingBalanceMinor - 130,
    )

    for (let index = 2; index < edited.days.length; index += 1) {
      expect(edited.days[index].carryInMinor).toBe(
        original.days[index].carryInMinor - 130,
      )
      expect(edited.days[index].closingBalanceMinor).toBe(
        original.days[index].closingBalanceMinor - 130,
      )
    }
  })

  it('Kişisel ve Multinet hesaplarını tamamen ayrı hesaplar', () => {
    const transactions = [
      createTransaction('personal-expense', 'personal', '2026-08-01', 80),
      createTransaction('multinet-expense', 'multinet', '2026-08-01', 250),
    ]
    const personal = calculateMonthlyBudget(augustPlan, transactions)
    const multinet = calculateMonthlyBudget(
      {
        budgetAccountId: 'multinet',
        month: '2026-08',
        limitMinor: 6_200,
      },
      transactions,
    )

    expect(personal.totalSpentMinor).toBe(80)
    expect(personal.days[0].closingBalanceMinor).toBe(20)
    expect(multinet.totalSpentMinor).toBe(250)
    expect(multinet.days[0].closingBalanceMinor).toBe(-50)
  })

  it('istenen günün bakiyesini döndürür', () => {
    const ledger = calculateMonthlyBudget(augustPlan, [])

    expect(getBudgetBalanceForDate(ledger, '2026-08-19')).toBe(ledger.days[18])
  })

  it('geçersiz para değerlerini reddeder', () => {
    expect(() =>
      calculateMonthlyBudget({ ...augustPlan, limitMinor: 10.5 }, []),
    ).toThrow(RangeError)
    expect(() =>
      calculateMonthlyBudget(augustPlan, [
        createTransaction('invalid', 'personal', '2026-08-01', 0),
      ]),
    ).toThrow(RangeError)
  })
})
