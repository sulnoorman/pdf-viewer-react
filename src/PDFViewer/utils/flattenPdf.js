import { exportFlattenedPdf } from './exportPdf.js'
import { normalizePdfSource } from './source.js'
import { normalizeAssets } from '../hooks/useStampAssets.js'

/**
 * Flatten annotations into a PDF without a viewer.
 *
 * `viewer.getFlattenedPDF()` can only ever export the document currently on screen, which
 * is the wrong shape for a host that holds several — a review workflow with a tab per
 * attachment, where pressing Submit has to produce every file with its own annotations.
 * Driving one viewer around all of them to collect the output would mean loading and
 * rendering each in turn for no reason.
 *
 * So this is the same export pipeline with the component left out. Everything it needs is
 * an argument, which also makes it usable from a worker or a test.
 *
 * ```js
 * const files = await Promise.all(
 *   attachments.map(async (file) => ({
 *     id: file.id,
 *     blob: await flattenPdf({
 *       src: file.url,
 *       annotations: draft[file.id] ?? [],
 *       stampAssets,
 *     }),
 *   }))
 * )
 * ```
 *
 * `src`, `stampAssets` and `specimenAsset` take exactly the shapes the component takes, so
 * a host passes the same values it already has rather than converting anything.
 *
 * One limit worth knowing: an image annotation stores only its `assetId`, so its asset has
 * to be in `stampAssets` (or be `specimenAsset`) for the image to appear. Assets a user
 * uploaded into the viewer live only in that viewer's memory and are not addressable from
 * here — an annotation referencing one is skipped rather than failing the export.
 *
 * @param {object} params
 * @param {import('./source.js').PdfSource} params.src URL, `File`, `Blob`, `ArrayBuffer`
 *   or `Uint8Array` — whatever you would pass to `<PDFViewer src>`
 * @param {Array<object>} [params.annotations] as returned by `viewer.getAnnotations()`
 * @param {object|Array} [params.stampAssets] as passed to `config.stampAssets`
 * @param {string} [params.specimenAsset] as passed to `config.specimenAsset`
 * @param {Record<number, number>} [params.pageRotations] extra rotation per page index
 * @param {boolean} [params.rotateExportedPages] default true, matching the component
 * @returns {Promise<Blob>} a PDF
 */
export async function flattenPdf({
  src,
  annotations = [],
  stampAssets,
  specimenAsset,
  pageRotations = {},
  rotateExportedPages = true,
} = {}) {
  if (!src) throw new Error('flattenPdf: `src` is required')

  const sourceBytes = await normalizePdfSource(src)

  return exportFlattenedPdf(sourceBytes, annotations, normalizeAssets(stampAssets, specimenAsset), {
    pageRotations,
    rotateExportedPages,
  })
}
