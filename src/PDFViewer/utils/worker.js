import * as pdfjsLib from 'pdfjs-dist'
import { resolvedWorkerUrl } from './workerUrl.js'

/**
 * pdf.js needs a worker before any document can be opened, and that worker is a separate
 * file that needs a URL.
 *
 * The package ships its own copy, so nothing is required of the host. Getting there took
 * two false starts worth recording:
 *
 *   1. `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` — Vite library
 *      mode inlines every referenced asset as a base64 data URL regardless of
 *      assetsInlineLimit, so the 1.2 MB worker went into the published bundle and took it
 *      from 36 kB to 1.7 MB. `?url` is also Vite-only, so webpack and Next.js consumers
 *      could not build at all.
 *   2. Requiring `config.workerSrc` from the host. Correct, and small, but it made the
 *      first thing every integrator had to learn a bundler quirk that has nothing to do
 *      with PDFs.
 *
 * What works is a path relative to a module of ours, resolved by the *consumer's*
 * bundler: both Vite and webpack 5 understand `new URL('./x', import.meta.url)`, and
 * neither understands the bare-specifier form needed to point into a dependency. See
 * ./workerUrl.js, which is kept out of our own bundle so the expression survives.
 *
 * Resolution order:
 *   1. `config.workerPort` — a Worker instance the host constructed itself
 *   2. `config.workerSrc`  — a URL string, e.g. a self-hosted copy or a CDN
 *   3. whatever the host already assigned to `pdfjsLib.GlobalWorkerOptions`
 *   4. the copy bundled in this package
 */

let warned = false

/** Where Vite's dep optimizer parks pre-bundled dependencies. */
const OPTIMIZED_DEPS_DIR = '/.vite/deps/'
const PACKAGE_DIST = '/@armsolusi/pdf-viewer/dist/'
const WORKER_FILE = 'pdf.worker.min.js'

/**
 * Undo the relocation Vite's dev server performs on pre-bundled dependencies.
 *
 * In dev, Vite rewrites this package into `node_modules/.vite/deps/`, which moves
 * `import.meta.url` out of the package — and it does not copy the worker along. The
 * relative path then 404s and pdf.js reports the opaque "Setting up fake worker failed".
 * Production builds never hit this: there the bundler rewrites the expression into a real
 * emitted asset, verified against both Vite and webpack.
 *
 * Vite serves node_modules directly, so the package's own copy is reachable. Mapping the
 * cache directory back to it keeps dev working without every consumer having to add
 * `optimizeDeps.exclude`. A layout this does not anticipate falls through unchanged and
 * is explained by describeWorkerFailure() below.
 *
 * @param {string} url
 */
export function correctOptimizedDepUrl(url) {
  const marker = `${OPTIMIZED_DEPS_DIR}${WORKER_FILE}`
  if (!url?.includes(marker)) return url
  return url.replace(marker, `${PACKAGE_DIST}${WORKER_FILE}`)
}

const bundledWorkerUrl = correctOptimizedDepUrl(resolvedWorkerUrl)

/**
 * Point pdf.js at a worker. Safe to call on every render — assignment is idempotent
 * and an explicitly configured worker always wins over the bundled one.
 *
 * @param {object} [options]
 * @param {string} [options.workerSrc] URL of a pdf.js worker to use instead
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

  if (bundledWorkerUrl) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = bundledWorkerUrl
    return
  }

  /*
   * Only reachable if the bundled worker went missing — a stripped `files` entry, an
   * over-eager tree-shake, or a bundler that dropped the asset. Worth a loud message,
   * because the symptom otherwise is a document that simply never loads.
   */
  if (!warned) {
    warned = true
    console.warn(
      '[@armsolusi/pdf-viewer] The bundled pdf.js worker could not be resolved, so the ' +
        'document will fail to load. This should not happen; please report it. As a ' +
        'workaround, pass a worker URL yourself:\n\n' +
        "  import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'   // Vite\n" +
        '  <PDFViewer src={url} config={{ workerSrc }} />'
    )
  }
}

/**
 * Turn a worker-loading failure into something a developer can act on.
 *
 * pdf.js reports these as "Setting up fake worker failed: error loading dynamically
 * imported module: …", which names neither the cause nor a fix. There are only two real
 * causes, and they are told apart by whether the URL 404s:
 *
 *   - the file is not there — a bundler moved our module without bringing the worker
 *     along, Vite's dev optimizer being the usual culprit
 *   - the file is there but served with the wrong Content-Type, so the browser refuses to
 *     execute it as a module
 *
 * Both were found in the field, and the second is the one this message used to send people
 * the wrong way: it blamed Vite while the actual problem was nginx serving the worker as
 * `application/octet-stream`.
 *
 * Returns the original message unchanged for any other load error, so a 404 on the
 * document itself still reads as a 404.
 */
export function describeWorkerFailure(error) {
  const message = error?.message ?? ''
  if (!/fake worker|worker/i.test(message)) return message

  return (
    `${message}\n\n` +
    "The pdf.js worker shipped with @armsolusi/pdf-viewer could not be loaded. Open that " +
    'URL directly and check two things:\n\n' +
    '  1. Does it return the file, or a 404? If it 404s and you are on the Vite dev ' +
    "server, add optimizeDeps: { exclude: ['@armsolusi/pdf-viewer'] } to vite.config.js.\n" +
    '  2. What Content-Type does it come back with? It must be a JavaScript type. Servers ' +
    'that answer application/octet-stream — nginx does this for extensions it does not ' +
    'recognise — make the browser refuse to run it.\n\n' +
    'Failing both, serve a copy yourself and pass it as config.workerSrc.'
  )
}
