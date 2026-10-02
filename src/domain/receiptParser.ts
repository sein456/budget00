import { getLocalMonth } from './dateUtils'
import type { LocalDate } from './models'

export interface ReceiptAmountCandidate {
  readonly amountMinor: number
  readonly label: string
  readonly source: string
}
export interface ParsedReceipt {
  readonly amountMinor: number | null
  readonly candidates: readonly ReceiptAmountCandidate[]
  readonly localDate: LocalDate | null
  readonly merchant: string | null
  readonly category: string | null
  readonly warnings: readonly string[]
}

const normalize = (text: string) => text.toLocaleUpperCase('tr-TR')
  .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
  .replace(/Ö/g, 'O').replace(/Ç/g, 'C').replace(/T0PLAM/g, 'TOPLAM')

function amounts(line: string, allowInteger = false): number[] {
  // Dates, VAT rates, quantities, card numbers and receipt IDs are not prices.
  const cleaned = line.replace(/\b\d{1,4}[./-]\d{1,2}[./-]\d{2,4}\b/g, '')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '').replace(/%\s*\d+(?:[.,]\d+)?/g, '')
  const tokens: string[] = cleaned.match(/(?<![\d.,-])(?:\d{1,3}(?:[., ]\d{3})+|\d+)[,.]\d{2}(?![\d.,])|(?<![\d.,-])\d+(?=\s*(?:TL\b|TRY\b|₺))/g) ?? []
  if (!tokens.length && allowInteger) {
    const integer = cleaned.match(/(?:TOPLAM|TUTAR|NAKIT|KART|MULTINET)\s*[:*₺]?\s*(\d{1,7})\s*(?:TL|TRY|₺)?\s*$/)
    if (integer) tokens.push(integer[1])
  }
  return tokens.map((token) => {
    const decimal = token.match(/[.,](\d{2})$/)
    const whole = (decimal ? token.slice(0, -3) : token).replace(/[. ,]/g, '')
    return Number(whole) * 100 + Number(decimal?.[1] ?? 0)
  }).filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000_000)
}

function receiptDate(lines: string[], today: LocalDate, warnings: string[]): LocalDate | null {
  const dates: { date: LocalDate; labeled: boolean }[] = []
  for (const line of lines) {
    const normalized = normalize(line)
    if (/SON KULLAN|SKT|TETT|VADE|KAMPANYA/.test(normalized)) continue
    for (const match of line.matchAll(/\b(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2}))\b/g)) {
      const year = match[1] ? Number(match[1]) : Number(match[6]) + (match[6].length === 2 ? 2000 : 0)
      const date = `${year}-${String(match[2] ?? match[5]).padStart(2, '0')}-${String(match[3] ?? match[4]).padStart(2, '0')}` as LocalDate
      try {
        getLocalMonth(date)
        if (year < 2000 || date > today) {
          warnings.push('Fişteki tarih geçmiş bir işlem tarihi olarak doğrulanamadı; formdaki tarih korundu.')
        } else dates.push({ date, labeled: /TARIH/.test(normalized) })
      } catch {
        warnings.push('Fişteki tarih geçersiz görünüyor; formdaki tarih korundu.')
      }
    }
  }
  const preferred = dates.some((item) => item.labeled) ? dates.filter((item) => item.labeled) : dates
  const unique = [...new Set(preferred.map((item) => item.date))]
  if (unique.length > 1) warnings.push('Birden fazla tarih okundu; tarihi kendin kontrol et.')
  return unique.length === 1 ? unique[0] : null
}

function receiptMerchant(lines: string[]): string | null {
  return lines.slice(0, 8).find((line) => {
    const text = normalize(line)
    return text.length >= 3 && /[A-Z]{3}/.test(text) && !/\d{4,}|TARIH|SAAT|FIS|FATURA|VKN|VERGI|MERSIS|TEL|ADRES|CADDE|SOKAK|MAH[. ]|KDV|TOPLAM|NAKIT|POS |BANKA|KREDI|TUTAR|ODEME|PARA USTU|ISLEM/.test(text)
  })?.slice(0, 80) ?? null
}

function suggestCategory(merchant: string | null, categories: readonly string[]): string | null {
  const name = normalize(merchant ?? '')
  const rules: [RegExp, string][] = [
    [/\b(MIGROS|BIM|A101|SOK|CARREFOUR|METRO|MARKET|SUPERMARKET)\b/, 'MARKET'],
    [/ECZANE|ECZANESI/, 'SAGLIK'],
    [/RESTORAN|RESTAURANT|CAFE|KAFE|KAHVE|LOKANTA|BURGER|KEBAP|PIZZA|YEMEK/, 'YEME & ICME'],
    [/PETROL|AKARYAKIT|TAKSI|OTOPARK|SHELL|OPET/, 'ULASIM'],
  ]
  const target = rules.find(([pattern]) => pattern.test(name))?.[1]
  return categories.find((item) => normalize(item) === target) ?? null
}

