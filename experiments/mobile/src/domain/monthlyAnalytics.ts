import { calculateMonthlyBudget } from './dailyBudgetCalculator'
import { getDayOfLocalMonth, getDaysInLocalMonth, getLocalMonth } from './dateUtils'
import type { LocalDate, MonthlyPlan, Transaction } from './models'

export interface CategorySpending {
  readonly category: string
  readonly amountMinor: number
  readonly sharePercent: number
}

export interface HighestSpendingDay {
  readonly localDate: LocalDate
  readonly amountMinor: number
}

export interface MonthlyAnalytics {
  readonly month: MonthlyPlan['month']
  readonly budgetAccountId: MonthlyPlan['budgetAccountId']
  readonly elapsedDayCount: number
  readonly daysInMonth: number
  readonly monthlyBudgetMinor: number
  readonly totalSpentMinor: number
  readonly remainingBudgetMinor: number
  readonly budgetUsagePercent: number
  readonly actualDailyAverageMinor: number
  readonly plannedDailyAverageMinor: number
  readonly budgetVarianceToDateMinor: number
  readonly projectedMonthEndSpendingMinor: number
  readonly projectedMonthEndBalanceMinor: number
  readonly overBudgetDayCount: number
  readonly highestSpendingDay: HighestSpendingDay | null
  readonly categorySpending: readonly CategorySpending[]
}

interface MonthlyAnalyticsInput {
  readonly plan: MonthlyPlan
  readonly transactions: readonly Transaction[]
  readonly asOfDate: LocalDate
}

const roundPercent = (value: number): number => Math.round(value * 10) / 10

function getElapsedDayCount(plan: MonthlyPlan, asOfDate: LocalDate): number {
  const asOfMonth = getLocalMonth(asOfDate)

  if (asOfMonth < plan.month) {
    return 0
  }

  if (asOfMonth > plan.month) {
    return getDaysInLocalMonth(plan.month)
  }

  return getDayOfLocalMonth(asOfDate)
}

export function calculateMonthlyAnalytics({
  plan,
  transactions,
  asOfDate,
}: MonthlyAnalyticsInput): MonthlyAnalytics {
  const ledger = calculateMonthlyBudget(plan, transactions)
  const elapsedDayCount = getElapsedDayCount(plan, asOfDate)
  const elapsedDays = ledger.days.slice(0, elapsedDayCount)
  const cutoffDate = elapsedDays.at(-1)?.localDate
  const realizedTransactions = transactions.filter(
    (transaction) =>
      transaction.budgetAccountId === plan.budgetAccountId &&
      getLocalMonth(transaction.localDate) === plan.month &&
      cutoffDate !== undefined &&
      transaction.localDate <= cutoffDate,
  )
  const totalSpentMinor = realizedTransactions.reduce(
    (sum, transaction) => sum + transaction.amountMinor,
    0,
  )
  const earnedBudgetToDateMinor = elapsedDays.reduce(
    (sum, day) => sum + day.baseEntitlementMinor,
    0,
  )
  const daysInMonth = ledger.days.length
  const actualDailyAverageMinor =
    elapsedDayCount > 0 ? Math.round(totalSpentMinor / elapsedDayCount) : 0
  const projectedMonthEndSpendingMinor = Math.round(
    actualDailyAverageMinor * daysInMonth,
  )
  const categoryTotals = new Map<string, number>()

  for (const transaction of realizedTransactions) {
    const category = transaction.category?.trim() || 'Diğer'
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + transaction.amountMinor)
  }

  const categorySpending = [...categoryTotals.entries()]
    .map(([category, amountMinor]) => ({
      category,
      amountMinor,
      sharePercent:
        totalSpentMinor > 0 ? roundPercent((amountMinor / totalSpentMinor) * 100) : 0,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor || a.category.localeCompare(b.category, 'tr'))
  const highestDay = elapsedDays.reduce<(typeof elapsedDays)[number] | null>(
    (highest, day) =>
      day.spentMinor > 0 && (!highest || day.spentMinor > highest.spentMinor) ? day : highest,
    null,
  )

  return {
    month: plan.month,
    budgetAccountId: plan.budgetAccountId,
    elapsedDayCount,
    daysInMonth,
    monthlyBudgetMinor: plan.limitMinor,
    totalSpentMinor,
    remainingBudgetMinor: plan.limitMinor - totalSpentMinor,
    budgetUsagePercent:
      plan.limitMinor > 0
        ? roundPercent((totalSpentMinor / plan.limitMinor) * 100)
        : totalSpentMinor > 0
          ? 100
          : 0,
    actualDailyAverageMinor,
    plannedDailyAverageMinor: Math.round(plan.limitMinor / daysInMonth),
    budgetVarianceToDateMinor: earnedBudgetToDateMinor - totalSpentMinor,
    projectedMonthEndSpendingMinor,
    projectedMonthEndBalanceMinor: plan.limitMinor - projectedMonthEndSpendingMinor,
    overBudgetDayCount: elapsedDays.filter((day) => day.closingBalanceMinor < 0).length,
    highestSpendingDay: highestDay
      ? { localDate: highestDay.localDate, amountMinor: highestDay.spentMinor }
      : null,
    categorySpending,
  }
}
