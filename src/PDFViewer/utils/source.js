/**
 * Normalises whatever the host passed as `src` into raw bytes.
 *
 * Two problems this solves:
 *
 * 1. `src` used to accept only a fetchable URL string. A file the user just picked
 *    from disk, or bytes already in memory, had to be turned into an object URL first.
 *
 * 2. Export re-fetched `src` from scratch. Besides the wasted round trip, that meant
 *    exporting a document behind an expiring signed URL could fail long after it
 *    displayed fine — and any source that was not re-fetchable could not be exported
 *    at all. The bytes are now loaded once and shared by the viewer and the exporter.
 */

/** @typedef {string | ArrayBuffer | Uint8Array | Blob | File} PdfSource */

/**
 * @param {PdfSource} src
 * @returns {Promise<Uint8Array>}
 */
export async function normalizePdfSource(src) {
  if (!src) throw new Error('No PDF source provided')

  if (typeof src === 'string') {
    const response = await fetch(src)
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF (${response.status} ${response.statusText})`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }

  if (src instanceof Uint8Array) return src
  if (src instanceof ArrayBuffer) return new Uint8Array(src)

  // Blob covers File, which extends it.
  if (typeof Blob !== 'undefined' && src instanceof Blob) {
    return new Uint8Array(await src.arrayBuffer())
  }

  // Other typed-array views over a buffer.
  if (ArrayBuffer.isView(src)) {
    return new Uint8Array(src.buffer, src.byteOffset, src.byteLength)
  }

  throw new Error(
    'Unsupported PDF source: expected a URL string, File, Blob, ArrayBuffer or Uint8Array'
  )
}

/**
 * pdf.js takes ownership of the buffer it is handed and detaches it. Handing it the
 * same bytes the exporter later reads produces a confusing "detached ArrayBuffer"
 * failure at export time, so it always gets its own copy.
 *
 * @param {Uint8Array} bytes
 * @returns {Uint8Array}
 */
export function copyBytes(bytes) {
  return bytes.slice()
}

/**
 * A stable cache key for a source, so the loader can tell an unchanged prop from a
 * genuinely new document. Object identity is the only sane key for binary input.
 *
 * @param {PdfSource} src
 * @returns {PdfSource}
 */
export function sourceKey(src) {
  return src
}
