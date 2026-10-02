import { useState } from 'react'
import { createEmptyMonthlyPlan } from '../db/defaults'
import { getLocalMonth } from '../domain/dateUtils'
import type { LocalDate, LocalMonth, MonthlyPlan, Transaction } from '../domain/models'
import { AnalyticsScreen } from '../features/analytics/AnalyticsScreen'
import { HistoryScreen } from '../features/history/HistoryScreen'
import {
  BottomNavigation,
  type AppTab,
} from '../features/navigation/BottomNavigation'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import { TransactionSheet } from '../features/transactions/TransactionSheet'
import { PwaUpdatePrompt } from '../pwa/PwaUpdatePrompt'
import { useBudgetData } from './useBudgetData'
import { useTheme } from './useTheme'
import { useToday } from './useToday'
import './App.css'

interface EditorState {
  readonly defaultDate: LocalDate
  readonly transaction?: Transaction
  readonly preset?: Transaction
}

function findOrCreatePlan(
  plans: readonly MonthlyPlan[],
  accountId: MonthlyPlan['budgetAccountId'],
  month: LocalMonth,
): MonthlyPlan {
  return (
    plans.find((item) => item.budgetAccountId === accountId && item.month === month) ??
    createEmptyMonthlyPlan(accountId, month)
  )
}

export function App() {
  const today = useToday()
  const todayMonth = getLocalMonth(today)
  const [activeTab, setActiveTab] = useState<AppTab>('today')
  const [historyMonth, setHistoryMonth] = useState<LocalMonth>(todayMonth)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const {
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
  } = useBudgetData()

  useTheme(snapshot?.settings.theme)

  if (loading) {
    return (
      <main className="app-loading">
        <span className="loading-mark">₺</span>
        <p>Bütçen hazırlanıyor…</p>
      </main>
    )
  }

  if (!snapshot) {
    return (
      <main className="app-loading error-state">
        <span className="loading-mark">!</span>
        <h1>Veriler açılamadı</h1>
        <p>{error || 'IndexedDB başlatılamadı. Sayfayı yenileyip tekrar dene.'}</p>
      </main>
    )
  }

  const currentPlans = [
    findOrCreatePlan(snapshot.monthlyPlans, 'personal', todayMonth),
    findOrCreatePlan(snapshot.monthlyPlans, 'multinet', todayMonth),
  ]
  const personalPlan = findOrCreatePlan(snapshot.monthlyPlans, 'personal', currentMonth)
  const multinetPlan = findOrCreatePlan(snapshot.monthlyPlans, 'multinet', currentMonth)

  const removeWithConfirmation = async (transaction: Transaction) => {
    const accepted = window.confirm(
      `${transaction.category || 'Harcama'} işlemini silmek istediğine emin misin?`,
    )

    if (accepted) {
      await deleteTransaction(transaction.id)
    }
  }

  return (
    <div className="app-root">
      <main className="app-content">
        {activeTab === 'today' && (
          <TodayScreen
            today={today}
            plans={currentPlans}
            transactions={snapshot.transactions}
            onAddTransaction={() => setEditor({ defaultDate: today })}
            onRepeatTransaction={(preset) => setEditor({ defaultDate: today, preset })}
          />
        )}
        {activeTab === 'history' && (
          <HistoryScreen
            today={today}
            selectedMonth={historyMonth}
            onMonthChange={setHistoryMonth}
            plans={snapshot.monthlyPlans}
            transactions={snapshot.transactions}
            onEditTransaction={(transaction) =>
              setEditor({ defaultDate: transaction.localDate, transaction })
            }
            onDeleteTransaction={(transaction) => void removeWithConfirmation(transaction)}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsScreen
            today={today}
            plans={snapshot.monthlyPlans}
            transactions={snapshot.transactions}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsScreen
            currentMonth={currentMonth}
            personalPlan={personalPlan}
            multinetPlan={multinetPlan}
            settings={snapshot.settings}
            onSave={saveSettings}
            onExport={createBackup}
            onImport={importBackup}
            onReset={resetAllData}
          />
        )}
      </main>

      {error && <div className="toast-error" role="alert">{error}</div>}
      {notice && (
        <div className="toast-success" role="status">
          <span aria-hidden="true">✓</span>
          {notice}
        </div>
      )}

      <BottomNavigation activeTab={activeTab} onChange={(tab) => {
        setActiveTab(tab)
        window.scrollTo({ top: 0, behavior: 'instant' })
      }} />
      <PwaUpdatePrompt canUpdate={editor === null} />

      {editor && (
        <TransactionSheet
          key={editor.transaction?.id ?? `new-${editor.defaultDate}`}
          today={today}
          defaultDate={editor.defaultDate}
          settings={snapshot.settings}
          transaction={editor.transaction}
          preset={editor.preset}
          onClose={() => setEditor(null)}
          onSave={saveTransaction}
          onDelete={deleteTransaction}
        />
      )}
    </div>
  )
}
