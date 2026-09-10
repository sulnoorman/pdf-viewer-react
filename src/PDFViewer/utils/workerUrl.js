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
 * The worker must be the exact version of the pdf.js API in use — pdf.js throws on a
 * mismatch — which is why package.json pins `pdfjs-dist` to an exact version rather
 * than a range. scripts/copy-worker.mjs copies the worker from that pinned install.
 */
/*
 * Deliberately one line and no logic.
 *
 * Note the `.js` extension: pdfjs-dist ships this file as `.mjs`, and it is copied under a
 * different name on purpose. A great many web servers — nginx among them — have no MIME
 * mapping for `.mjs` and serve it as `application/octet-stream`, which browsers refuse to
 * execute as a module. The symptom is pdf.js reporting "Setting up fake worker failed" in
 * production only, on a file that downloads perfectly. `.js` is served correctly
 * everywhere, and the extension has no bearing on the contents being an ES module.
 *
 * This module is not bundled and not covered by unit tests — everything it could get
 * wrong would only surface in a consumer's app. Correcting the URL is worth doing but
 * belongs in ./worker.js, which is bundled and tested; see correctOptimizedDepUrl there.
 */
export const resolvedWorkerUrl = new URL('./pdf.worker.min.js', import.meta.url).href

/*
 * pdf.js's image decoders and standard font data, as directories.
 *
 * **The trailing slash is load-bearing.** pdf.js concatenates these with a filename and no
 * separator — `${wasmUrl}${filename}` — so dropping it asks the server for `distjbig2.wasm`.
 * The failure this whole thing exists to fix announced itself exactly that way: with no
 * `wasmUrl` set at all, pdf.js reported `Cannot find package 'nulljbig2_nowasm_fallback.js'`.
 *
 * Both point at directories rather than files because pdf.js chooses which member to fetch:
 * `jbig2.wasm` for CCITT and JBIG2 images, `openjpeg.wasm` for JPEG 2000, `qcms_bg.wasm` for
 * ICC colour, and one font file per standard font a document leaves unembedded. Nothing is
 * fetched by a document that does not need it.
 */
export const resolvedWasmUrl = new URL('./wasm/', import.meta.url).href
export const resolvedStandardFontDataUrl = new URL('./standard_fonts/', import.meta.url).href
