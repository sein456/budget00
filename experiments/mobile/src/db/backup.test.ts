import { describe, expect, it } from 'vitest'
import { BackupValidationError, createBudgetBackup, parseBudgetBackup } from './backup'
import type { AppSettings, MonthlyPlan, Transaction } from '../domain/models'

const plans: readonly MonthlyPlan[] = [
  { budgetAccountId: 'personal', month: '2026-08', limitMinor: 300_000 },
  { budgetAccountId: 'multinet', month: '2026-08', limitMinor: 60_000 },
]
const transactions: readonly Transaction[] = [
  {
    id: 'tx-1',
    budgetAccountId: 'personal',
    localDate: '2026-08-10',
    amountMinor: 1_250,
    category: 'Market',
    note: 'Test',
    createdAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-08-10T10:00:00.000Z',
  },
]
const settings: AppSettings = {
  id: 'app',
  categories: ['Market', 'Diğer'],
  theme: 'system',
  currency: 'TRY',
  updatedAt: '2026-08-19T12:00:00.000Z',
}

describe('JSON yedek doğrulama', () => {
  it('geçerli export verisini kayıpsız doğrular', () => {
    const backup = createBudgetBackup(
      plans,
      transactions,
      settings,
      '2026-08-19T12:00:00.000Z',
    )
    const parsed = parseBudgetBackup(JSON.stringify(backup))

    expect(parsed).toEqual(backup)
  })

  it('bozuk JSON dosyasını reddeder', () => {
    expect(() => parseBudgetBackup('{bozuk-json')).toThrow(BackupValidationError)
  })

  it('uyumsuz format sürümünü reddeder', () => {
    const backup = createBudgetBackup(plans, transactions, settings)

    expect(() =>
      parseBudgetBackup(JSON.stringify({ ...backup, version: 999 })),
    ).toThrow('uyumlu değil')
  })

  it('geçersiz işlem tutarı ve tarihi içeren veriyi reddeder', () => {
    const backup = createBudgetBackup(plans, transactions, settings)
    const invalid = {
      ...backup,
      data: {
        ...backup.data,
        transactions: [
          { ...transactions[0], amountMinor: -10, localDate: '2026-02-30' },
        ],
      },
    }

    expect(() => parseBudgetBackup(JSON.stringify(invalid))).toThrow(BackupValidationError)
  })

  it('tekrar eden plan ve işlem kimliklerini reddeder', () => {
    const backup = createBudgetBackup(plans, transactions, settings)
    const duplicatePlans = {
      ...backup,
      data: { ...backup.data, monthlyPlans: [plans[0], plans[0]] },
    }
    const duplicateTransactions = {
      ...backup,
      data: { ...backup.data, transactions: [transactions[0], transactions[0]] },
    }

    expect(() => parseBudgetBackup(JSON.stringify(duplicatePlans))).toThrow('tekrar eden')
    expect(() => parseBudgetBackup(JSON.stringify(duplicateTransactions))).toThrow(
      'tekrar eden',
    )
  })
})
