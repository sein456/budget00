import {
  getDaysInLocalMonth,
  getLocalMonth,
  listLocalDatesInMonth,
} from './dateUtils'
import type {
  BudgetAccountId,
  LocalDate,
  MonthlyPlan,
  Transaction,
} from './models'

export interface DailyBudgetBalance {
  readonly budgetAccountId: BudgetAccountId
  readonly localDate: LocalDate
  readonly dayNumber: number
  readonly baseEntitlementMinor: number
  readonly carryInMinor: number
  readonly availableMinor: number
  readonly spentMinor: number
  readonly closingBalanceMinor: number
}

export interface MonthlyBudgetLedger {
  readonly budgetAccountId: BudgetAccountId
  readonly month: MonthlyPlan['month']
  readonly limitMinor: number
  readonly totalSpentMinor: number
  readonly closingBalanceMinor: number
  readonly days: readonly DailyBudgetBalance[]
}

function assertMinorAmount(value: number, label: string, allowZero: boolean): void {
  const lowerBoundIsValid = allowZero ? value >= 0 : value > 0

  if (!Number.isSafeInteger(value) || !lowerBoundIsValid) {
    throw new RangeError(`${label} güvenli bir tam sayı kuruş değeri olmalıdır`)
  }
}

export function distributeMonthlyLimit(
  limitMinor: number,
  daysInMonth: number,
): readonly number[] {
  assertMinorAmount(limitMinor, 'Aylık limit', true)

  if (!Number.isInteger(daysInMonth) || daysInMonth < 1 || daysInMonth > 31) {
    throw new RangeError('Ayın gün sayısı 1 ile 31 arasında olmalıdır')
  }

  const dailyFloor = Math.floor(limitMinor / daysInMonth)
  const remainder = limitMinor % daysInMonth

  return Array.from(
    { length: daysInMonth },
    (_, index) => dailyFloor + (index < remainder ? 1 : 0),
  )
}

export function calculateMonthlyBudget(
  plan: MonthlyPlan,
  transactions: readonly Transaction[],
): MonthlyBudgetLedger {
  assertMinorAmount(plan.limitMinor, 'Aylık limit', true)

  const dates = listLocalDatesInMonth(plan.month)
  const entitlements = distributeMonthlyLimit(
    plan.limitMinor,
    getDaysInLocalMonth(plan.month),
  )
  const spendingByDate = new Map<LocalDate, number>()

  for (const transaction of transactions) {
    if (transaction.budgetAccountId !== plan.budgetAccountId) {
      continue
    }

    if (getLocalMonth(transaction.localDate) !== plan.month) {
      continue
    }

    assertMinorAmount(transaction.amountMinor, 'İşlem tutarı', false)

    const nextTotal =
      (spendingByDate.get(transaction.localDate) ?? 0) + transaction.amountMinor
    assertMinorAmount(nextTotal, 'Günlük harcama toplamı', true)
    spendingByDate.set(transaction.localDate, nextTotal)
  }

  let carryInMinor = 0
  let totalSpentMinor = 0

  const days = dates.map<DailyBudgetBalance>((localDate, index) => {
    const baseEntitlementMinor = entitlements[index]
    const spentMinor = spendingByDate.get(localDate) ?? 0
    const availableMinor = baseEntitlementMinor + carryInMinor
    const closingBalanceMinor = availableMinor - spentMinor

    totalSpentMinor += spentMinor

    const balance: DailyBudgetBalance = {
      budgetAccountId: plan.budgetAccountId,
      localDate,
      dayNumber: index + 1,
      baseEntitlementMinor,
      carryInMinor,
      availableMinor,
      spentMinor,
      closingBalanceMinor,
    }

    carryInMinor = closingBalanceMinor
    return balance
  })

  return {
    budgetAccountId: plan.budgetAccountId,
    month: plan.month,
    limitMinor: plan.limitMinor,
    totalSpentMinor,
    closingBalanceMinor: days.at(-1)?.closingBalanceMinor ?? 0,
    days,
  }
}

export function getBudgetBalanceForDate(
  ledger: MonthlyBudgetLedger,
  localDate: LocalDate,
): DailyBudgetBalance {
  if (getLocalMonth(localDate) !== ledger.month) {
    throw new RangeError(`${localDate} tarihi ${ledger.month} bütçe ayında değil`)
  }

  const balance = ledger.days.find((day) => day.localDate === localDate)

  if (!balance) {
    throw new RangeError(`${localDate} için günlük bakiye bulunamadı`)
  }

  return balance
}
