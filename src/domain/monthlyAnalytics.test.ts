import { describe, expect, it } from 'vitest'
import { calculateMonthlyAnalytics } from './monthlyAnalytics'
import type {
  BudgetAccountId,
  LocalDate,
  LocalMonth,
  MonthlyPlan,
  Transaction,
} from './models'

const plan = (
  budgetAccountId: BudgetAccountId = 'personal',
  limitMinor = 31_000,
): MonthlyPlan => ({
  budgetAccountId,
  month: '2026-08' as LocalMonth,
  limitMinor,
})

const expense = (
  id: string,
  amountMinor: number,
  localDate: LocalDate,
  budgetAccountId: BudgetAccountId = 'personal',
  category = 'Market',
): Transaction => ({
  id,
  amountMinor,
  localDate,
  budgetAccountId,
  category,
  createdAt: `${localDate}T10:00:00.000Z`,
  updatedAt: `${localDate}T10:00:00.000Z`,
})

describe('aylık analiz hesaplamaları', () => {
  it('ayın ilk gününde yalnızca ilk takvim gününü projection paydasına alır', () => {
    const analytics = calculateMonthlyAnalytics({
      plan: plan(),
      transactions: [expense('one', 800, '2026-08-01')],
      asOfDate: '2026-08-01',
    })

    expect(analytics.elapsedDayCount).toBe(1)
    expect(analytics.actualDailyAverageMinor).toBe(800)
    expect(analytics.projectedMonthEndSpendingMinor).toBe(24_800)
    expect(analytics.budgetVarianceToDateMinor).toBe(200)
  })

  it('ay ortasında gerçekleşen harcamayı geçen takvim günlerine böler', () => {
    const analytics = calculateMonthlyAnalytics({
      plan: plan(),
      transactions: [
        expense('one', 10_000, '2026-08-01'),
        expense('two', 5_000, '2026-08-15'),
      ],
      asOfDate: '2026-08-15',
    })

    expect(analytics.elapsedDayCount).toBe(15)
    expect(analytics.actualDailyAverageMinor).toBe(1_000)
    expect(analytics.projectedMonthEndSpendingMinor).toBe(31_000)
  })

  it('hiç harcama olmayan ay için sıfır metrik ve boş kategori döndürür', () => {
    const analytics = calculateMonthlyAnalytics({
      plan: plan(),
      transactions: [],
      asOfDate: '2026-08-10',
    })

    expect(analytics.totalSpentMinor).toBe(0)
    expect(analytics.budgetUsagePercent).toBe(0)
    expect(analytics.projectedMonthEndSpendingMinor).toBe(0)
    expect(analytics.highestSpendingDay).toBeNull()
    expect(analytics.categorySpending).toEqual([])
  })

  it('bütçe altında giden ayda pozitif sapma ve tahmini fazla üretir', () => {
    const analytics = calculateMonthlyAnalytics({
      plan: plan(),
      transactions: [expense('one', 5_000, '2026-08-10')],
      asOfDate: '2026-08-10',
    })

    expect(analytics.budgetVarianceToDateMinor).toBe(5_000)
    expect(analytics.projectedMonthEndBalanceMinor).toBe(15_500)
    expect(analytics.overBudgetDayCount).toBe(0)
  })

  it('bütçe üstünde giden ayda negatif sapma ve tahmini aşım üretir', () => {
    const analytics = calculateMonthlyAnalytics({
      plan: plan(),
      transactions: [expense('one', 20_000, '2026-08-10')],
      asOfDate: '2026-08-10',
    })

    expect(analytics.budgetVarianceToDateMinor).toBe(-10_000)
    expect(analytics.projectedMonthEndBalanceMinor).toBe(-31_000)
    expect(analytics.overBudgetDayCount).toBeGreaterThan(0)
  })

  it('gelecekteki boş günleri projection ortalamasına dahil etmez', () => {
    const analytics = calculateMonthlyAnalytics({
      plan: plan(),
      transactions: [expense('one', 7_000, '2026-08-07')],
      asOfDate: '2026-08-07',
    })

    expect(analytics.actualDailyAverageMinor).toBe(1_000)
    expect(analytics.projectedMonthEndSpendingMinor).toBe(31_000)
    expect(analytics.elapsedDayCount).toBe(7)
  })

  it('Kişisel ve Multinet işlemlerini tamamen izole eder', () => {
    const transactions = [
      expense('personal', 3_000, '2026-08-03', 'personal', 'Market'),
      expense('multinet', 9_000, '2026-08-03', 'multinet', 'Yemek'),
    ]
    const personal = calculateMonthlyAnalytics({
      plan: plan('personal'),
      transactions,
      asOfDate: '2026-08-03',
    })
    const multinet = calculateMonthlyAnalytics({
      plan: plan('multinet', 62_000),
      transactions,
      asOfDate: '2026-08-03',
    })

    expect(personal.totalSpentMinor).toBe(3_000)
    expect(personal.categorySpending).toEqual([
      { category: 'Market', amountMinor: 3_000, sharePercent: 100 },
    ])
    expect(multinet.totalSpentMinor).toBe(9_000)
    expect(multinet.categorySpending[0]?.category).toBe('Yemek')
  })
})
