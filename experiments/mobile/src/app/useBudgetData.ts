import { useCallback, useEffect, useState } from 'react'
import {
  exportBudgetData,
  parseBudgetBackup,
  resetBudgetData,
  restoreBudgetData,
} from '../db/backup'
import {
  deleteTransaction as deleteStoredTransaction,
  initializeBudgetData,
  loadBudgetData,
  saveAppSettings,
  saveMonthlyPlans,
  saveTransaction as saveStoredTransaction,
  type BudgetDataSnapshot,
} from '../db/repositories'
import { getLocalMonth } from '../domain/dateUtils'
import type {
  BudgetAccountId,
  LocalDate,
  ThemePreference,
  Transaction,
} from '../domain/models'

export interface TransactionDraft {
  readonly id?: string
  readonly budgetAccountId: BudgetAccountId
  readonly localDate: LocalDate
  readonly amountMinor: number
  readonly category: string
  readonly note?: string
}

export interface SettingsDraft {
  readonly personalLimitMinor: number
  readonly multinetLimitMinor: number
  readonly categories: readonly string[]
  readonly theme: ThemePreference
}

const createTransactionId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useBudgetData(referenceDate: LocalDate) {
  const [snapshot, setSnapshot] = useState<BudgetDataSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const currentMonth = getLocalMonth(referenceDate)

  const refresh = useCallback(async () => {
    const nextSnapshot = await loadBudgetData()
    setSnapshot(nextSnapshot)
  }, [])

  const reportFailure = (cause: unknown, fallback: string) => {
    const message = cause instanceof Error ? cause.message : fallback
    setError(message)
  }

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      try {
        await initializeBudgetData(currentMonth, undefined, {
          personal: 30_000 * 100,
          multinet: 6_000 * 100,
        })
        const initialSnapshot = await loadBudgetData()

        if (!cancelled) {
          setSnapshot(initialSnapshot)
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Veriler yüklenemedi')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void initialize()
    return () => {
      cancelled = true
    }
  }, [currentMonth])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timer = window.setTimeout(() => setNotice(null), 2_400)
    return () => window.clearTimeout(timer)
  }, [notice])

  const saveTransaction = useCallback(
    async (draft: TransactionDraft) => {
      const existing = draft.id
        ? snapshot?.transactions.find((item) => item.id === draft.id)
        : undefined
      const now = new Date().toISOString()
      const transaction: Transaction = {
        id: existing?.id ?? createTransactionId(),
        budgetAccountId: draft.budgetAccountId,
        localDate: draft.localDate,
        amountMinor: draft.amountMinor,
        category: draft.category.trim() || 'Diğer',
        note: draft.note?.trim() || undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }

      setError(null)
      try {
        await saveStoredTransaction(transaction)
        await refresh()
        setNotice(existing ? 'Harcama güncellendi' : 'Harcama eklendi')
      } catch (cause) {
        reportFailure(cause, 'İşlem kaydedilemedi')
        throw cause
      }
    },
    [refresh, snapshot?.transactions],
  )

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      setError(null)
      try {
        await deleteStoredTransaction(transactionId)
        await refresh()
        setNotice('Harcama silindi')
      } catch (cause) {
        reportFailure(cause, 'İşlem silinemedi')
        throw cause
      }
    },
    [refresh],
  )

  const saveSettings = useCallback(
    async (draft: SettingsDraft) => {
      if (!snapshot) {
        return
      }

      const now = new Date().toISOString()
      setError(null)

      try {
        await Promise.all([
          saveMonthlyPlans([
            {
              budgetAccountId: 'personal',
              month: currentMonth,
              limitMinor: draft.personalLimitMinor,
            },
            {
              budgetAccountId: 'multinet',
              month: currentMonth,
              limitMinor: draft.multinetLimitMinor,
            },
          ]),
          saveAppSettings({
            id: 'app',
            categories: [...draft.categories],
            theme: draft.theme,
            currency: 'TRY',
            updatedAt: now,
          }),
        ])
        await refresh()
        setNotice('Ayarlar kaydedildi')
      } catch (cause) {
        reportFailure(cause, 'Ayarlar kaydedilemedi')
        throw cause
      }
    },
    [currentMonth, refresh, snapshot],
  )

  const createBackup = useCallback(async () => {
    setError(null)
    try {
      const json = await exportBudgetData()
      setNotice('Yedek dosyası hazırlandı')
      return json
    } catch (cause) {
      reportFailure(cause, 'Yedek oluşturulamadı')
      throw cause
    }
  }, [])

  const importBackup = useCallback(
    async (json: string) => {
      setError(null)
      try {
        const backup = parseBudgetBackup(json)
        await restoreBudgetData(backup, currentMonth)
        await refresh()
        setNotice('Yedek başarıyla geri yüklendi')
      } catch (cause) {
        reportFailure(cause, 'Yedek içe aktarılamadı')
        throw cause
      }
    },
    [currentMonth, refresh],
  )

  const resetAllData = useCallback(async () => {
    setError(null)
    try {
      await resetBudgetData(currentMonth)
      await refresh()
      setNotice('Tüm veriler sıfırlandı')
    } catch (cause) {
      reportFailure(cause, 'Veriler sıfırlanamadı')
      throw cause
    }
  }, [currentMonth, refresh])

  return {
    snapshot,
    loading,
    error,
    notice,
    currentMonth,
    saveTransaction,
    deleteTransaction,
    saveSettings,
    createBackup,
    importBackup,
    resetAllData,
  }
}
