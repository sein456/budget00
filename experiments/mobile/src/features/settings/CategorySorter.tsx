import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { reorderCategories } from '../../domain/reorderCategories'
import { ActionIcon } from '../ActionIcon'

interface Props {
  readonly categories: readonly string[]
  readonly onChange: (categories: string[]) => void
}

export function CategorySorter({ categories, onChange }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const latestRef = useRef({ categories, onChange })
  latestRef.current = { categories, onChange }
  const pendingRef = useRef<{ category: string; pointerId: number; x: number; y: number; active: boolean } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const stop = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      const drag = pendingRef.current
      if (drag?.active) setAnnouncement(`${drag.category}, ${latestRef.current.categories.indexOf(drag.category) + 1}. sırada. Sıralamayı kaydetmeyi unutma.`)
      pendingRef.current = null
      setDragging(null)
    }
    const move = (event: globalThis.PointerEvent) => {
      const drag = pendingRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (!drag.active) {
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 10) stop()
        return
      }
      event.preventDefault()
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-category]')
      if (!target || !listRef.current?.contains(target) || !target.dataset.category) return
      const { categories: current, onChange: change } = latestRef.current
      if (target.dataset.category !== drag.category) change(reorderCategories(current, drag.category, target.dataset.category))
    }
    const end = (event: globalThis.PointerEvent) => {
      if (pendingRef.current?.pointerId === event.pointerId) stop()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', stop)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', stop)
    }
  }, [])

  const start = (category: string, event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    if (timerRef.current) clearTimeout(timerRef.current)
    pendingRef.current = { category, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false }
    timerRef.current = setTimeout(() => {
      if (!pendingRef.current || pendingRef.current.category !== category) return
      pendingRef.current.active = true
      setDragging(category)
      setAnnouncement(`${category} taşınıyor.`)
    }, 220)
  }

  return <>
    <p className="sort-hint" id="category-sort-hint">Noktalı tutamağa basılı tutup sürükle. Sonra Ayarları Kaydet.</p>
    <div className="category-list" ref={listRef}>
      {categories.map((category, index) => <span className={`category-chip${dragging === category ? ' moving' : ''}`} key={category} data-category={category}>
        <button className="category-grip" type="button" aria-label={`${category} kategorisini taşı`}
          aria-describedby="category-sort-hint" aria-pressed={dragging === category}
          onPointerDown={(event) => start(category, event)} onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : 0
            if (!direction) return
            event.preventDefault()
            const target = categories[index + direction]
            if (target) {
              onChange(reorderCategories(categories, category, target))
              setAnnouncement(`${category}, ${index + direction + 1}. sırada.`)
            }
          }}>
          <svg aria-hidden="true" width="14" height="20" viewBox="0 0 14 20" fill="currentColor">
            {[5,10,15].flatMap(y => [4,10].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3"/>))}
          </svg>
        </button>
        <span>{category}</span>
        <button type="button" aria-label={`${category} kategorisini kaldır`} onClick={() => onChange(categories.filter(item => item !== category))}><ActionIcon/></button>
      </span>)}
    </div>
    <span className="sr-only" role="status">{announcement}</span>
  </>
}
