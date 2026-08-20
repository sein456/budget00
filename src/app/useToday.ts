import { useEffect, useState } from 'react'
import { getCurrentLocalDate } from '../domain/dateUtils'

export function useToday() {
  const [today, setToday] = useState(getCurrentLocalDate)

  useEffect(() => {
    let timer = 0

    const refresh = () => setToday(getCurrentLocalDate())
    const scheduleMidnightRefresh = () => {
      window.clearTimeout(timer)
      const now = new Date()
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        50,
      )
      timer = window.setTimeout(() => {
        refresh()
        scheduleMidnightRefresh()
      }, nextMidnight.getTime() - now.getTime())
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
        scheduleMidnightRefresh()
      }
    }

    scheduleMidnightRefresh()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return today
}
