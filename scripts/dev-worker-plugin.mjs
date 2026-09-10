import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve, dirname, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The directories pdf.js fetches from at runtime, served straight out of pdfjs-dist.
 *
 * Same situation as the worker below, and the same fix — but the failure is quieter, so it
 * is worth naming. Without these, pdf.js cannot decode CCITT, JBIG2 or JPEG 2000, and an
 * image it cannot decode is not skipped: a 1-bit stencil mask gets painted in full, so a
 * scanned logo renders as a solid black rectangle. The dev server answers the missing path
 * with index.html, so the console shows a WebAssembly magic-number error rather than a 404.
 */
const ASSET_DIRS = {
  wasm: resolve(root, 'node_modules/pdfjs-dist/wasm'),
  standard_fonts: resolve(root, 'node_modules/pdfjs-dist/standard_fonts'),
}

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
/**
 * Stream a file back, falling through to Vite when it is not there.
 *
 * A missing file hands control on with no argument rather than passing the error, which
 * Vite would render as a 500. This middleware claims any path with a `/wasm/` segment in
 * it, so a name it cannot serve is far more likely to be someone else's route than a real
 * failure — and even for a genuine one, a 404 says "no such file" where a 500 does not.
 */
function send(res, next, file, contentType) {
  stat(file)
    .then(({ size }) => {
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Length', size)
      createReadStream(file).pipe(res)
    })
    .catch((error) => next(error.code === 'ENOENT' ? undefined : error))
}

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

      // The decoders and fonts resolve relative to the same chunk, so they land beside it.
      for (const [name, from] of Object.entries(ASSET_DIRS)) {
        for (const file of await readdir(from)) {
          if (file.startsWith('LICENSE')) continue
          this.emitFile({
            type: 'asset',
            fileName: posix.join(assetsDir, name, file),
            source: await readFile(resolve(from, file)),
          })
        }
      }
    },

    /**
     * Dev server — requests arrive as `/src/PDFViewer/utils/pdf.worker.min.js` and
     * `/src/PDFViewer/utils/wasm/jbig2.wasm`, because that is where the URLs in
     * workerUrl.js resolve to when this repo runs from source.
     */
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]
        if (!path) return next()

        if (path.endsWith(`/${WORKER_FILE}`)) {
          return send(res, next, WORKER, 'text/javascript')
        }

        for (const [name, from] of Object.entries(ASSET_DIRS)) {
          const marker = `/${name}/`
          const at = path.lastIndexOf(marker)
          if (at === -1) continue

          const file = path.slice(at + marker.length)
          // No separators: the URL is a flat directory listing, and this middleware must
          // not become a way to read arbitrary files off the machine.
          if (!file || file.includes('/')) continue

          return send(
            res,
            next,
            resolve(from, file),
            file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'
          )
        }

        return next()
      })
    },
  }
}
