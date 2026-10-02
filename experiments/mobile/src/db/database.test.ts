import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { BudgetDatabase } from './database'
import {
  deleteTransaction,
  initializeBudgetData,
  loadBudgetData,
  saveAppSettings,
  saveMonthlyPlans,
  saveTransaction,
} from './repositories'
import type { AppSettings, LocalMonth, Transaction } from '../domain/models'

const uniqueDatabaseName = (label: string) =>
  `budget00-test-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const transaction: Transaction = {
  id: 'tx-1',
  budgetAccountId: 'personal',
  localDate: '2026-08-10',
  amountMinor: 12_550,
  category: 'Market',
  note: 'Haftalık alışveriş',
  createdAt: '2026-08-10T08:00:00.000Z',
  updatedAt: '2026-08-10T08:00:00.000Z',
}

describe('BudgetDatabase kalıcılığı ve CRUD', () => {
  it('varsayılan ayarları ve iki aylık planı oluşturur', async () => {
    const database = new BudgetDatabase(uniqueDatabaseName('defaults'))

    try {
      await initializeBudgetData('2026-08' as LocalMonth, database)
      const snapshot = await loadBudgetData(database)

      expect(snapshot.settings).toMatchObject({
        id: 'app',
        currency: 'TRY',
        theme: 'system',
      })
      expect(snapshot.settings.categories).toContain('Diğer')
      expect(snapshot.monthlyPlans).toEqual(
        expect.arrayContaining([
          { budgetAccountId: 'personal', month: '2026-08', limitMinor: 0 },
          { budgetAccountId: 'multinet', month: '2026-08', limitMinor: 0 },
        ]),
      )
    } finally {
      database.close()
      await database.delete()
    }
  })

  it('plan, ayar ve işlemleri veritabanı kapanıp açıldıktan sonra korur', async () => {
    const name = uniqueDatabaseName('persistence')
    const firstConnection = new BudgetDatabase(name)

    await initializeBudgetData('2026-08' as LocalMonth, firstConnection)
    await saveMonthlyPlans(
      [
        { budgetAccountId: 'personal', month: '2026-08', limitMinor: 300_000 },
        { budgetAccountId: 'multinet', month: '2026-08', limitMinor: 90_000 },
      ],
      firstConnection,
    )
    await saveTransaction(transaction, firstConnection)
    firstConnection.close()

    const reopened = new BudgetDatabase(name)

    try {
      const snapshot = await loadBudgetData(reopened)

      expect(snapshot.monthlyPlans).toEqual(
        expect.arrayContaining([
          { budgetAccountId: 'personal', month: '2026-08', limitMinor: 300_000 },
          { budgetAccountId: 'multinet', month: '2026-08', limitMinor: 90_000 },
        ]),
      )
      expect(snapshot.transactions).toContainEqual(transaction)
    } finally {
      reopened.close()
      await reopened.delete()
    }
  })

  it('transaction create, update ve delete işlemlerini uygular', async () => {
    const database = new BudgetDatabase(uniqueDatabaseName('transaction-crud'))

    try {
      await saveTransaction(transaction, database)
      expect(await database.transactions.get(transaction.id)).toEqual(transaction)

      const updated: Transaction = {
        ...transaction,
        amountMinor: 18_000,
        category: 'Yeme & İçme',
        localDate: '2026-08-05',
        updatedAt: '2026-08-11T10:00:00.000Z',
      }
      await saveTransaction(updated, database)
      expect(await database.transactions.get(transaction.id)).toEqual(updated)

      await deleteTransaction(transaction.id, database)
      expect(await database.transactions.get(transaction.id)).toBeUndefined()
    } finally {
      database.close()
      await database.delete()
    }
  })

  it('AppSettings kaydını günceller', async () => {
    const database = new BudgetDatabase(uniqueDatabaseName('settings'))
    const settings: AppSettings = {
      id: 'app',
      categories: ['Market', 'Kahve'],
      theme: 'dark',
      currency: 'TRY',
      updatedAt: '2026-08-19T12:00:00.000Z',
    }

    try {
      await saveAppSettings(settings, database)
      expect(await database.appSettings.get('app')).toEqual(settings)
    } finally {
      database.close()
      await database.delete()
    }
  })

  it('version 1 işlemlerini version 2 şemasına taşırken kategori ekler', async () => {
    const name = uniqueDatabaseName('migration')
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      monthlyPlans: '[budgetAccountId+month], budgetAccountId, month',
      transactions: 'id, [budgetAccountId+localDate], budgetAccountId, localDate',
      appSettings: 'id',
    })
    await legacy.open()
    await legacy.table('transactions').add({
      ...transaction,
      category: undefined,
    })
    legacy.close()

    const upgraded = new BudgetDatabase(name)

    try {
      await upgraded.open()
      expect(await upgraded.transactions.get(transaction.id)).toMatchObject({
        id: transaction.id,
        category: 'Diğer',
      })
      expect(upgraded.verno).toBe(2)
    } finally {
      upgraded.close()
      await upgraded.delete()
    }
  })
})
