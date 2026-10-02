import { useState } from 'react'
import { formatHistoryDate, formatMonth } from '../../domain/displayDate'
import { getLocalMonth } from '../../domain/dateUtils'
import { formatMoney } from '../../domain/money'
import { calculateMonthlyAnalytics } from '../../domain/monthlyAnalytics'
import { CategoryDistribution } from './CategoryDistribution'
import type {
  BudgetAccountId,
  LocalDate,
  LocalMonth,
  MonthlyPlan,
  Transaction,
} from '../../domain/models'

interface AnalyticsScreenProps {
  readonly today: LocalDate
  readonly plans: readonly MonthlyPlan[]
  readonly transactions: readonly Transaction[]
}

const formatPercent = (value: number): string =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)

export function AnalyticsScreen({ today, plans, transactions }: AnalyticsScreenProps) {
  const currentMonth = getLocalMonth(today)
  const [selectedMonth, setSelectedMonth] = useState<LocalMonth>(currentMonth)
  const [accountId, setAccountId] = useState<BudgetAccountId>('personal')
  const plan = plans.find(
    (item) => item.month === selectedMonth && item.budgetAccountId === accountId,
  ) ?? {
    budgetAccountId: accountId,
    month: selectedMonth,
    limitMinor: 0,
  }
  const analytics = calculateMonthlyAnalytics({ plan, transactions, asOfDate: today })
  const progressWidth = Math.min(Math.max(analytics.budgetUsagePercent, 0), 100)
  const varianceIsHealthy = analytics.budgetVarianceToDateMinor >= 0
  const projectionIsHealthy = analytics.projectedMonthEndBalanceMinor >= 0

  return (
    <div className="screen secondary-screen analytics-screen">
      <header className="screen-header compact">
        <div>
          <p className="eyebrow">Harcama görünümü</p>
          <h1>Analiz</h1>
        </div>
        <label className="month-picker">
          <span className="sr-only">Analiz ayı seç</span>
          <input
            type="month"
            value={selectedMonth}
            max={currentMonth}
            onChange={(event) => {
              if (event.target.value) {
                setSelectedMonth(event.target.value as LocalMonth)
              }
            }}
          />
        </label>
      </header>

      <div className="segmented-control" aria-label="Analiz bütçe türü">
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

      <section className="analysis-overview" aria-labelledby="analysis-month">
        <div className="analysis-title-row">
          <div>
            <span id="analysis-month">{formatMonth(selectedMonth)}</span>
            <strong>{formatMoney(analytics.totalSpentMinor)}</strong>
            <small>Toplam harcama</small>
          </div>
          <div className="usage-percent">
            <strong>%{formatPercent(analytics.budgetUsagePercent)}</strong>
            <span>kullanıldı</span>
          </div>
        </div>
        <div
          className="budget-progress"
          role="progressbar"
          aria-label="Bütçe kullanım oranı"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(analytics.budgetUsagePercent, 100))}
        >
          <span
            className={analytics.budgetUsagePercent > 100 ? 'over' : ''}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <div className="budget-labels">
          <span>Bütçe {formatMoney(analytics.monthlyBudgetMinor)}</span>
          <span className={analytics.remainingBudgetMinor < 0 ? 'negative-text' : ''}>
            Kalan {formatMoney(analytics.remainingBudgetMinor)}
          </span>
        </div>
      </section>

      <section className="analysis-metric-grid" aria-label="Analiz metrikleri">
        <article className="analysis-metric-card">
          <span>Gerçek günlük ortalama</span>
          <strong>{formatMoney(analytics.actualDailyAverageMinor)}</strong>
          <small>Geçen {analytics.elapsedDayCount} takvim günü</small>
        </article>
        <article className="analysis-metric-card">
          <span>Planlanan günlük ortalama</span>
          <strong>{formatMoney(analytics.plannedDailyAverageMinor)}</strong>
          <small>{analytics.daysInMonth} günlük plan</small>
        </article>
        <article className={`analysis-metric-card status ${varianceIsHealthy ? 'healthy' : 'over'}`}>
          <span>Bugüne kadarki sapma</span>
          <strong>{formatMoney(analytics.budgetVarianceToDateMinor, { signed: true })}</strong>
          <small>{varianceIsHealthy ? 'Planın altında' : 'Planın üzerinde'}</small>
        </article>
        <article className="analysis-metric-card">
          <span>Bütçe aşılan gün</span>
          <strong>{analytics.overBudgetDayCount}</strong>
          <small>Negatif gün sonu bakiyesi</small>
        </article>
      </section>

      <section className={`projection-card ${projectionIsHealthy ? 'healthy' : 'over'}`}>
        <div className="projection-heading">
          <span>Ay sonu tahmini</span>
          <small>Yalnızca geçen günlerin harcama hızına göre</small>
        </div>
        {selectedMonth === currentMonth && analytics.elapsedDayCount < 7 && <p className="forecast-caveat">
          Ön tahmin · {analytics.elapsedDayCount} günlük veri. İlk hafta, tek seferlik harcamalar tahmini çok değiştirebilir.
        </p>}
        <strong>{analytics.totalSpentMinor > 0 ? formatMoney(analytics.projectedMonthEndSpendingMinor) : 'Henüz tahmin yok'}</strong>
        {analytics.totalSpentMinor > 0 && <div className="projection-balance">
          <span>{projectionIsHealthy ? 'Tahmini bütçe fazlası' : 'Tahmini bütçe aşımı'}</span>
          <b>{formatMoney(Math.abs(analytics.projectedMonthEndBalanceMinor))}</b>
        </div>}
      </section>

      <section className="highest-day-card">
        <div>
          <span>En yüksek harcama yapılan gün</span>
          <strong>
            {analytics.highestSpendingDay
              ? formatHistoryDate(analytics.highestSpendingDay.localDate)
              : 'Henüz harcama yok'}
          </strong>
        </div>
        <b>
          {formatMoney(analytics.highestSpendingDay?.amountMinor ?? 0)}
        </b>
      </section>

      <CategoryDistribution key={`${selectedMonth}-${accountId}`} rows={analytics.categorySpending}
        monthLabel={formatMonth(selectedMonth)} accountLabel={accountId === 'personal' ? 'Kişisel' : 'Multinet'} />
    </div>
  )
}
