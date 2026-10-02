export interface ReceiptProgress { readonly percent: number; readonly message: string }

const cancelled = () => new DOMException('Fiş okuma iptal edildi.', 'AbortError')

async function prepareImage(file: File, signal: AbortSignal): Promise<Uint8Array> {
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Fotoğraf 20 MB’den küçük olmalı.')
  if (file.type && !file.type.startsWith('image/')) throw new Error('Bir fiş fotoğrafı seç; PDF bu ekranda desteklenmiyor.')
  const url = URL.createObjectURL(file)
  const image = new Image()
  const canvas = document.createElement('canvas')
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () => { image.src = ''; reject(cancelled()) }
      signal.addEventListener('abort', abort, { once: true })
      const finish = (error?: Error) => {
        signal.removeEventListener('abort', abort)
        image.onload = null; image.onerror = null
        error ? reject(error) : resolve()
      }
      image.onload = () => finish()
      image.onerror = () => finish(new Error('Fotoğraf açılamadı. JPEG/PNG kullan veya kamerayla tekrar çek.'))
      if (signal.aborted) abort()
      else image.src = url
    })
    if (signal.aborted) throw cancelled()
    if (Math.min(image.naturalWidth, image.naturalHeight) < 100) throw new Error('Fotoğraf çok küçük. Fişi daha yakından ve net çek.')
    const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight), Math.sqrt(4_000_000 / (image.naturalWidth * image.naturalHeight)))
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Bu cihazda fotoğraf hazırlanamadı.')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < pixels.data.length; i += 4) {
      const gray = (pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114 - 128) * 1.1 + 128
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray
    }
    context.putImageData(pixels, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Fotoğraf hazırlanamadı.')), 'image/png'))
    if (signal.aborted) throw cancelled()
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
    image.src = ''
    canvas.width = canvas.height = 0
  }
}

/**
 * Tesseract.js 7.0.0's pinned worker protocol (see createWorker.js). Owning the
 * native Worker directly lets cancellation terminate even during model setup;
 * createWorker() exposes terminate only after initialization completes.
 * Keep the real browser/WASM integration test when upgrading the pinned version.
 */
export async function readReceipt(file: File, signal: AbortSignal, onProgress: (progress: ReceiptProgress) => void): Promise<string> {
  if (signal.aborted) throw cancelled()
  const base = new URL(`${import.meta.env.BASE_URL}ocr/v1/`, window.location.origin).href
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 90_000)
  let worker: Worker | null = null
  let progress = 0
  const report = (percent: number, message: string) => {
    progress = Math.max(progress, Math.min(99, percent))
    if (!controller.signal.aborted) onProgress({ percent: progress, message })
  }
  try {
    report(2, 'Fotoğraf hazırlanıyor…')
    const image = await prepareImage(file, controller.signal)
    if (controller.signal.aborted) throw cancelled()
    worker = new Worker(`${base}worker.min.js`, { name: 'dailycap-receipt' })
    const activeWorker = worker
    let sequence = 0
    const job = (action: string, payload: object): Promise<{ text?: string }> => new Promise((resolve, reject) => {
      const jobId = `receipt-${++sequence}`
      const clean = () => {
        activeWorker.removeEventListener('message', message)
        activeWorker.removeEventListener('error', error)
        activeWorker.removeEventListener('messageerror', error)
        controller.signal.removeEventListener('abort', stopped)
      }
      const stopped = () => { clean(); activeWorker.terminate(); reject(cancelled()) }
      const error = () => { clean(); reject(new Error('Fiş okuyucu açılamadı. İlk kullanımda internet gerekir; tekrar dene.')) }
      const message = (event: MessageEvent) => {
        const response = event.data
        if (response.jobId !== jobId) return
        if (response.status === 'progress') {
          const fraction = Math.max(0, Math.min(1, Number(response.data.progress) || 0))
          if (action === 'load') report(5 + fraction * 15, 'Fiş okuyucu hazırlanıyor…')
          if (action === 'loadLanguage') report(20 + fraction * 20, 'Türkçe okuma hazırlanıyor…')
          if (action === 'initialize') report(40 + fraction * 5, 'Okuma başlatılıyor…')
          if (action === 'recognize') report(45 + fraction * 54, 'Fişteki yazılar okunuyor…')
        } else {
          clean()
          response.status === 'resolve' ? resolve(response.data) : reject(new Error('Fiş okunamadı. İnterneti kontrol et veya daha net bir fotoğrafla tekrar dene.'))
        }
      }
      activeWorker.addEventListener('message', message)
      activeWorker.addEventListener('error', error)
      activeWorker.addEventListener('messageerror', error)
      controller.signal.addEventListener('abort', stopped, { once: true })
      if (controller.signal.aborted) stopped()
      else activeWorker.postMessage({ workerId: 'dailycap-receipt', jobId, action, payload })
    })
    await job('load', { options: { lstmOnly: true, corePath: `${base}core`, logging: false } })
    await job('loadLanguage', { langs: 'tur+eng', options: { langPath: `${base}lang`, cachePath: 'dailycap-receipt-v1', cacheMethod: 'write', gzip: true, lstmOnly: true } })
    await job('initialize', { langs: 'tur+eng', oem: 1, config: {} })
    await job('setParameters', { params: { tessedit_pageseg_mode: '4', preserve_interword_spaces: '1', user_defined_dpi: '300' } })
    const result = await job('recognize', { image, options: { rotateAuto: true }, output: { text: true } })
    return result.text ?? ''
  } catch (error) {
    if (timedOut) throw new Error('Okuma çok uzun sürdü. Daha yakın ve net bir fotoğrafla tekrar dene.')
    throw error
  } finally {
    worker?.terminate()
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}
