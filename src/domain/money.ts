export function formatMoney(minor: number, options?: { signed?: boolean }): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    signDisplay: options?.signed ? 'exceptZero' : 'auto',
    maximumFractionDigits: 2,
  }).format(minor / 100)
}

export function minorToInputValue(minor: number): string {
  return (minor / 100).toFixed(2)
}

export function parseMoneyInputToMinor(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  const amount = Number(normalized)

  if (!normalized || !Number.isFinite(amount) || amount < 0) {
    return null
  }

  const minor = Math.round(amount * 100)
  return Number.isSafeInteger(minor) ? minor : null
}
