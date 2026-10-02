# Local receipt scanning

The camera button in the existing expense editor offers rear-camera capture and
gallery selection. It prepares a bounded image, reads it in a dedicated local
worker, and presents a review. Nothing is saved until the user applies the values
and then explicitly saves the expense. Budget account is never inferred or changed.
Existing form content remains untouched until review is accepted. Existing notes
are preserved and the merchant is appended within the existing 180-character limit.

Images and extracted text stay in memory; only the confirmed expense fields are
stored. No API, analytics, upload or third-party OCR endpoint is involved. Initial
use downloads versioned worker/core/language files from this app's own origin.
The PWA caches these on demand, with separate IndexedDB language caching, so repeat
scans work offline while those caches remain. Initial app installation does not
precache multi-megabyte OCR files. Browser storage eviction can require download again.

## Interpretation safeguards

- Prefer payable/grand total, then receipt total. Never select the largest number.
- Exclude item prices, subtotal, tax-only totals, discounts, tendered-cash labels,
  change, card numbers, date/time, refund/cancellation documents and foreign totals.
- Validate against cash/card payment lines and change; ambiguous or contradictory
  totals require explicit selection. Payment-only slips require selection too.
- Validate calendar dates, rejecting future/invalid/ambiguous dates. Missing date
  or category leaves the corresponding form field unchanged.
- Category hints only target existing configured categories; no schema change.
- Same amount/date/account yields a possible-duplicate warning, not automatic deletion.
- Photos can be blurry or misread even when a total is found. Review is mandatory;
  this is not a guarantee of accurate OCR. Manual entry is always available.

## Worker lifecycle and updates

`scripts/prepare-ocr.mjs` copies assets from the locked npm dependencies before dev
and production builds. `public/ocr/` is generated and ignored by Git. The unused
Tesseract funding-message postinstall is explicitly denied in `pnpm-workspace.yaml`.

`receiptOcr.ts` uses the pinned Tesseract.js 7.0.0 native worker message protocol
(the same sequence and payloads as its `src/createWorker.js`). This intentionally
owns the worker handle before initialization, allowing immediate termination on
cancel, close, timeout and unmount, including while downloading models. Do not
upgrade Tesseract or change the protocol without real browser/WASM verification.
All workers terminate after each scan to bound Safari memory use. Image dimensions
are limited to 2200px / 4 megapixels, and file size to 20 MB. HEIC decoding depends
on the browser; a failed decode suggests JPEG/PNG or another camera capture.

## Checks

Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `pnpm build`.
Parser fixtures cover Turkish/English decimals, split payment, tax, change,
ambiguous totals, refunds, foreign currency, missing total, merchant/category,
and valid/invalid dates. CI checks that all on-device OCR assets reach the artifact.

Browser QA must use actual bundled worker/WASM, not mocked OCR: test a controlled
image containing grand total 1057.90, cash 1100.00, change 42.10; review/apply/save;
conflicting totals 150.00/160.00; no total; undecodable image; cancellation during
initialization; duplicate warning; unchanged account/manual input; no upload or
third-party requests; and a repeat scan with the production PWA offline. Check
402×874, 440×956, 320×568 and a reduced keyboard viewport in WebKit and Chromium.
These are browser emulations and synthetic fixtures, not physical-iPhone or
real-world receipt accuracy claims. Physical phone/camera capture still needs a
user smoke test after deployment. Updating the main PWA must preserve its existing
`budget00` database and normal date; do not substitute the separate demo database.
