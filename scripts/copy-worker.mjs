/**
 * Copy pdf.js's runtime assets, and the one module that references them, into dist/.
 *
 * pdf.js is not self-contained: it fetches a worker, its image decoders, and the standard
 * font data at runtime, and leaves finding them to whoever embeds it. Browsers' built-in
 * viewers ship all of it, which is why a document that renders there can still render
 * wrongly in an embedded viewer that shipped only some of it.
 *
 * Everything here is copied rather than bundled. `workerUrl.js` holds
 * `new URL('./…', import.meta.url)` expressions that must survive to the consumer's bundler
 * untouched: Vite library mode would otherwise resolve them at our build time and inline
 * megabytes as base64. See src/PDFViewer/utils/workerUrl.js for the full reasoning.
 *
 * The version is asserted, not assumed. pdf.js compares the worker's version against the
 * API's on every document load and throws when they differ, so a `^` range in
 * package.json would let npm install an API this worker cannot talk to.
 */
import { copyFile, mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/*
 * Copied under `.js`, not the `.mjs` pdfjs-dist ships.
 *
 * Many web servers, nginx included, have no MIME mapping for `.mjs` and serve it as
 * `application/octet-stream` — which browsers refuse to execute as a module. That failed
 * only in production, on a file that downloaded perfectly, and every consumer would have
 * had to diagnose it against their own infrastructure. The extension does not affect the
 * contents being an ES module.
 */
const SOURCE_WORKER = 'pdf.worker.min.mjs'
const WORKER = 'pdf.worker.min.js'
const source = resolve(root, 'node_modules/pdfjs-dist/build', SOURCE_WORKER)
const workerUrlModule = resolve(root, 'src/PDFViewer/utils/workerUrl.js')

const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const pinned = pkg.dependencies?.['pdfjs-dist']

if (!pinned || !/^\d+\.\d+\.\d+$/.test(pinned)) {
  throw new Error(
    `package.json must pin pdfjs-dist to an exact version, got ${JSON.stringify(pinned)}. ` +
      'A range would let npm install an API version this bundled worker cannot talk to — ' +
      'pdf.js throws on a worker/API version mismatch.'
  )
}

const installed = JSON.parse(
  await readFile(resolve(root, 'node_modules/pdfjs-dist/package.json'), 'utf8')
).version

if (installed !== pinned) {
  throw new Error(
    `pdfjs-dist ${installed} is installed but package.json pins ${pinned}. ` +
      'Reinstall, or update the pin — the bundled worker must match the API exactly.'
  )
}

await copyFile(source, resolve(root, 'dist', WORKER))
await copyFile(workerUrlModule, resolve(root, 'dist/workerUrl.js'))

const { size } = await stat(resolve(root, 'dist', WORKER))
console.log(`Copied ${WORKER} (${(size / 1024 / 1024).toFixed(2)} MB, pdf.js ${installed})`)

/* ------------------------------------------------------------------ *
 * Image decoders
 * ------------------------------------------------------------------ */

/**
 * The wasm decoders, and the licences that must travel with them.
 *
 * pdf.js v6 moved CCITT, JBIG2 and JPEG 2000 decoding out of JavaScript into WebAssembly,
 * fetched at runtime from whatever `wasmUrl` the embedder supplies — there is no default.
 * Without them a scanned image does not fail loudly: a stencil mask that cannot be decoded
 * is painted in full with the fill colour, so a logo becomes a solid black rectangle with
 * the page around it perfectly intact.
 *
 * `quickjs-eval.wasm` (458 kB) is deliberately not here: it exists to run JavaScript
 * embedded in PDF forms, which this viewer does not do. Neither are the `*_nowasm_fallback.js`
 * files (583 kB), which serve environments without WebAssembly.
 *
 * The LICENSE files are not optional. Shipping the binaries is redistribution.
 */
const WASM_FILES = [
  'jbig2.wasm', // CCITT and JBIG2 both — one binary, exporting _ccitt_decode and _jbig2_decode
  'openjpeg.wasm', // JPEG 2000
  'qcms_bg.wasm', // ICC colour profiles
  'LICENSE_JBIG2',
  'LICENSE_OPENJPEG',
  'LICENSE_QCMS',
  'LICENSE_PDFJS_JBIG2',
  'LICENSE_PDFJS_OPENJPEG',
  'LICENSE_PDFJS_QCMS',
]

/**
 * Copy a set of files, failing loudly on any that has gone missing.
 *
 * A pdfjs-dist upgrade that renames or drops one of these would otherwise produce a build
 * that looks fine and renders scanned documents wrongly — the exact failure this whole
 * addition exists to prevent, reintroduced silently.
 */
async function copyInto(fromDir, toDir, files) {
  await mkdir(toDir, { recursive: true })

  let bytes = 0
  for (const file of files) {
    const from = resolve(fromDir, file)
    try {
      bytes += (await stat(from)).size
    } catch {
      throw new Error(
        `pdfjs-dist ${installed} does not contain ${file}, expected at ${from}.\n` +
          'It was renamed, moved or dropped upstream. Do not skip it: without these files ' +
          'pdf.js silently renders CCITT, JBIG2 and JPEG 2000 images wrongly rather than ' +
          'reporting an error.'
      )
    }
    await copyFile(from, resolve(toDir, file))
  }
  return bytes
}

const wasmBytes = await copyInto(
  resolve(root, 'node_modules/pdfjs-dist/wasm'),
  resolve(root, 'dist/wasm'),
  WASM_FILES
)
console.log(`Copied ${WASM_FILES.length} decoder files (${(wasmBytes / 1024).toFixed(0)} kB)`)

/* ------------------------------------------------------------------ *
 * Standard font data
 * ------------------------------------------------------------------ */

/**
 * The 14 standard PDF fonts, for documents that reference them without embedding them.
 *
 * Missing, pdf.js substitutes whatever the system offers and the metrics shift — text
 * reflows and line breaks move. On a document whose layout carries meaning, that is a
 * quieter version of the same problem as the black rectangle.
 *
 * Copied wholesale rather than by name: the file list is pdf.js's business, and each font
 * is fetched only by a document that actually needs it.
 */
const fontsFrom = resolve(root, 'node_modules/pdfjs-dist/standard_fonts')
const fontFiles = await readdir(fontsFrom).catch(() => {
  throw new Error(
    `pdfjs-dist ${installed} has no standard_fonts directory at ${fontsFrom}.\n` +
      'Without it, documents that do not embed the standard fonts render with substituted ' +
      'metrics and their layout shifts.'
  )
})

const fontBytes = await copyInto(fontsFrom, resolve(root, 'dist/standard_fonts'), fontFiles)
console.log(`Copied ${fontFiles.length} standard fonts (${(fontBytes / 1024).toFixed(0)} kB)`)
