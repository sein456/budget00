import { useEffect, useState, type FormEvent, type PointerEvent } from 'react'
import { minorToInputValue, parseMoneyInputToMinor } from '../../domain/money'
import type { AppSettings, BudgetAccountId, LocalDate, Transaction } from '../../domain/models'
import type { TransactionDraft } from '../../app/useBudgetData'
import { ActionIcon } from '../ActionIcon'

interface TransactionSheetProps {
  readonly today: LocalDate
  readonly defaultDate: LocalDate
  readonly settings: AppSettings
  readonly transaction?: Transaction
  readonly onClose: () => void
  readonly onSave: (draft: TransactionDraft) => Promise<void>
  readonly onDelete: (transactionId: string) => Promise<void>
}

export function TransactionSheet({
  today,
  defaultDate,
  settings,
  transaction,
  onClose,
  onSave,
  onDelete,
}: TransactionSheetProps) {
  const [amount, setAmount] = useState(
    transaction ? minorToInputValue(transaction.amountMinor) : '',
  )
  const [localDate, setLocalDate] = useState<LocalDate>(
    transaction?.localDate ?? defaultDate,
  )
  const [budgetAccountId, setBudgetAccountId] = useState<BudgetAccountId>(
    transaction?.budgetAccountId ?? 'personal',
  )
  const [category, setCategory] = useState(
    transaction?.category || settings.categories[0] || 'Diğer',
  )
  const [note, setNote] = useState(transaction?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
    <div className="sheet-backdrop" onPointerDown={handleBackdrop}>
      <section
        className="transaction-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-sheet-title"
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">{transaction ? 'İşlemi güncelle' : 'Yeni kayıt'}</p>
            <h2 id="transaction-sheet-title">
              {transaction ? 'Harcamayı Düzenle' : 'Harcama Ekle'}
            </h2>
          </div>
          <button className="sheet-close" type="button" aria-label="Kapat" onClick={onClose}>
            <ActionIcon />
          </button>
        </header>

        <form className="transaction-form" onSubmit={submit}>
          <label className="amount-field">
            <span>Tutar</span>
            <div>
              <input
                autoFocus
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
              rows={3}
              maxLength={180}
              placeholder="Kısa bir açıklama ekle"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {formError && <p className="form-message error" role="alert">{formError}</p>}

          <button className="primary-action" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor…' : transaction ? 'Değişiklikleri Kaydet' : 'Harcamayı Kaydet'}
          </button>

          {transaction && (
            <button
              className="delete-transaction"
              type="button"
              disabled={saving}
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
