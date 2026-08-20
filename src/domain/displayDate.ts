import type { LocalDate, LocalMonth } from './models'

export function localDateToDate(localDate: LocalDate): Date {
  const [year, month, day] = localDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatFullDate(localDate: LocalDate): string {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(localDateToDate(localDate))
}

export function formatHistoryDate(localDate: LocalDate): string {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(localDateToDate(localDate))
}

export function formatMonth(month: LocalMonth): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthNumber - 1, 1))
}
