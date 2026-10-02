import type { CategorySpending } from './monthlyAnalytics'

export interface CategorySlice { readonly label: string; readonly amountMinor: number; readonly members: readonly string[] }

/** Preserve exact kuruş totals; percentages are rounded only for display. */
export function createCategorySlices(rows: readonly CategorySpending[]): CategorySlice[] {
  const sorted = [...rows].filter(row => row.amountMinor > 0).sort((a,b) => b.amountMinor - a.amountMinor || a.category.localeCompare(b.category, 'tr'))
  if (sorted.length <= 5) return sorted.map(row => ({label:row.category, amountMinor:row.amountMinor, members:[row.category]}))
  const leading = sorted.slice(0,4).map(row => ({label:row.category,amountMinor:row.amountMinor,members:[row.category]}))
  const tail = sorted.slice(4)
  return [...leading,{label:`Diğer ${tail.length} kategori`,amountMinor:tail.reduce((sum,row) => sum + row.amountMinor,0),members:tail.map(row => row.category)}]
}
