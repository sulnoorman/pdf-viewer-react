import * as pdfjsLib from 'pdfjs-dist'

/**
 * pdf.js needs a worker before any document can be opened, and the URL of that
 * worker depends entirely on the host app's bundler. The library therefore never
 * imports the worker itself.
 *
 * The previous approach — `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`
 * — had two serious problems:
 *   1. Vite library mode inlines every referenced asset as a data URL regardless of
 *      assetsInlineLimit, so the 1.25 MB worker was base64-encoded into the published
 *      bundle, taking it from ~100 KB to 1.7 MB.
 *   2. `?url` is a Vite-only suffix; consumers on webpack, Next.js or Rspack failed
 *      to build at all.
 *
 * Resolution order:
 *   1. `config.workerPort` — a Worker instance the host constructed itself
 *   2. `config.workerSrc`  — a URL string
 *   3. whatever the host already assigned to `pdfjsLib.GlobalWorkerOptions`
 *   4. nothing: warn once with actionable instructions
 */

const DOCS_URL = 'https://github.com/sulnoorman/pdf-viewer-react#pdfjs-worker'

let warned = false

/**
 * Point pdf.js at a worker. Safe to call on every render — assignment is idempotent
 * and an explicitly configured worker always wins over a previous fallback.
 *
 * @param {object} [options]
 * @param {string} [options.workerSrc] URL of pdfjs-dist/build/pdf.worker.min.mjs
 * @param {Worker} [options.workerPort] a pre-constructed Worker instance
 */
export function configureWorker({ workerSrc, workerPort } = {}) {
  if (workerPort) {
    if (pdfjsLib.GlobalWorkerOptions.workerPort !== workerPort) {
      pdfjsLib.GlobalWorkerOptions.workerPort = workerPort
    }
    return
  }

  if (workerSrc) {
    if (pdfjsLib.GlobalWorkerOptions.workerSrc !== workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
    }
    return
  }

  // Host may have configured pdf.js globally before mounting the viewer.
  if (pdfjsLib.GlobalWorkerOptions.workerSrc || pdfjsLib.GlobalWorkerOptions.workerPort) return

  if (!warned) {
    warned = true
    console.warn(
      '[react-pdf-viewer-stamping] No pdf.js worker configured — the document will fail to load.\n' +
        'Pass one via the `workerSrc` config key, for example:\n\n' +
        "  import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'   // Vite\n" +
        '  <PDFViewer src={url} config={{ workerSrc }} />\n\n' +
        `See ${DOCS_URL}`
    )
  }
}
