/*
 * The URL of the pdf.js worker that ships inside this package.
 *
 * This file is deliberately NOT bundled. It is marked external in vite.config.js and
 * copied into dist/ verbatim, next to the worker itself, for two reasons:
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
 * The worker must be the exact version of the pdf.js API in use — pdf.js throws on a
 * mismatch — which is why package.json pins `pdfjs-dist` to an exact version rather
 * than a range. scripts/copy-worker.mjs copies the worker from that pinned install.
 */
/*
 * Deliberately one line and no logic.
 *
 * This module is not bundled and not covered by unit tests — everything it could get
 * wrong would only surface in a consumer's app. Correcting the URL is worth doing but
 * belongs in ./worker.js, which is bundled and tested; see correctOptimizedDepUrl there.
 */
export const resolvedWorkerUrl = new URL('./pdf.worker.min.mjs', import.meta.url).href
