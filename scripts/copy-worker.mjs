/**
 * Copy the pdf.js worker, and the one module that references it, into dist/.
 *
 * Both are copied rather than bundled. `workerUrl.js` holds a
 * `new URL('./pdf.worker.min.mjs', import.meta.url)` that must survive to the consumer's
 * bundler untouched: Vite library mode would otherwise resolve it at our build time and
 * inline 1.2 MB as base64. See src/PDFViewer/utils/workerUrl.js for the full reasoning.
 *
 * The version is asserted, not assumed. pdf.js compares the worker's version against the
 * API's on every document load and throws when they differ, so a `^` range in
 * package.json would let npm install an API this worker cannot talk to.
 */
import { copyFile, readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const WORKER = 'pdf.worker.min.mjs'
const source = resolve(root, 'node_modules/pdfjs-dist/build', WORKER)
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
