import Dexie, { type Table } from 'dexie'
import type {
  AppSettings,
  BudgetAccountId,
  LocalMonth,
  MonthlyPlan,
  Transaction,
} from '../domain/models'

export type MonthlyPlanKey = [BudgetAccountId, LocalMonth]

const V1_STORES = {
  monthlyPlans: '[budgetAccountId+month], budgetAccountId, month',
  transactions: 'id, [budgetAccountId+localDate], budgetAccountId, localDate',
  appSettings: 'id',
}

const V2_STORES = {
  ...V1_STORES,
  transactions:
    'id, [budgetAccountId+localDate], budgetAccountId, localDate, category',
}

type MutableTransaction = {
  -readonly [Property in keyof Transaction]: Transaction[Property]
}

export class BudgetDatabase extends Dexie {
  monthlyPlans!: Table<MonthlyPlan, MonthlyPlanKey>
  transactions!: Table<Transaction, string>
  appSettings!: Table<AppSettings, string>

  constructor(name = 'budget00') {
    super(name)

    this.version(1).stores(V1_STORES)
    this.version(2)
      .stores(V2_STORES)
      .upgrade(async (transaction) => {
        await transaction
          .table<Transaction>('transactions')
          .toCollection()
          .modify((item) => {
            const mutableItem = item as MutableTransaction

            if (!mutableItem.category?.trim()) {
              mutableItem.category = 'Diğer'
            }
          })
      })
  }
}

export const budgetDb = new BudgetDatabase()
