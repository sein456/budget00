import { useState } from 'react'
import {
  createLocalDate,
  getCurrentLocalDate,
  getDayOfLocalMonth,
  getDaysInLocalMonth,
  getLocalMonth,
} from '../domain/dateUtils'

export function useToday() {
  const [today, setToday] = useState(() => {
    const currentMonth = getLocalMonth(getCurrentLocalDate())
    return createLocalDate(currentMonth, 1)
  })
  const month = getLocalMonth(today)
  const dayNumber = getDayOfLocalMonth(today)
  const daysInMonth = getDaysInLocalMonth(month)

  const goToPreviousDay = () => {
    setToday((current) => {
      const currentDay = getDayOfLocalMonth(current)
      return currentDay === 1
        ? current
        : createLocalDate(getLocalMonth(current), currentDay - 1)
    })
  }

  const goToNextDay = () => {
    setToday((current) => {
      const currentMonth = getLocalMonth(current)
      const currentDay = getDayOfLocalMonth(current)
      return currentDay === getDaysInLocalMonth(currentMonth)
        ? current
        : createLocalDate(currentMonth, currentDay + 1)
    })
  }

  const resetToFirstDay = () => setToday(createLocalDate(month, 1))

  return {
    today,
    dayNumber,
    daysInMonth,
    canGoBack: dayNumber > 1,
    canGoForward: dayNumber < daysInMonth,
    goToPreviousDay,
    goToNextDay,
    resetToFirstDay,
  }
}
