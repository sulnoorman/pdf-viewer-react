/*
 * The URLs of the pdf.js runtime assets that ship inside this package.
 *
 * This file is deliberately NOT bundled. It is marked external in vite.config.js and
 * copied into dist/ verbatim, next to the assets themselves, for two reasons:
 *
 *  1. Vite library mode resolves `new URL(…, import.meta.url)` at OUR build time and
 *     inlines the target as a base64 data URL, ignoring assetsInlineLimit. That is the
 *     bug that once took the published bundle from 36 kB to 1.7 MB.
 *  2. Left alone, the expression is resolved by the CONSUMER's bundler instead — and
 *     because the path is relative to this file rather than a bare `pdfjs-dist/…`
 *     specifier, both Vite and webpack 5 understand it. There is no portable way to
 *     ask a bundler for the URL of a file inside a *dependency*, which is why the host
 *     used to have to supply `workerSrc` itself.
 *
 * ## Why every file is named, rather than the directory it lives in
 *
 * A bundler emits a **file** it sees referenced here, copying it into the application's
 * build output and rewriting the URL to match — usually with a content hash, as
 * `pdf.worker.min-DEtVeC4l.js`. A **directory** it can do nothing with: there is no file
 * to emit, so nothing is copied and the URL points at a folder that never existed.
 *
 * That shipped once. `new URL('./wasm/', import.meta.url)` worked in development, where
 * the dev server serves node_modules directly, and failed in every production build —
 * pdf.js asked for the wasm, the server answered with index.html, and a scanned logo
 * rendered as a solid black rectangle.
 *
 * The hashing is why the directory cannot simply be derived from one emitted file either:
 * pdf.js appends the plain filename to a base URL, which would miss `jbig2-a1b2c3.wasm`
 * entirely. utils/binaryData.js resolves each name through this map instead.
 *
 * The worker must be the exact version of the pdf.js API in use — pdf.js throws on a
 * mismatch — which is why package.json pins `pdfjs-dist` to an exact version rather
 * than a range. scripts/copy-worker.mjs copies all of it from that pinned install.
 */
/*
 * Deliberately no logic — no branches, no helpers, nothing that could behave differently
 * in a consumer's app than it does here.
 *
 * Note the worker's `.js` extension: pdfjs-dist ships it as `.mjs`, and it is copied under
 * a different name on purpose. A great many web servers — nginx among them — have no MIME
 * mapping for `.mjs` and serve it as `application/octet-stream`, which browsers refuse to
 * execute as a module. The symptom is pdf.js reporting "Setting up fake worker failed" in
 * production only, on a file that downloads perfectly.
 *
 * This module is not bundled and not covered by unit tests — everything it could get
 * wrong would only surface in a consumer's app. Correcting these URLs belongs in
 * ./worker.js, which is bundled and tested; see correctOptimizedDepUrl there.
 */
export const resolvedWorkerUrl = new URL('./pdf.worker.min.js', import.meta.url).href

/**
 * Every decoder and font file, keyed by the name pdf.js asks for.
 *
 * pdf.js requests these by bare filename — `jbig2.wasm`, `FoxitSerif.pfb` — so the key is
 * the lookup and the value is wherever the consumer's bundler actually put it.
 *
 * Only fetched by a document that needs one: the wasm for CCITT, JBIG2 or JPEG 2000
 * images and ICC colour, a font file for a standard font a document declined to embed.
 * They are emitted into the build regardless, because a bundler decides what to copy at
 * build time and cannot know which documents an application will open.
 */
export const resolvedAssetUrls = {
  'jbig2.wasm': new URL('./wasm/jbig2.wasm', import.meta.url).href,
  'openjpeg.wasm': new URL('./wasm/openjpeg.wasm', import.meta.url).href,
  'qcms_bg.wasm': new URL('./wasm/qcms_bg.wasm', import.meta.url).href,

  'FoxitDingbats.pfb': new URL('./standard_fonts/FoxitDingbats.pfb', import.meta.url).href,
  'FoxitFixed.pfb': new URL('./standard_fonts/FoxitFixed.pfb', import.meta.url).href,
  'FoxitFixedBold.pfb': new URL('./standard_fonts/FoxitFixedBold.pfb', import.meta.url).href,
  'FoxitFixedBoldItalic.pfb': new URL('./standard_fonts/FoxitFixedBoldItalic.pfb', import.meta.url).href,
  'FoxitFixedItalic.pfb': new URL('./standard_fonts/FoxitFixedItalic.pfb', import.meta.url).href,
  'FoxitSerif.pfb': new URL('./standard_fonts/FoxitSerif.pfb', import.meta.url).href,
  'FoxitSerifBold.pfb': new URL('./standard_fonts/FoxitSerifBold.pfb', import.meta.url).href,
  'FoxitSerifBoldItalic.pfb': new URL('./standard_fonts/FoxitSerifBoldItalic.pfb', import.meta.url).href,
  'FoxitSerifItalic.pfb': new URL('./standard_fonts/FoxitSerifItalic.pfb', import.meta.url).href,
  'FoxitSymbol.pfb': new URL('./standard_fonts/FoxitSymbol.pfb', import.meta.url).href,
  'LiberationSans-Bold.ttf': new URL('./standard_fonts/LiberationSans-Bold.ttf', import.meta.url).href,
  'LiberationSans-BoldItalic.ttf': new URL('./standard_fonts/LiberationSans-BoldItalic.ttf', import.meta.url).href,
  'LiberationSans-Italic.ttf': new URL('./standard_fonts/LiberationSans-Italic.ttf', import.meta.url).href,
  'LiberationSans-Regular.ttf': new URL('./standard_fonts/LiberationSans-Regular.ttf', import.meta.url).href,
}
