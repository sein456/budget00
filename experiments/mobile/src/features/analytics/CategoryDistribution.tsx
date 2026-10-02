import { useState } from 'react'
import { createCategorySlices } from '../../domain/categoryChart'
import { formatMoney } from '../../domain/money'
import type { CategorySpending } from '../../domain/monthlyAnalytics'

const palette = ['#5ed0a5','#76a9d9','#d6b567','#b09bd9','#a6b5ad']
const percent = (value: number) => new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}).format(value)

export function CategoryDistribution({ rows, monthLabel, accountLabel }: {
  readonly rows: readonly CategorySpending[]; readonly monthLabel: string; readonly accountLabel: string
}) {
  const slices = createCategorySlices(rows)
  const total = slices.reduce((sum, slice) => sum + slice.amountMinor, 0)
  const [selected, setSelected] = useState<string | null>(null)
  const active = slices.find(slice => slice.label === selected)
  let offset = 0
  const circumference = 2 * Math.PI * 76

  return <section className="distribution-card" aria-labelledby="distribution-title">
    <p className="eyebrow">{monthLabel} · {accountLabel}</p>
    <h2 id="distribution-title">Harcama dağılımı</h2>
    <p className="distribution-caption">Bu ay kaydedilen toplam harcamanın kategori payları</p>
    {total === 0 ? <div className="empty-state"><strong>Henüz harcama yok</strong><p>Harcama eklediğinde grafik burada oluşacak.</p></div> : <>
      <div className="donut-wrap">
        <svg viewBox="0 0 200 200" role="img" aria-label={`${monthLabel}, ${accountLabel}: toplam ${formatMoney(total)}. Kategori tutarları aşağıdaki listede.`}>
          {slices.map((slice,index) => {
            const length = (slice.amountMinor / total) * circumference
            const dashOffset = -offset
            offset += length
            return <circle key={slice.label} cx="100" cy="100" r="76" fill="none" stroke={palette[index]}
              strokeWidth={24} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={dashOffset}
              transform="rotate(-90 100 100)" opacity={!active || active.label === slice.label ? 1 : 0.3}/>
          })}
        </svg>
        <div className="donut-center" aria-live="polite"><span>{active?.label ?? 'Toplam harcama'}</span><strong>{formatMoney(active?.amountMinor ?? total)}</strong><small>{active ? `%${percent(active.amountMinor / total * 100)}` : `${rows.length} kategori`}</small></div>
      </div>
      <div className="distribution-legend" aria-label="Grafik kategori seçimi">
        {slices.map((slice,index) => <button type="button" key={slice.label} aria-pressed={active?.label === slice.label}
          onClick={() => setSelected(current => current === slice.label ? null : slice.label)}>
          <i aria-hidden="true" style={{background:palette[index]}}/>
          <span>{slice.label}</span><b>%{percent(slice.amountMinor / total * 100)}</b>
        </button>)}
      </div>
      {active && active.members.length > 1 && <p className="distribution-caption">Bu dilim: {active.members.join(', ')}.</p>}
      <details className="distribution-details"><summary>Tüm kategori tutarları</summary>
        <div className="category-bars">{rows.map(row => <div className="category-bar-row" key={row.category}>
          <div className="category-bar-label"><span>{row.category}</span><b>{formatMoney(row.amountMinor)}</b></div>
          <div className="category-track" aria-hidden="true"><span style={{width:`${row.amountMinor / total * 100}%`}}/></div>
          <small>%{percent(row.amountMinor / total * 100)}</small>
        </div>)}</div>
      </details>
    </>}
  </section>
}