export function parseReceipt(text: string, today: LocalDate, categories: readonly string[] = []): ParsedReceipt {
  const lines = text.slice(0, 50_000).split(/\r?\n/).map((line) => line.trim().replace(/\s+/g, ' ')).filter(Boolean)
  const warnings: string[] = []
  const totals: (ReceiptAmountCandidate & { rank: number })[] = []
  const payments: number[] = []
  let change = 0
  const foreign = lines.some((line) => /\b(EUR|USD|GBP|DOLAR|EURO)\b|[$€£]/.test(normalize(line)))
  const isRefund = lines.some((line) => /IADE\s*(FIS|BELGE)|SATIS\s*IADE|IPTAL\s*(FIS|BELGE)/.test(normalize(line)))
  for (let index = 0; index < lines.length; index++) {
    const source = lines[index]
    const line = normalize(source)
    if (/\b(EUR|USD|GBP|DOLAR|EURO)\b|[$€£]/.test(line)) {
      continue
    }
    // A currency may appear in the header, not on the total line. In that case
    // only an explicitly TRY-denominated amount is safe for this TRY-only app.
    if (foreign && !/\b(TL|TRY)\b|₺/.test(line)) continue
    const values = amounts(line, true)
    if (/PARA\s*UST|CHANGE/.test(line)) { change = values.at(-1) ?? 0; continue }
    if (/ARA\s*TOPLAM|SUBTOTAL|INDIRIM|ISKONTO|IADE|IPTAL|TOPLAM\s*(KDV|VERGI)|KDV\s*TOPLAM/.test(line)) continue
    if (/KDV|VERGI/.test(line) && !/(KDV|VERGI).*DAHIL.*TOPLAM/.test(line)) continue
    const strong = /GENEL\s*TOPLAM|ODENECEK(?:\s*TUTAR)?|NET\s*TOPLAM|(?:KDV|VERGILER)\s*DAHIL\s*TOPLAM/.test(line)
    const total = strong || /(?:^|\s)TOPLAM(?:\s|:|\*)|TOTAL\b/.test(line)
    if (total) {
      let value = values.at(-1)
      let candidateSource = source
      if (!value && index + 1 < lines.length) {
        const next = normalize(lines[index + 1])
        if (/^[\s*₺\d.,]+(?:\s*(?:TL|TRY))?$/.test(next)) {
          value = amounts(next).at(-1)
          candidateSource += ` · ${lines[index + 1]}`
        }
      }
      if (value) totals.push({ amountMinor: value, label: strong ? 'Ödenecek toplam' : 'Fiş toplamı', source: candidateSource, rank: strong ? 2 : 1 })
    } else if (/NAKIT|KREDI\s*KART|BANKA\s*KART|\bKART\b|MULTINET|SODEXO|TICKET|TEMASSIZ/.test(line) && !/ALINAN|VERILEN|BAKIYE/.test(line)) {
      if (values.length) payments.push(values.at(-1)!)
    }
  }
  const maxRank = Math.max(0, ...totals.map((item) => item.rank))
  const preferred = totals.filter((item) => item.rank === maxRank)
  let candidates: ReceiptAmountCandidate[] = [...new Map(preferred.map((item) => [item.amountMinor, item])).values()]
  let amountMinor = candidates.length === 1 ? candidates[0].amountMinor : null
  if (candidates.length > 1) warnings.push('Birden fazla toplam var. Doğru harcama tutarını seç.')
  if (!candidates.length && payments.length) {
    const uniquePayments = [...new Set(payments)]
    // Without a receipt total, repeated POS and cash lines cannot establish split payment reliably.
    candidates = uniquePayments.filter((value) => value > change).map((value) => ({ amountMinor: value - change, label: change ? 'Ödeme − para üstü (kontrol et)' : 'Ödeme tutarı (kontrol et)', source: 'Fiş toplamı bulunamadı; ödeme satırından okundu.' }))
    warnings.push('Fiş toplamı okunamadı. Ödeme satırları kesin toplam değildir; seçmeden önce kontrol et.')
  }
  if (amountMinor !== null && payments.length) {
    const paid = payments.reduce((sum, value) => sum + value, 0) - change
    if (paid !== amountMinor && !payments.every((value) => value - change === amountMinor)) {
      warnings.push('Toplam ile ödeme satırları uyuşmuyor; tutarı fişten kontrol et.')
      amountMinor = null
    }
  }
  if (!candidates.length) warnings.push(foreign ? 'Yabancı para tutarı TL olarak alınmadı. TL tutarını kendin gir.' : 'Güvenilir bir toplam okunamadı. Daha net fotoğraf çek veya tutarı kendin gir.')
  if (isRefund) {
    amountMinor = null; candidates = []
    warnings.push('Bu belge iade veya iptal fişi gibi görünüyor; harcama olarak alınmadı.')
  }
  const localDate = receiptDate(lines, today, warnings)
  const merchant = receiptMerchant(lines)
  return { amountMinor, candidates, localDate, merchant, category: suggestCategory(merchant, categories), warnings: [...new Set(warnings)] }
}
