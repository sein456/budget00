import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { SettingsDraft } from '../../app/useBudgetData'
import { parseBudgetBackup } from '../../db/backup'
import { formatMonth } from '../../domain/displayDate'
import { minorToInputValue, parseMoneyInputToMinor } from '../../domain/money'
import type { AppSettings, LocalMonth, MonthlyPlan, ThemePreference } from '../../domain/models'
import { ActionIcon } from '../ActionIcon'

interface SettingsScreenProps {
  readonly currentMonth: LocalMonth
  readonly personalPlan: MonthlyPlan
  readonly multinetPlan: MonthlyPlan
  readonly settings: AppSettings
  readonly onSave: (draft: SettingsDraft) => Promise<void>
  readonly onExport: () => Promise<string>
  readonly onImport: (json: string) => Promise<void>
  readonly onReset: () => Promise<void>
}

export function SettingsScreen({
  currentMonth,
  personalPlan,
  multinetPlan,
  settings,
  onSave,
  onExport,
  onImport,
  onReset,
}: SettingsScreenProps) {
  const [personalLimit, setPersonalLimit] = useState(minorToInputValue(personalPlan.limitMinor))
  const [multinetLimit, setMultinetLimit] = useState(minorToInputValue(multinetPlan.limitMinor))
  const [categories, setCategories] = useState<string[]>([...settings.categories])
  const [theme, setTheme] = useState<ThemePreference>(settings.theme)
  const [newCategory, setNewCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dataBusy, setDataBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [dataMessage, setDataMessage] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPersonalLimit(minorToInputValue(personalPlan.limitMinor))
    setMultinetLimit(minorToInputValue(multinetPlan.limitMinor))
    setCategories([...settings.categories])
    setTheme(settings.theme)
  }, [multinetPlan.limitMinor, personalPlan.limitMinor, settings])

  const addCategory = () => {
    const category = newCategory.trim()

    if (!category || categories.some((item) => item.toLocaleLowerCase('tr') === category.toLocaleLowerCase('tr'))) {
      return
    }

    setCategories((current) => [...current, category])
    setNewCategory('')
    setSaved(false)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const personalLimitMinor = parseMoneyInputToMinor(personalLimit)
    const multinetLimitMinor = parseMoneyInputToMinor(multinetLimit)

    if (personalLimitMinor === null || multinetLimitMinor === null) {
      setFormError('Bütçe tutarları sıfır veya daha büyük olmalıdır.')
      return
    }
    if (categories.length === 0) {
      setFormError('En az bir kategori bulunmalıdır.')
      return
    }

    setSaving(true)
    setSaved(false)
    setFormError(null)
    try {
      await onSave({ personalLimitMinor, multinetLimitMinor, categories, theme })
      setSaved(true)
    } catch {
      setFormError('Ayarlar kaydedilemedi. Lütfen tekrar dene.')
    } finally {
      setSaving(false)
    }
  }

  const exportData = async () => {
    setDataBusy(true)
    setDataMessage(null)
    try {
      const json = await onExport()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `budget00-yedek-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      setDataMessage('Yedek dosyası indirildi.')
    } catch (cause) {
      setDataMessage(cause instanceof Error ? cause.message : 'Yedek oluşturulamadı.')
    } finally {
      setDataBusy(false)
    }
  }

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setDataBusy(true)
    setDataMessage(null)
    try {
      const json = await file.text()
      const backup = parseBudgetBackup(json)
      const approved = window.confirm(
        `${backup.data.transactions.length} işlem içeren bu yedek mevcut verilerin üzerine yazılacak. Devam edilsin mi?`,
      )

      if (!approved) {
        setDataMessage('İçe aktarma iptal edildi.')
        return
      }

      await onImport(json)
      setDataMessage('Yedek doğrulandı ve geri yüklendi.')
    } catch (cause) {
      setDataMessage(cause instanceof Error ? cause.message : 'Dosya içe aktarılamadı.')
    } finally {
      setDataBusy(false)
    }
  }

  const resetData = async () => {
    const approved = window.confirm(
      'Tüm bütçeler, işlemler ve ayarlar kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?',
    )

    if (!approved) {
      return
    }

    setDataBusy(true)
    setDataMessage(null)
    try {
      await onReset()
      setDataMessage('Tüm veriler sıfırlandı.')
    } catch (cause) {
      setDataMessage(cause instanceof Error ? cause.message : 'Veriler sıfırlanamadı.')
    } finally {
      setDataBusy(false)
    }
  }

  return (
    <div className="screen secondary-screen">
      <header className="screen-header">
        <p className="eyebrow">Kişiselleştir</p>
        <h1>Ayarlar</h1>
        <p>{formatMonth(currentMonth)} bütçelerini ve uygulama tercihlerini yönet.</p>
      </header>

      <form className="settings-form" onSubmit={submit}>
        <section className="settings-card">
          <div className="settings-section-title">
            <span className="settings-icon">₺</span>
            <div>
              <h2>Aylık bütçeler</h2>
              <p>Bu ay için ayrı limitler</p>
            </div>
          </div>
          <label className="field-group">
            <span>Kişisel aylık bütçe</span>
            <div className="money-input">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                enterKeyHint="next"
                value={personalLimit}
                onChange={(event) => {
                  setPersonalLimit(event.target.value)
                  setSaved(false)
                }}
              />
              <b>TRY</b>
            </div>
          </label>
          <label className="field-group">
            <span>Multinet aylık bütçe</span>
            <div className="money-input">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                enterKeyHint="done"
                value={multinetLimit}
                onChange={(event) => {
                  setMultinetLimit(event.target.value)
                  setSaved(false)
                }}
              />
              <b>TRY</b>
            </div>
          </label>
        </section>

        <section className="settings-card">
          <div className="settings-section-title">
            <span className="settings-icon">#</span>
            <div>
              <h2>Kategoriler</h2>
              <p>Harcama eklerken kullanılır</p>
            </div>
          </div>
          <div className="category-list">
            {categories.map((category) => (
              <span className="category-chip" key={category} title={category}>
                <span>{category}</span>
                <button
                  type="button"
                  aria-label={`${category} kategorisini kaldır`}
                  onClick={() => {
                    setCategories((current) => current.filter((item) => item !== category))
                    setSaved(false)
                  }}
                >
                  <ActionIcon />
                </button>
              </span>
            ))}
          </div>
          <div className="add-category-row">
            <input
              type="text"
              value={newCategory}
              maxLength={40}
              enterKeyHint="done"
              placeholder="Yeni kategori"
              onChange={(event) => setNewCategory(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addCategory()
                }
              }}
            />
            <button type="button" onClick={addCategory}>Ekle</button>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-section-title">
            <span className="settings-icon">◐</span>
            <div>
              <h2>Görünüm</h2>
              <p>Sana uygun temayı seç</p>
            </div>
          </div>
          <div className="theme-options" role="radiogroup" aria-label="Tema tercihi">
            {([
              ['system', 'Otomatik'],
              ['light', 'Açık'],
              ['dark', 'Koyu'],
            ] as const).map(([value, label]) => (
              <label className={theme === value ? 'active' : ''} key={value}>
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => {
                    setTheme(value)
                    setSaved(false)
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-card currency-card">
          <div>
            <span>Para birimi</span>
            <small>Türk lirası</small>
          </div>
          <strong>{settings.currency}</strong>
        </section>

        {formError && <p className="form-message error" role="alert">{formError}</p>}
        {saved && <p className="form-message success" role="status">Ayarlar kaydedildi.</p>}

        <button className="primary-action settings-save" type="submit" disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Ayarları Kaydet'}
        </button>
      </form>

      <section className="settings-card data-management-card">
        <div className="settings-section-title">
          <span className="settings-icon">↕</span>
          <div>
            <h2>Veri yönetimi</h2>
            <p>Yerel verilerini yedekle veya geri yükle</p>
          </div>
        </div>
        <div className="data-actions">
          <button type="button" disabled={dataBusy} onClick={() => void exportData()}>
            <span aria-hidden="true">↓</span>
            <div><b>Yedeği indir</b><small>Verilerini bir dosyada sakla</small></div>
          </button>
          <button
            type="button"
            disabled={dataBusy}
            onClick={() => importInputRef.current?.click()}
          >
            <span aria-hidden="true">↑</span>
            <div><b>Yedeği geri yükle</b><small>Kayıtlı bir yedek dosyası seç</small></div>
          </button>
          <button
            className="danger"
            type="button"
            disabled={dataBusy}
            onClick={() => void resetData()}
          >
            <span aria-hidden="true"><ActionIcon kind="delete" /></span>
            <div><b>Tüm verileri sıfırla</b><small>Bu işlem geri alınamaz</small></div>
          </button>
        </div>
        <input
          ref={importInputRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importData(event)}
        />
        {dataMessage && <p className="data-message" role="status">{dataMessage}</p>}
      </section>
    </div>
  )
}
