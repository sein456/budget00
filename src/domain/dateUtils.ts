import type { LocalDate, LocalMonth } from './models'

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_MONTH_PATTERN = /^(\d{4})-(\d{2})$/

const pad2 = (value: number): string => String(value).padStart(2, '0')

function parseLocalMonth(month: LocalMonth): { year: number; monthNumber: number } {
  const match = LOCAL_MONTH_PATTERN.exec(month)

  if (!match) {
    throw new RangeError(`Geçersiz yerel ay: ${month}`)
  }

  const year = Number(match[1])
  const monthNumber = Number(match[2])

  if (year < 1000 || year > 9999 || monthNumber < 1 || monthNumber > 12) {
    throw new RangeError(`Geçersiz yerel ay: ${month}`)
  }

  return { year, monthNumber }
}

function parseLocalDate(date: LocalDate): {
  year: number
  monthNumber: number
  dayNumber: number
} {
  const match = LOCAL_DATE_PATTERN.exec(date)

  if (!match) {
    throw new RangeError(`Geçersiz yerel tarih: ${date}`)
  }

  const year = Number(match[1])
  const monthNumber = Number(match[2])
  const dayNumber = Number(match[3])
  const month = `${match[1]}-${match[2]}` as LocalMonth

  if (
    year < 1000 ||
    year > 9999 ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > getDaysInLocalMonth(month)
  ) {
    throw new RangeError(`Geçersiz yerel tarih: ${date}`)
  }

  return { year, monthNumber, dayNumber }
}

export function getCurrentLocalDate(now = new Date()): LocalDate {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}` as LocalDate
}

export function getLocalMonth(date: LocalDate): LocalMonth {
  const { year, monthNumber } = parseLocalDate(date)
  return `${year}-${pad2(monthNumber)}` as LocalMonth
}

export function getDayOfLocalMonth(date: LocalDate): number {
  return parseLocalDate(date).dayNumber
}

export function getDaysInLocalMonth(month: LocalMonth): number {
  const { year, monthNumber } = parseLocalMonth(month)
  return new Date(year, monthNumber, 0).getDate()
}

export function createLocalDate(month: LocalMonth, dayNumber: number): LocalDate {
  const { year, monthNumber } = parseLocalMonth(month)
  const daysInMonth = getDaysInLocalMonth(month)

  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > daysInMonth) {
    throw new RangeError(`Geçersiz gün: ${dayNumber}`)
  }

  return `${year}-${pad2(monthNumber)}-${pad2(dayNumber)}` as LocalDate
}

export function listLocalDatesInMonth(month: LocalMonth): readonly LocalDate[] {
  return Array.from({ length: getDaysInLocalMonth(month) }, (_, index) =>
    createLocalDate(month, index + 1),
  )
}
