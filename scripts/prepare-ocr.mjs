import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { copyFile, mkdir, readdir } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const tessDir = dirname(require.resolve('tesseract.js/package.json'))
const tessRequire = createRequire(join(tessDir, 'package.json'))
const coreDir = dirname(tessRequire.resolve('tesseract.js-core/package.json'))
const target = resolve(import.meta.dirname, '../public/ocr/v1')
await mkdir(join(target, 'core'), { recursive: true })
await mkdir(join(target, 'lang'), { recursive: true })
await copyFile(join(tessDir, 'dist/worker.min.js'), join(target, 'worker.min.js'))
await copyFile(join(tessDir, 'LICENSE.md'), join(target, 'LICENSE-tesseract.md'))
for (const name of await readdir(coreDir)) {
  if (/^tesseract-core.*\.wasm(?:\.js)?$/.test(name) || /^LICENSE/.test(name)) {
    await copyFile(join(coreDir, name), join(target, 'core', name))
  }
}
for (const lang of ['tur', 'eng']) {
  const langDir = dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`))
  await copyFile(join(langDir, `4.0.0_best_int/${lang}.traineddata.gz`), join(target, 'lang', `${lang}.traineddata.gz`))
}
console.log('Receipt OCR assets ready (local worker, core and Turkish/English models).')
