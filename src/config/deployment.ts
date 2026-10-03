export function getDeploymentPaths(vercel?: string) {
  const base = vercel === '1' ? '/' : '/budget00/'
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return {
    base,
    navigateFallback: `${base}index.html`,
    navigateFallbackDenylist: [new RegExp(`^${escapedBase}deneme(?:/|\\?|$)`)],
    // Workbox serializes this RegExp into the service worker, so it must not
    // capture config-time variables in a callback. A pathname-only match also
    // keeps RegExpRoute same-origin: cross-origin matches must start at index 0.
    ocrRuntimePattern: new RegExp(`${escapedBase}ocr/v1/`),
  }
}
