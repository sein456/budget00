import type { AppSettings, BudgetAccountId, LocalMonth, MonthlyPlan } from '../domain/models'

export const DEFAULT_CATEGORIES = [
  'Market',
  'Yeme & İçme',
  'Ulaşım',
  'Fatura',
  'Sağlık',
  'Eğlence',
  'Diğer',
] as const

export function createDefaultSettings(): AppSettings {
  return {
    id: 'app',
    categories: [...DEFAULT_CATEGORIES],
    theme: 'system',
    currency: 'TRY',
    updatedAt: new Date().toISOString(),
  }
}

export function createEmptyMonthlyPlan(
  budgetAccountId: BudgetAccountId,
  month: LocalMonth,
): MonthlyPlan {
  return {
    budgetAccountId,
    month,
    limitMinor: 0,
  }
}
