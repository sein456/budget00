import { calculateMonthlyBudget, getBudgetBalanceForDate } from '../../domain/dailyBudgetCalculator'
import { formatFullDate } from '../../domain/displayDate'
import { formatMoney } from '../../domain/money'
import type { LocalDate, MonthlyPlan, Transaction } from '../../domain/models'

interface TodayScreenProps {
  readonly today: LocalDate
  readonly plans: readonly MonthlyPlan[]
  readonly transactions: readonly Transaction[]
  readonly onAddTransaction: () => void
}

function findPlan(plans: readonly MonthlyPlan[], accountId: MonthlyPlan['budgetAccountId']) {
  const plan = plans.find((item) => item.budgetAccountId === accountId)

  if (!plan) {
    throw new Error(`${accountId} bütçe planı bulunamadı`)
  }

  return plan
}

export function TodayScreen({
  today,
  plans,
  transactions,
  onAddTransaction,
}: TodayScreenProps) {
  const personalPlan = findPlan(plans, 'personal')
  const multinetPlan = findPlan(plans, 'multinet')
  const personalLedger = calculateMonthlyBudget(personalPlan, transactions)
  const multinetLedger = calculateMonthlyBudget(multinetPlan, transactions)
  const personalToday = getBudgetBalanceForDate(personalLedger, today)
  const multinetToday = getBudgetBalanceForDate(multinetLedger, today)
  const personalRemaining = personalPlan.limitMinor - personalLedger.totalSpentMinor
  const multinetRemaining = multinetPlan.limitMinor - multinetLedger.totalSpentMinor
  const remainingDayCount = personalLedger.days.length - personalToday.dayNumber + 1
  const safeDailyAverage = Math.floor(personalRemaining / remainingDayCount)
  const carryTone = personalToday.carryInMinor < 0 ? 'negative' : 'positive'
  const budgetStatus =
    personalPlan.limitMinor === 0
      ? { tone: 'unconfigured', icon: '○', label: 'Aylık bütçe ayarlanmadı' }
      : personalToday.closingBalanceMinor < 0
        ? { tone: 'exceeded', icon: '!', label: 'Günlük hak aşıldı' }
        : personalToday.availableMinor > 0 &&
            personalToday.closingBalanceMinor <= personalToday.availableMinor * 0.2
          ? { tone: 'caution', icon: '!', label: 'Günlük limite yaklaşıyorsun' }
          : { tone: 'healthy', icon: '✓', label: 'Günlük bütçe dengede' }

  return (
    <div className="screen today-screen">
      <header className="today-header">
        <p className="date-label">{formatFullDate(today)}</p>
        <p className="brand-label">DailyCap</p>
      </header>

      <section className={`hero-card budget-${budgetStatus.tone}`} aria-labelledby="available-heading">
        <div className={`budget-status ${budgetStatus.tone}`} role="status">
          <span aria-hidden="true">{budgetStatus.icon}</span>
          {budgetStatus.label}
        </div>
        <p id="available-heading">Bugün harcayabilirsin</p>
        <strong className={personalToday.closingBalanceMinor < 0 ? 'money-negative' : ''}>
          {formatMoney(personalToday.closingBalanceMinor)}
        </strong>
        <div className="hero-meta">
          <span>Bugün harcanan</span>
          <b>{formatMoney(personalToday.spentMinor)}</b>
        </div>
        <div className={`carry-chip ${carryTone}`}>
          <span>{personalToday.carryInMinor < 0 ? 'Dünden gelen aşım' : 'Bugüne taşınan'}</span>
          <b>{formatMoney(personalToday.carryInMinor, { signed: true })}</b>
        </div>
        {personalPlan.limitMinor === 0 && (
          <p className="empty-budget-note">Aylık bütçeni Ayarlar bölümünden belirleyebilirsin.</p>
        )}
      </section>

      <button className="primary-action" type="button" onClick={onAddTransaction}>
        <span aria-hidden="true">＋</span>
        Harcama Ekle
      </button>

      <section className="metric-grid" aria-label="Aylık bütçe özeti">
        <article className="metric-card">
          <span>Aylık harcama</span>
          <strong>{formatMoney(personalLedger.totalSpentMinor)}</strong>
        </article>
        <article className="metric-card">
          <span>Aylık kalan</span>
          <strong className={personalRemaining < 0 ? 'money-negative' : ''}>
            {formatMoney(personalRemaining)}
          </strong>
        </article>
        <article className="metric-card wide">
          <div>
            <span>Güvenli günlük ortalama</span>
            <small>Kalan {remainingDayCount} gün için</small>
          </div>
          <strong className={safeDailyAverage < 0 ? 'money-negative' : ''}>
            {formatMoney(safeDailyAverage)}
          </strong>
        </article>
      </section>

      <section className="multinet-card" aria-labelledby="multinet-heading">
        <div className="card-title-row">
          <div>
            <span className="account-dot multinet-dot" aria-hidden="true" />
            <h2 id="multinet-heading">Multinet</h2>
          </div>
          <span className="soft-badge">Ayrı bütçe</span>
        </div>
        <div className="multinet-main">
          <span>Bugün kullanılabilir</span>
          <strong className={multinetToday.closingBalanceMinor < 0 ? 'money-negative' : ''}>
            {formatMoney(multinetToday.closingBalanceMinor)}
          </strong>
        </div>
        <dl className="inline-stats">
          <div>
            <dt>Bugün harcanan</dt>
            <dd>{formatMoney(multinetToday.spentMinor)}</dd>
          </div>
          <div>
            <dt>Aylık kalan</dt>
            <dd className={multinetRemaining < 0 ? 'money-negative' : ''}>
              {formatMoney(multinetRemaining)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
