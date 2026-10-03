import { describe, expect, it } from 'vitest'
import { getDeploymentPaths } from './deployment'

describe('deployment base and PWA paths', () => {
  it('uses the root on Vercel', () => {
    const paths = getDeploymentPaths('1')
    expect(paths.base).toBe('/')
    expect(paths.navigateFallback).toBe('/index.html')
  })

  it.each([undefined, '', '0', 'false'])('preserves GitHub Pages when VERCEL is %s', (flag) => {
    const paths = getDeploymentPaths(flag)
    expect(paths.base).toBe('/budget00/')
    expect(paths.navigateFallback).toBe('/budget00/index.html')
  })

  it.each(['1', undefined])('excludes the separate demo under the same base (%s)', (flag) => {
    const paths = getDeploymentPaths(flag)
    const deny = paths.navigateFallbackDenylist[0]
    expect(deny.test(`${paths.base}deneme`)).toBe(true)
    expect(deny.test(`${paths.base}deneme/`)).toBe(true)
    expect(deny.test(`${paths.base}deneme?test=1`)).toBe(true)
    expect(deny.test(`${paths.base}deneme/page`)).toBe(true)
    expect(deny.test(`${paths.base}deneme-other`)).toBe(false)
    expect(deny.test(`${paths.base}index.html`)).toBe(false)
  })

  it.each(['1', undefined])('caches OCR paths without capturing config variables (%s)', (flag) => {
    const paths = getDeploymentPaths(flag)
    const pattern = new RegExp(paths.ocrRuntimePattern.source)
    expect(pattern.test(`https://app.example${paths.base}ocr/v1/worker.min.js`)).toBe(true)
    expect(pattern.test(`https://app.example${paths.base}ocr/v1/core/tesseract-core-lstm.wasm.js`)).toBe(true)
    expect(pattern.test(`https://app.example${paths.base}ocr/v1/lang/tur.traineddata.gz`)).toBe(true)
    expect(pattern.test(`https://app.example${paths.base}ocr/v2/worker.min.js`)).toBe(false)
    // RegExpRoute rejects cross-origin matches whose index is not zero.
    expect(pattern.exec(`https://other.example${paths.base}ocr/v1/worker.min.js`)?.index).toBeGreaterThan(0)
  })
})
