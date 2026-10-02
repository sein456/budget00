import { useEffect, useMemo, useState } from 'react'
import { calculateMonthlyBudget } from '../../domain/dailyBudgetCalculator'
import { formatHistoryDate, formatMonth } from '../../domain/displayDate'
import { getDayOfLocalMonth, getLocalMonth } from '../../domain/dateUtils'
import { formatMoney } from '../../domain/money'
import { ActionIcon } from '../ActionIcon'
import type {
  BudgetAccountId,
  LocalDate,
  LocalMonth,
  MonthlyPlan,
  Transaction,
} from '../../domain/models'

interface HistoryScreenProps {
  readonly today: LocalDate
  readonly selectedMonth: LocalMonth
  readonly onMonthChange: (month: LocalMonth) => void
  readonly plans: readonly MonthlyPlan[]
  readonly transactions: readonly Transaction[]
  readonly onEditTransaction: (transaction: Transaction) => void
  readonly onDeleteTransaction: (transaction: Transaction) => void
}

export function HistoryScreen({
  today,
  selectedMonth,
  onMonthChange,
  plans,
  transactions,
  onEditTransaction,
  onDeleteTransaction,
}: HistoryScreenProps) {
  const [accountId, setAccountId] = useState<BudgetAccountId>('personal')
  const [expandedDate, setExpandedDate] = useState<LocalDate | null>(null)
  const currentMonth = getLocalMonth(today)

  useEffect(() => {
    setExpandedDate(null)
  }, [accountId, selectedMonth])

  const plan = plans.find(
    (item) => item.month === selectedMonth && item.budgetAccountId === accountId,
  ) ?? {
    budgetAccountId: accountId,
    month: selectedMonth,
    limitMinor: 0,
  }
  const ledger = calculateMonthlyBudget(plan, transactions)
  const visibleDayCount =
    selectedMonth === currentMonth
      ? getDayOfLocalMonth(today)
      : selectedMonth < currentMonth
        ? ledger.days.length
        : 0
  const visibleDays = ledger.days.slice(0, visibleDayCount).reverse()

  const transactionsByDate = useMemo(() => {
    const result = new Map<LocalDate, Transaction[]>()

    for (const transaction of transactions) {
      if (
        transaction.budgetAccountId !== accountId ||
        getLocalMonth(transaction.localDate) !== selectedMonth
      ) {
        continue
      }

      const dayTransactions = result.get(transaction.localDate) ?? []
      dayTransactions.push(transaction)
      result.set(transaction.localDate, dayTransactions)
    }

    for (const dayTransactions of result.values()) {
      dayTransactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }

    return result
  }, [accountId, selectedMonth, transactions])

  return (
    <div className="screen secondary-screen">
      <header className="screen-header compact">
        <div>
          <p className="eyebrow">Günlük akış</p>
          <h1>Geçmiş</h1>
        </div>
        <label className="month-picker">
          <span className="sr-only">Ay seç</span>
          <input
            type="month"
            value={selectedMonth}
            max={currentMonth}
            onChange={(event) => onMonthChange(event.target.value as LocalMonth)}
          />
        </label>
      </header>

      <div className="segmented-control" aria-label="Bütçe türü">
        <button
          type="button"
          className={accountId === 'personal' ? 'active' : ''}
          onClick={() => setAccountId('personal')}
        >
          Kişisel
        </button>
        <button
          type="button"
          className={accountId === 'multinet' ? 'active' : ''}
          onClick={() => setAccountId('multinet')}
        >
          Multinet
        </button>
      </div>

      <div className="history-summary">
        <span>{formatMonth(selectedMonth)}</span>
        <strong>{formatMoney(ledger.totalSpentMinor)}</strong>
        <small>Toplam harcama</small>
      </div>

      <section className="day-list" aria-label="Günlük bütçe geçmişi">
        {visibleDays.length === 0 && (
          <div className="empty-state">
            <p>Bu ay için gösterilecek gün bulunmuyor.</p>
          </div>
        )}

        {visibleDays.map((day) => {
          const dayTransactions = transactionsByDate.get(day.localDate) ?? []
          const isExpanded = expandedDate === day.localDate
          const isOver = day.closingBalanceMinor < 0

          return (
            <article className={`day-card ${isExpanded ? 'expanded' : ''}`} key={day.localDate}>
              <button
                className="day-card-summary"
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedDate(isExpanded ? null : day.localDate)}
              >
                <div className="day-date">
                  <strong>{formatHistoryDate(day.localDate)}</strong>
                  <span>{dayTransactions.length} işlem</span>
                  {isOver && <span className="over-budget-badge">Limit aşıldı</span>}
                </div>
                <div className="day-amounts">
                  <strong>{formatMoney(day.spentMinor)}</strong>
                  <span className={isOver ? 'negative-text' : 'positive-text'}>
                    Gün sonu {formatMoney(day.closingBalanceMinor)}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="day-details">
                  <dl className="detail-totals">
                    <div>
                      <dt>Gün başı kullanılabilir</dt>
                      <dd>{formatMoney(day.availableMinor)}</dd>
                    </div>
                    <div>
                      <dt>Toplam harcama</dt>
                      <dd>{formatMoney(day.spentMinor)}</dd>
                    </div>
                    <div>
                      <dt>Gün sonu bakiye</dt>
                      <dd className={isOver ? 'negative-text' : 'positive-text'}>
                        {formatMoney(day.closingBalanceMinor)}
                      </dd>
                    </div>
                  </dl>

                  <div className="transaction-list">
                    {dayTransactions.length === 0 ? (
                      <p className="no-transactions">Bu gün için harcama yok.</p>
                    ) : (
                      dayTransactions.map((transaction) => (
                        <div className="transaction-row" key={transaction.id}>
                          <button
                            className="transaction-main"
                            type="button"
                            onClick={() => onEditTransaction(transaction)}
                          >
                            <span>
                              <b>{transaction.category || 'Diğer'}</b>
                              <small>{transaction.note || 'Not yok'}</small>
                            </span>
                            <strong>{formatMoney(transaction.amountMinor)}</strong>
                          </button>
                          <button
                            className="icon-action danger"
                            type="button"
                            aria-label="İşlemi sil"
                            onClick={() => onDeleteTransaction(transaction)}
                          >
                            <ActionIcon kind="delete" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </section>
    </div>
  )
}
