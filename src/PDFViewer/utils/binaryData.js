import { resolvedAssetUrls } from './workerUrl.js'
import { correctOptimizedDepUrl } from './worker.js'

/**
 * Tells pdf.js where each of its runtime assets actually is.
 *
 * pdf.js fetches its image decoders and standard font data at runtime and, by default,
 * builds each URL as `${wasmUrl}${filename}` — a base directory plus a bare filename. That
 * is unusable for an embedded viewer: a bundler copies assets into the application's
 * output under **hashed** names (`pdf.worker.min-DEtVeC4l.js`), so a directory plus
 * `jbig2.wasm` names a file that does not exist there.
 *
 * `getDocument({ BinaryDataFactory })` is the supported way out. pdf.js constructs this
 * class and calls `fetch({ kind, filename })` for each asset, so the filename can be
 * looked up rather than concatenated. Passing it also turns `useWorkerFetch` off, which
 * routes the fetch through the main thread — the same path pdf.js uses under Node, and
 * the reason it exists.
 *
 * A host that serves its own copies still wins: `config.wasmUrl` and
 * `config.standardFontDataUrl` arrive here as base directories and are used as pdf.js
 * would, by concatenation.
 */
export class BundledBinaryDataFactory {
  /** @param {{cMapUrl?: string, standardFontDataUrl?: string, wasmUrl?: string}} bases */
  constructor({ cMapUrl = null, standardFontDataUrl = null, wasmUrl = null } = {}) {
    this.cMapUrl = cMapUrl
    this.standardFontDataUrl = standardFontDataUrl
    this.wasmUrl = wasmUrl
  }

  /**
   * @param {{kind: 'cMapUrl'|'standardFontDataUrl'|'wasmUrl', filename: string}} request
   * @returns {Promise<Uint8Array>}
   */
  async fetch({ kind, filename }) {
    const base = this[kind]
    const url = base
      ? `${base}${filename}`
      : // In Vite's dev server this package is relocated into node_modules/.vite/deps/,
        // which moves import.meta.url out of the package without copying the assets. The
        // same correction the worker needs, applied per file.
        correctOptimizedDepUrl(resolvedAssetUrls[filename], directoryFor(filename))

    if (!url) {
      /*
       * Reachable for CMaps, which this package does not ship: they are only needed by
       * documents using predefined CJK encodings, and they are another 1.5 MB. Saying so
       * is worth more than a failed fetch, because pdf.js reports the miss as an opaque
       * "Unable to load CMap data".
       */
      throw new Error(
        `[@armsolusi/pdf-viewer] No bundled ${kind === 'cMapUrl' ? 'CMap' : 'asset'} named ` +
          `"${filename}". ${
            kind === 'cMapUrl'
              ? 'CMaps are not shipped with this package; serve pdfjs-dist/cmaps yourself ' +
                'and pass config.cMapUrl.'
              : 'This should not happen; please report it.'
          }`
      )
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `[@armsolusi/pdf-viewer] Could not load "${filename}" from ${url} ` +
          `(${response.status} ${response.statusText}).\n` +
          'It ships with this package, so a 404 here means your bundler did not emit it. ' +
          'Serve your own copies and pass config.wasmUrl / config.standardFontDataUrl if ' +
          'that cannot be fixed.'
      )
    }
    return new Uint8Array(await response.arrayBuffer())
  }
}

/** Which shipped directory a filename lives in, for the dev-server URL correction. */
function directoryFor(filename) {
  return filename.endsWith('.wasm') ? 'wasm/' : 'standard_fonts/'
}
