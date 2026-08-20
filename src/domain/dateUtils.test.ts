import { describe, expect, it } from 'vitest'
import {
  createLocalDate,
  getCurrentLocalDate,
  getDaysInLocalMonth,
  getLocalMonth,
  listLocalDatesInMonth,
} from './dateUtils'
import type { LocalDate, LocalMonth } from './models'

describe('yerel tarih yardımcıları', () => {
  it.each([
    ['2025-02', 28],
    ['2024-02', 29],
    ['2025-04', 30],
    ['2025-01', 31],
  ] as const)('%s ayının %i gününü listeler', (month, expectedDays) => {
    expect(getDaysInLocalMonth(month as LocalMonth)).toBe(expectedDays)
    expect(listLocalDatesInMonth(month as LocalMonth)).toHaveLength(expectedDays)
  })

  it('cihaz tarihini UTC dönüşümü yapmadan yerel takvim günü olarak üretir', () => {
    const localDate = new Date(2026, 7, 19, 23, 45)

    expect(getCurrentLocalDate(localDate)).toBe('2026-08-19')
  })

  it('yerel tarihten ay anahtarını çıkarır', () => {
    expect(getLocalMonth('2026-08-19' as LocalDate)).toBe('2026-08')
  })

  it('geçersiz günleri reddeder', () => {
    expect(() => createLocalDate('2025-02' as LocalMonth, 29)).toThrow(RangeError)
    expect(() => getLocalMonth('2025-13-01' as LocalDate)).toThrow(RangeError)
  })
})
