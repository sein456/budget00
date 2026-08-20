import type { BudgetDatabase } from './database'
import { budgetDb } from './database'
import { createDefaultSettings, createEmptyMonthlyPlan } from './defaults'
import type {
  AppSettings,
  BudgetAccountId,
  LocalMonth,
  MonthlyPlan,
  Transaction,
} from '../domain/models'

export interface BudgetDataSnapshot {
  readonly monthlyPlans: readonly MonthlyPlan[]
  readonly transactions: readonly Transaction[]
  readonly settings: AppSettings
}

export async function initializeBudgetData(
  month: LocalMonth,
  database: BudgetDatabase = budgetDb,
): Promise<void> {
  await database.transaction(
    'rw',
    database.monthlyPlans,
    database.appSettings,
    async () => {
      const settings = await database.appSettings.get('app')

      if (!settings) {
        await database.appSettings.add(createDefaultSettings())
      }

      for (const accountId of ['personal', 'multinet'] as const) {
        const key: [BudgetAccountId, LocalMonth] = [accountId, month]
        const plan = await database.monthlyPlans.get(key)

        if (!plan) {
          await database.monthlyPlans.add(createEmptyMonthlyPlan(accountId, month))
        }
      }
    },
  )
}

export async function loadBudgetData(
  database: BudgetDatabase = budgetDb,
): Promise<BudgetDataSnapshot> {
  const [monthlyPlans, transactions, storedSettings] = await Promise.all([
    database.monthlyPlans.toArray(),
    database.transactions.toArray(),
    database.appSettings.get('app'),
  ])
  const settings = storedSettings ?? createDefaultSettings()

  return { monthlyPlans, transactions, settings }
}

export async function saveMonthlyPlans(
  plans: readonly MonthlyPlan[],
  database: BudgetDatabase = budgetDb,
): Promise<void> {
  await database.monthlyPlans.bulkPut([...plans])
}

export async function saveAppSettings(
  settings: AppSettings,
  database: BudgetDatabase = budgetDb,
): Promise<void> {
  await database.appSettings.put(settings)
}

export async function saveTransaction(
  transaction: Transaction,
  database: BudgetDatabase = budgetDb,
): Promise<void> {
  await database.transactions.put(transaction)
}

export async function deleteTransaction(
  transactionId: string,
  database: BudgetDatabase = budgetDb,
): Promise<void> {
  await database.transactions.delete(transactionId)
}
