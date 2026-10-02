import { describe, expect, it } from 'vitest'
import { parseReceipt } from './receiptParser'

const today = '2026-10-02' as const
const categories = ['Market', 'Yeme & İçme', 'Sağlık', 'Ulaşım']
const parse = (text: string) => parseReceipt(text, today, categories)

describe('Turkish receipt interpretation', () => {
  it('chooses the grand total, not subtotal, tax, tendered cash or change', () => {
    const result = parse('MİGROS\nTARİH 02.10.2026\nARA TOPLAM 100,00\nTOPLAM KDV 10,00\nGENEL TOPLAM *110,00\nNAKİT 150,00\nPARA ÜSTÜ 40,00')
    expect(result.amountMinor).toBe(11000)
    expect(result.localDate).toBe(today)
    expect(result.merchant).toBe('MİGROS')
    expect(result.category).toBe('Market')
    expect(result.warnings).toEqual([])
  })
  it.each(['1.234,56', '1 234,56', '1234,56', '1,234.56', '1234.56'])('handles grouping and decimals: %s', (value) => {
    expect(parse(`MARKET\nTOPLAM ${value}`).amountMinor).toBe(123456)
  })
  it('recognizes integer TL amounts but never card IDs', () => {
    expect(parse('TOPLAM 150 TL').amountMinor).toBe(15000)
    expect(parse('VKN 1234567890\nKART NO 1234567890123456').amountMinor).toBeNull()
  })
  it('accepts labeled whole-lira total', () => expect(parse('TOPLAM 150').amountMinor).toBe(15000))
  it('handles a total value on its own next line', () => expect(parse('GENEL TOPLAM\n*876,50 TL').amountMinor).toBe(87650))
  it('does not take another label as next-line total', () => expect(parse('TOPLAM\nKDV 20,00').candidates).toEqual([]))
  it('understands VAT-inclusive total', () => expect(parse('KDV DAHİL TOPLAM 120,00').amountMinor).toBe(12000))
  it('validates split payments against the receipt total', () => expect(parse('TOPLAM 150,00\nNAKİT 50,00\nKREDİ KARTI 100,00').amountMinor).toBe(15000))
  it('ignores repeated equal POS totals as duplicates, not twice the expense', () => expect(parse('TOPLAM 150,00\nKREDİ KARTI 150,00\nKART 150,00').amountMinor).toBe(15000))
  it('requires confirmation if strong totals disagree', () => {
    const result = parse('GENEL TOPLAM 150,00\nÖDENECEK TUTAR 160,00')
    expect(result.amountMinor).toBeNull(); expect(result.candidates).toHaveLength(2)
  })
  it('prefers payable over a generic total', () => expect(parse('TOPLAM 170,00\nÖDENECEK TUTAR 150,00').amountMinor).toBe(15000))
  it('requires confirmation when payment contradicts total', () => {
    const result = parse('TOPLAM 150,00\nKREDİ KARTI 160,00')
    expect(result.amountMinor).toBeNull(); expect(result.warnings.join()).toContain('uyuşmuyor')
  })
  it('never auto-selects payment-only slips', () => {
    const result = parse('NAKİT 200,00\nPARA ÜSTÜ 50,00')
    expect(result.amountMinor).toBeNull(); expect(result.candidates[0].amountMinor).toBe(15000)
  })
  it('does not mistake items, VAT or discounts for a total', () => {
    expect(parse('SÜT 35,00\nEKMEK 20,00\nKDV %10 5,00\nTOPLAM İNDİRİM 10,00\nARA TOPLAM 55,00').candidates).toEqual([])
  })
  it('does not treat a refund as spending', () => expect(parse('İADE TOPLAM -120,00').candidates).toEqual([]))
  it('does not import a positively printed refund total', () => expect(parse('SATIŞ İADE FİŞİ\nTOPLAM 120,00').candidates).toEqual([]))
  it('does not ignore contradictory payment lines just because one agrees', () => expect(parse('TOPLAM 150,00\nNAKİT 150,00\nKART 160,00').amountMinor).toBeNull())
  it('never silently converts foreign money to TL', () => {
    const result = parse('SHOP\nTOTAL €120.00\nCARD USD 120.00')
    expect(result.candidates).toEqual([]); expect(result.amountMinor).toBeNull(); expect(result.warnings.join()).toContain('Yabancı')
  })
  it('can choose an explicitly local total on mixed currency slips', () => expect(parse('TOTAL EUR 10,00\nGENEL TOPLAM 400,00 TL').amountMinor).toBe(40000))
  it('respects currency from a separate header line', () => expect(parse('CURRENCY USD\nTOTAL 120.00').candidates).toEqual([]))
  it.each(['31.02.2026', '03.10.2026', '01.01.1999'])('does not replace date with invalid/future/unsupported date %s', (date) => expect(parse(`TARİH ${date}\nTOPLAM 20,00`).localDate).toBeNull())
  it.each(['2/10/26', '02-10-2026', '2026-10-02'])('supports receipt date %s', (date) => expect(parse(`TARİH ${date}`).localDate).toBe(today))
  it('ignores expiry dates', () => expect(parse('SKT 01.12.2026\nTARİH 01.10.2026').localDate).toBe('2026-10-01'))
  it('avoids conflicting dates', () => expect(parse('TARİH 01.10.2026\nTARİH 02.10.2026').localDate).toBeNull())
  it.each([['Dost Eczanesi', 'Sağlık'], ['NEŞE KAFE', 'Yeme & İçme'], ['SHELL PETROL', 'Ulaşım']])('suggests only a configured category for %s', (merchant, category) => expect(parse(merchant).category).toBe(category))
  it('does not introduce unconfigured categories', () => expect(parseReceipt('MIGROS', today, ['Ev']).category).toBeNull())
  it('handles empty OCR safely', () => { expect(parse('').amountMinor).toBeNull(); expect(parse('').merchant).toBeNull() })
  it('corrects a common total label OCR error without fixing price digits', () => expect(parse('T0PLAM 120,50').amountMinor).toBe(12050))
  it('does not parse a date into an expense', () => expect(parse('TOPLAM\n02.10.2026').amountMinor).toBeNull())
})
