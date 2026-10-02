import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { minorToInputValue, parseMoneyInputToMinor } from '../../domain/money'
import type { AppSettings, BudgetAccountId, LocalDate, Transaction } from '../../domain/models'
import type { TransactionDraft } from '../../app/useBudgetData'
import { ActionIcon } from '../ActionIcon'
import { CameraIcon, ReceiptScanner } from '../receipts/ReceiptScanner'

interface TransactionSheetProps {
  readonly today: LocalDate
  readonly defaultDate: LocalDate
  readonly settings: AppSettings
  readonly transaction?: Transaction
  readonly preset?: Transaction
  readonly transactions?: readonly Transaction[]
  readonly onClose: () => void
  readonly onSave: (draft: TransactionDraft) => Promise<void>
  readonly onDelete: (transactionId: string) => Promise<void>
}

export function TransactionSheet({
  today,
  defaultDate,
  settings,
  transaction,
  preset,
  transactions = [],
  onClose,
  onSave,
  onDelete,
}: TransactionSheetProps) {
  const [amount, setAmount] = useState(
    transaction || preset ? minorToInputValue((transaction ?? preset)!.amountMinor) : '',
  )
  const [localDate, setLocalDate] = useState<LocalDate>(
    transaction?.localDate ?? defaultDate,
  )
  const [budgetAccountId, setBudgetAccountId] = useState<BudgetAccountId>(
    transaction?.budgetAccountId ?? preset?.budgetAccountId ?? 'personal',
  )
  const [category, setCategory] = useState(
    transaction?.category || (preset?.category && settings.categories.includes(preset.category) ? preset.category : '') || settings.categories[0] || 'Diğer',
  )
  const [note, setNote] = useState(transaction?.note ?? preset?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ y: number; pointerId: number } | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => dragCleanupRef.current?.(), [])

  useEffect(() => {
    const viewport = window.visualViewport
    const syncViewport = () => {
      if (!viewport || !backdropRef.current) return
      backdropRef.current.style.top = `${viewport.offsetTop}px`
      backdropRef.current.style.height = `${viewport.height}px`
      backdropRef.current.style.setProperty('--sheet-viewport-height', `${viewport.height}px`)
    }
    syncViewport()
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    return () => {
      viewport?.removeEventListener('resize', syncViewport)
      viewport?.removeEventListener('scroll', syncViewport)
    }
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const content = document.querySelector<HTMLElement>('.app-content')
    const navigation = document.querySelector<HTMLElement>('.bottom-navigation')
    const wasContentInert = content?.inert ?? false
    const wasNavigationInert = navigation?.inert ?? false
    if (content) content.inert = true
    if (navigation) navigation.inert = true
    if (!window.matchMedia('(pointer: fine)').matches) sheetRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
      if (event.key !== 'Tab') return
      const controls = [...(sheetRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex="0"]') ?? [])].filter((element) => element.getClientRects().length && !element.closest('[hidden]'))
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (content) content.inert = wasContentInert
      if (navigation) navigation.inert = wasNavigationInert
      previousFocus?.focus({ preventScroll: true })
    }
  }, [onClose, saving])

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (saving || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    dragRef.current = { y: event.clientY, pointerId: event.pointerId }
    setDragging(true)
    dragCleanupRef.current?.()
    const move = (event: globalThis.PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return
      if (event.cancelable) event.preventDefault()
      setDragOffset(Math.max(0, event.clientY - dragRef.current.y))
    }
    const end = (event: globalThis.PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return
      const distance = event.clientY - dragRef.current.y
      dragRef.current = null
      setDragging(false)
      setDragOffset(0)
      dragCleanupRef.current?.()
      if (event.type !== 'pointercancel' && !saving && distance >= 90) onClose()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (scanning || saving) return
    const amountMinor = parseMoneyInputToMinor(amount)

    if (amountMinor === null || amountMinor <= 0) {
      setFormError('Sıfırdan büyük geçerli bir tutar gir.')
      return
    }

    if (localDate > today) {
      setFormError('Gelecek tarihli harcama eklenemez.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      await onSave({
        id: transaction?.id,
        budgetAccountId,
        localDate,
        amountMinor,
        category,
        note,
      })
      onClose()
    } catch {
      setFormError('İşlem kaydedilemedi. Lütfen tekrar dene.')
    } finally {
      setSaving(false)
    }
  }

  const handleBackdrop = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !saving) {
      onClose()
    }
  }

  return (
    <div className="sheet-backdrop" ref={backdropRef} onPointerDown={handleBackdrop}>
      <section
        ref={sheetRef}
        tabIndex={-1}
        className={`transaction-sheet${dragging ? ' is-dragging' : ''}`}
        style={{ transform: `translateY(${dragOffset}px)`, transition: dragging ? 'none' : 'transform 160ms ease-out' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-sheet-title"
      >
        <div className="sheet-drag-area" role="button" tabIndex={0}
          aria-label="Pencereyi aşağı çekerek kapat; klavyede Enter ile kapat"
          onPointerDown={startDrag}
          onKeyDown={(event) => {
            if (!saving && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault(); onClose()
            }
          }}>
          <div className="sheet-handle" aria-hidden="true" />
        </div>
        <header className="sheet-header">
          <div>
            <p className="eyebrow">{transaction ? 'İşlemi güncelle' : 'Yeni kayıt'}</p>
            <h2 id="transaction-sheet-title">
              {transaction ? 'Harcamayı Düzenle' : 'Harcama Ekle'}
            </h2>
          </div>
          <div className="sheet-header-actions">
            <button className="sheet-camera" type="button" aria-label="Fiş tara" title="Fiş tara" aria-expanded={scannerOpen} disabled={saving} onClick={() => { if (!scannerOpen) { document.activeElement instanceof HTMLElement && document.activeElement.blur(); setScannerOpen(true) } }}><CameraIcon /></button>
            <button className="sheet-close" type="button" aria-label="Kapat" disabled={saving} onClick={onClose}>
              <ActionIcon />
            </button>
          </div>
        </header>

        {scannerOpen && <ReceiptScanner today={today} categories={settings.categories} transactions={transactions.filter((item) => item.id !== transaction?.id)} accountId={budgetAccountId} onBusyChange={setScanning} onClose={() => { setScannerOpen(false); setScanning(false) }} onApply={(receipt) => {
          setAmount(minorToInputValue(receipt.amountMinor))
          if (receipt.localDate) setLocalDate(receipt.localDate)
          if (receipt.category) setCategory(receipt.category)
          if (receipt.merchant) setNote((current) => `${current ? `${current} · ` : ''}Fiş: ${receipt.merchant}`.slice(0, 180))
          setFormError(null); setScannerOpen(false); setScanning(false)
          sheetRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        }} />}

        <form className="transaction-form" onSubmit={submit}>
          <label className="amount-field">
            <span>Tutar</span>
            <div>
              <input
                autoFocus={window.matchMedia('(pointer: fine)').matches}
                aria-label="Tutar"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <b aria-hidden="true">₺</b>
            </div>
          </label>

          <div className="form-grid">
            <label className="field-group">
              <span>Tarih</span>
              <input
                type="date"
                max={today}
                value={localDate}
                onChange={(event) => setLocalDate(event.target.value as LocalDate)}
                required
              />
            </label>
            <label className="field-group">
              <span>Bütçe türü</span>
              <select
                value={budgetAccountId}
                onChange={(event) => setBudgetAccountId(event.target.value as BudgetAccountId)}
              >
                <option value="personal">Kişisel</option>
                <option value="multinet">Multinet</option>
              </select>
            </label>
          </div>

          <label className="field-group">
            <span>Kategori</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {settings.categories.map((item) => (
                <option value={item} key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Not <small>opsiyonel</small></span>
            <textarea
              rows={2}
              maxLength={180}
              placeholder="Kısa bir açıklama ekle"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {formError && <p className="form-message error" role="alert">{formError}</p>}

          <button className="primary-action" type="submit" disabled={saving || scanning}>
            {saving ? 'Kaydediliyor…' : transaction ? 'Değişiklikleri Kaydet' : 'Harcamayı Kaydet'}
          </button>

          {transaction && (
            <button
              className="delete-transaction"
              type="button"
              disabled={saving || scanning}
              onClick={async () => {
                setSaving(true)
                try {
                  await onDelete(transaction.id)
                  onClose()
                } catch {
                  setFormError('İşlem silinemedi. Lütfen tekrar dene.')
                  setSaving(false)
                }
              }}
            >
              Harcamayı Sil
            </button>
          )}
        </form>
      </section>
    </div>
  )
}
