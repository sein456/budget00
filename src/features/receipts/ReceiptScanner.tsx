import { useEffect, useRef, useState } from 'react'
import { parseReceipt, type ParsedReceipt } from '../../domain/receiptParser'
import { formatMoney } from '../../domain/money'
import type { BudgetAccountId, LocalDate, Transaction } from '../../domain/models'
import { readReceipt, type ReceiptProgress } from './receiptOcr'

export function CameraIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 6h4l2-3h4l2 3h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
}

interface ReceiptScannerProps {
  readonly today: LocalDate
  readonly categories: readonly string[]
  readonly transactions: readonly Transaction[]
  readonly accountId: BudgetAccountId
  readonly onApply: (receipt: ParsedReceipt & { amountMinor: number }) => void
  readonly onClose: () => void
  readonly onBusyChange: (busy: boolean) => void
}

export function ReceiptScanner({ today, categories, transactions, accountId, onApply, onClose, onBusyChange }: ReceiptScannerProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState<ReceiptProgress | null>(null)
  const [result, setResult] = useState<ParsedReceipt | null>(null)
  const [chosen, setChosen] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true })
    panelRef.current?.scrollIntoView({ block: 'nearest' })
    return () => abortRef.current?.abort()
  }, [])

  const scan = async (file?: File) => {
    if (!file) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null); setResult(null); setChosen(null); setText('')
    setProgress({ percent: 0, message: 'Fotoğraf hazırlanıyor…' }); onBusyChange(true)
    try {
      const raw = await readReceipt(file, controller.signal, setProgress)
      if (controller.signal.aborted) return
      const parsed = parseReceipt(raw, today, categories)
      setResult(parsed); setChosen(parsed.amountMinor); setText(raw.slice(0, 50_000))
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Fiş okunamadı. Daha net fotoğrafla tekrar dene.')
    } finally {
      if (abortRef.current === controller && !controller.signal.aborted) {
        setProgress(null); onBusyChange(false)
      }
    }
  }
  const duplicate = chosen !== null && result?.localDate && transactions.some((item) => item.amountMinor === chosen && item.localDate === result.localDate && item.budgetAccountId === accountId)
  const cancel = () => { abortRef.current?.abort(); onBusyChange(false); onClose() }
  return <section className="receipt-panel" ref={panelRef} tabIndex={-1} aria-labelledby="receipt-panel-title">
    <div className="receipt-title-row"><h3 id="receipt-panel-title"><CameraIcon /> Fişten doldur</h3><button type="button" className="receipt-text-button" onClick={cancel}>{progress ? 'İptal' : 'Vazgeç'}</button></div>
    <p className="receipt-help">Fişin tamamı kadrajda, yazılar net olsun. Toplamı kaydetmeden önce sen kontrol edeceksin.</p>
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden aria-label="Fiş fotoğrafı çek" onChange={(event) => { void scan(event.target.files?.[0]); event.target.value = '' }} />
    <input ref={galleryRef} type="file" accept="image/*" hidden aria-label="Fiş fotoğrafı seç" onChange={(event) => { void scan(event.target.files?.[0]); event.target.value = '' }} />
    {!progress && <div className="receipt-pickers">
      <button type="button" onClick={() => cameraRef.current?.click()}><CameraIcon /> Fotoğraf çek</button>
      <button type="button" onClick={() => galleryRef.current?.click()}>Galeriden seç</button>
    </div>}
    {progress && <div className="receipt-progress" role="status" aria-live="polite">
      <p>{progress.message} <b>{Math.round(progress.percent)}%</b></p>
      <progress value={progress.percent} max={100} aria-label="Fiş okuma ilerlemesi" />
      <small>İlk kullanımda okuma dosyalarının hazırlanması biraz sürebilir.</small>
    </div>}
    {error && <p className="receipt-warning" role="alert">{error}</p>}
    {result && <div className="receipt-review">
      <p className="receipt-review-label">Okunan bilgileri kontrol et</p>
      <dl><div><dt>Mağaza</dt><dd>{result.merchant ?? 'Okunamadı'}</dd></div><div><dt>Tarih</dt><dd>{result.localDate ? new Intl.DateTimeFormat('tr-TR').format(new Date(`${result.localDate}T12:00:00`)) : 'Formdaki tarih korunacak'}</dd></div>
        <div><dt>Kategori</dt><dd>{result.category ?? 'Formdaki kategori korunacak'}</dd></div></dl>
      {result.candidates.length > 0 && <fieldset className="receipt-candidates"><legend>Harcama tutarı</legend>{result.candidates.map((item) => <label key={item.amountMinor} className={chosen === item.amountMinor ? 'is-selected' : ''}>
        <input type="radio" name="receipt-total" checked={chosen === item.amountMinor} onChange={() => setChosen(item.amountMinor)} />
        <span><b>{formatMoney(item.amountMinor)}</b><small>{item.label}</small><small className="receipt-source">{item.source}</small></span>
      </label>)}</fieldset>}
      {result.warnings.map((warning) => <p key={warning} className="receipt-warning">{warning}</p>)}
      {duplicate && <p className="receipt-warning">Bu tarihte aynı tutarlı bir kayıt var. Bu fişi daha önce eklemediğinden emin ol.</p>}
      <details className="receipt-raw"><summary>Okunan fiş metni</summary><pre>{text || 'Yazı okunamadı.'}</pre></details>
      <button type="button" className="primary-action" disabled={chosen === null} onClick={() => chosen !== null && onApply({ ...result, amountMinor: chosen })}>Bilgileri kullan</button>
      {chosen === null && <p className="receipt-help">Tutar seçilmedi. Üstteki seçenekten seç veya “Vazgeç” ile elle gir.</p>}
    </div>}
    <p className="receipt-privacy">Fotoğraf cihazında okunur; sunucuya gönderilmez ve saklanmaz. İlk kullanım internet ister; okuma dosyaları cihazda önbelleğe alınır.</p>
  </section>
}
