import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import './PwaUpdatePrompt.css'

interface PwaUpdatePromptProps {
  readonly canUpdate: boolean
}

type UpdateServiceWorker = ReturnType<typeof registerSW>

export function PwaUpdatePrompt({ canUpdate }: PwaUpdatePromptProps) {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateServiceWorker, setUpdateServiceWorker] =
    useState<UpdateServiceWorker | null>(null)

  useEffect(() => {
    let registration: ServiceWorkerRegistration | undefined
    const checkForUpdate = () => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        void registration?.update().catch(() => {
          // Keep the offline version usable; retry on the next foreground event.
        })
      }
    }
    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW: (_url, registered) => {
        registration = registered
        checkForUpdate()
      },
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => {
        setOfflineReady(true)
        window.setTimeout(() => setOfflineReady(false), 4_000)
      },
      onRegisterError: (error) => {
        console.error('Service worker kaydı başarısız oldu', error)
      },
    })

    setUpdateServiceWorker(() => updateSW)
    document.addEventListener('visibilitychange', checkForUpdate)
    window.addEventListener('online', checkForUpdate)
    window.addEventListener('focus', checkForUpdate)
    return () => {
      document.removeEventListener('visibilitychange', checkForUpdate)
      window.removeEventListener('online', checkForUpdate)
      window.removeEventListener('focus', checkForUpdate)
    }
  }, [])

  if (needRefresh && canUpdate) {
    const applyUpdate = async () => {
      if (!updateServiceWorker || updating) {
        return
      }

      setUpdating(true)

      try {
        await updateServiceWorker(true)
      } catch (error) {
        console.error('Uygulama güncellenemedi', error)
        setUpdating(false)
      }
    }

    return (
      <aside className="pwa-update-prompt" role="status" aria-live="polite">
        <div>
          <strong>Yeni sürüm hazır</strong>
          <span>Güncelleme sen istediğinde uygulanır.</span>
        </div>
        <button type="button" disabled={updating} onClick={() => void applyUpdate()}>
          {updating ? 'Güncelleniyor…' : 'Güncelle'}
        </button>
      </aside>
    )
  }

  if (offlineReady) {
    return (
      <div className="pwa-offline-ready" role="status" aria-live="polite">
        Çevrimdışı kullanım hazır
      </div>
    )
  }

  return null
}
