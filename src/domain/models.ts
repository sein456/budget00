export type BudgetAccountId = 'personal' | 'multinet'
export type ThemePreference = 'system' | 'light' | 'dark'

export type LocalDate = `${number}-${number}-${number}`
export type LocalMonth = `${number}-${number}`

export interface BudgetAccount {
  readonly id: BudgetAccountId
  readonly name: string
  readonly currency: 'TRY'
}

export interface MonthlyPlan {
  readonly budgetAccountId: BudgetAccountId
  readonly month: LocalMonth
  readonly limitMinor: number
}

export interface Transaction {
  readonly id: string
  readonly budgetAccountId: BudgetAccountId
  readonly localDate: LocalDate
  readonly amountMinor: number
  readonly category?: string
  readonly note?: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface AppSettings {
  readonly id: 'app'
  readonly categories: readonly string[]
  readonly theme: ThemePreference
  readonly currency: 'TRY'
  readonly updatedAt: string
}
