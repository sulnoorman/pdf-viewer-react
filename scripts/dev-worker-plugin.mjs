import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { resolve, dirname, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * pdfjs-dist ships the worker as `.mjs`; it is served and copied as `.js`.
 *
 * Many web servers — nginx among them — have no MIME mapping for `.mjs` and serve it as
 * `application/octet-stream`, which browsers refuse to execute as a module. That failed in
 * production only, on a file that downloaded perfectly. See src/PDFViewer/utils/workerUrl.js.
 */
const SOURCE_WORKER = 'pdf.worker.min.mjs'
const WORKER_FILE = 'pdf.worker.min.js'
const WORKER = resolve(root, 'node_modules/pdfjs-dist/build', SOURCE_WORKER)

/**
 * Make the pdf.js worker reachable to anything running this repo's *source*.
 *
 * `src/PDFViewer/utils/workerUrl.js` points at `./pdf.worker.min.mjs`, which is true of
 * the published package — scripts/copy-worker.mjs puts both files side by side in dist/.
 * It is not true of src/, where the worker has no business living: a 1.2 MB binary in
 * version control purely so a dev server can find it.
 *
 * So the demo app and Storybook cannot resolve it, and both fail unhelpfully. The dev
 * server answers unknown paths with index.html, so the browser complains about a MIME
 * type rather than a missing file; a build emits no asset at all, leaving a dangling URL
 * in a site that otherwise builds "successfully".
 *
 * Two hooks because Vite consults neither `resolveId` nor `load` for
 * `new URL(…, import.meta.url)` — verified, not assumed — so the file has to be supplied
 * at each end instead: served directly in dev, emitted beside the chunk in a build.
 *
 * None of this concerns the published package, which is why it lives in scripts/.
 */
export function devWorkerPlugin() {
  let assetsDir = 'assets'
  let isLibraryBuild = false

  return {
    name: 'rpvs-dev-worker',

    configResolved(config) {
      assetsDir = config.build?.assetsDir ?? 'assets'
      isLibraryBuild = Boolean(config.build?.lib)
    },

    /**
     * Builds — Storybook's static site. The URL resolves relative to the chunk that
     * contains workerUrl.js, which Vite writes into the assets directory, so the worker
     * has to land there too.
     *
     * Never for the library build: workerUrl.js is external there and the worker is
     * copied to dist/ by scripts/copy-worker.mjs. Emitting here as well shipped a second
     * 1.2 MB copy at dist/assets/, inside the published tarball.
     */
    async generateBundle() {
      if (isLibraryBuild) return
      this.emitFile({
        type: 'asset',
        fileName: posix.join(assetsDir, WORKER_FILE),
        source: await readFile(WORKER),
      })
    },

    /** Dev server — the request arrives as `/src/PDFViewer/utils/pdf.worker.min.js`. */
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.split('?')[0].endsWith(`/${WORKER_FILE}`)) return next()

        stat(WORKER)
          .then(({ size }) => {
            res.setHeader('Content-Type', 'text/javascript')
            res.setHeader('Content-Length', size)
            createReadStream(WORKER).pipe(res)
          })
          .catch(next)
      })
    },
  }
}
