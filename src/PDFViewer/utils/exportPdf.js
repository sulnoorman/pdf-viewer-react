import { PDFDocument, degrees } from 'pdf-lib'
import { hexToRgb } from './color.js'
import {
  viewRectToPdf,
  viewOriginToPdf,
  viewPointToPdf,
  normalizeRotation,
  pointsBBox,
} from './coords.js'
import {
  localOffsetToFrame,
  rotatePointsAround,
  rectCenter,
  normalizeAngle,
} from './transform.js'
import { resolveStandardFont, wrapText } from './fonts.js'
import { ANNOTATION_TYPES } from '../reducers/annotationReducer.js'

/**
 * Flattens annotations into a copy of the source PDF.
 *
 * "Flatten" means the annotations become part of the page content stream rather than
 * PDF annotation objects, so no downstream reader can move or delete them. The
 * original page content is untouched — text stays selectable and vector art stays
 * vector; nothing is re-rasterised.
 *
 * Fixed here relative to the version that lived inline in the viewer component:
 *   - pages with a /Rotate entry used `page.getSize()` (the unrotated MediaBox) plus
 *     a hand-written y-flip, so every annotation landed in the wrong place
 *   - `fontFamily` was ignored; everything came out Helvetica
 *   - text never wrapped, so a long line ran off the page
 *   - draw order contradicted the screen, with ink painted over stamps
 */

/**
 * Text box inset, in view units. Mirrors the textarea's padding so a line starts at
 * the same place on screen and in the exported file.
 */
export const TEXT_PADDING = 4

/** Multiplier matching the textarea's CSS line-height. */
export const LINE_HEIGHT_RATIO = 1.2

/** Screen layering: ink is painted underneath stamps and text. */
const LAYER = { [ANNOTATION_TYPES.INK]: 0 }
const layerOf = (annotation) => LAYER[annotation.type] ?? 1

/** Order annotations exactly as the viewer stacks them. */
function inPaintOrder(annotations) {
  return annotations
    .map((annotation, index) => ({ annotation, index }))
    .sort((a, b) => layerOf(a.annotation) - layerOf(b.annotation) || a.index - b.index)
    .map((entry) => entry.annotation)
}

/** Fetch and embed each distinct image once, so N stamps of one asset cost one XObject. */
async function embedAssets(pdfDoc, annotations, assets) {
  const needed = new Set(
    annotations
      .filter((a) => a.type === ANNOTATION_TYPES.IMAGE)
      .map((a) => a.assetId)
      .filter(Boolean)
  )

  const embedded = new Map()

  for (const assetId of needed) {
    const asset = assets?.[assetId]
    if (!asset) continue

    const source = typeof asset === 'string' ? asset : asset.src
    const bytes = asset?.bytes ?? (source ? await fetchAssetBytes(assetId, source) : null)
    if (!bytes) continue

    embedded.set(
      assetId,
      isPng(bytes, asset, source) ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)
    )
  }

  return embedded
}

/** The first eight bytes of every PNG file, by specification. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * PNG or JPEG? pdf-lib needs to be told, and getting it wrong throws.
 *
 * **The bytes are asked first**, because they are the only source that is always right. The
 * hints below can all be absent from a perfectly ordinary asset:
 *
 * - a `data:` URL ends in base64, not `.png`
 * - a `blob:` URL has no extension at all
 * - a URL can serve a PNG from a path ending in anything, or nothing
 * - `bytes` supplied directly may arrive with no `mimeType`
 *
 * Before this, any of those fell through to `embedJpg` and failed with pdf-lib's
 * "SOI not found in JPEG" — a message that names neither the asset nor the real problem.
 * The hints are kept as a fallback for the one case sniffing cannot serve: bytes too short
 * to carry a signature, where the old guess is still better than nothing.
 */
function isPng(bytes, asset, source) {
  const head = new Uint8Array(bytes instanceof ArrayBuffer ? bytes : bytes.buffer ?? bytes, 0, 8)
  if (head.length >= 8) return PNG_SIGNATURE.every((byte, i) => head[i] === byte)

  if (asset?.mimeType) return asset.mimeType === 'image/png'
  if (typeof source !== 'string') return false
  return source.startsWith('data:image/png') || source.split('?')[0].toLowerCase().endsWith('.png')
}

/**
 * Read a stamp image's bytes, failing loudly and specifically.
 *
 * Export deliberately aborts rather than dropping an image it cannot fetch: handing back
 * a document that looks signed on screen but has no signature in the file is the worst
 * possible outcome for a signing tool.
 *
 * What it must not do is abort with a bare "Failed to fetch". The two causes are worth
 * naming, because neither is visible from the viewer: a cross-origin image whose server
 * sends no CORS headers can be *displayed* by the browser but not *read* by script, so
 * the stamp looks perfectly fine right up until the moment someone clicks Download.
 */
async function fetchAssetBytes(assetId, source) {
  let response
  try {
    response = await fetch(source)
  } catch (cause) {
    throw new Error(
      `Could not read the stamp image "${assetId}" from ${source}. ` +
        'If it is on another domain, that server must send CORS headers — a browser will ' +
        'display such an image but refuses to let script read its bytes. Hosting the image ' +
        'in your own app avoids this entirely.',
      { cause }
    )
  }

  if (!response.ok) {
    throw new Error(
      `Could not read the stamp image "${assetId}" from ${source} ` +
        `(${response.status} ${response.statusText}).`
    )
  }

  return response.arrayBuffer()
}

/** Embed each standard font at most once per document. */
async function embedFonts(pdfDoc, annotations) {
  const fonts = new Map()

  for (const annotation of annotations) {
    if (annotation.type !== ANNOTATION_TYPES.TEXT) continue
    const name = resolveStandardFont(annotation.fontFamily)
    if (!fonts.has(name)) fonts.set(name, await pdfDoc.embedFont(name))
  }

  return fonts
}

function drawImageAnnotation(page, annotation, pageBox, { images }) {
  const image = images.get(annotation.assetId)
  if (!image) return

  const { x, y, rotate } = viewRectToPdf(annotation, pageBox, annotation.rotation ?? 0)
  page.drawImage(image, {
    x,
    y,
    width: annotation.width,
    height: annotation.height,
    rotate: degrees(rotate),
    opacity: annotation.opacity ?? 1,
  })
}

function drawTextAnnotation(page, annotation, pageBox, { fonts }) {
  const text = annotation.text ?? ''
  if (!text) return

  const fontSize = annotation.fontSize || 16
  const font = fonts.get(resolveStandardFont(annotation.fontFamily))
  if (!font) return

  const objectRotation = annotation.rotation ?? 0
  const lineHeight = fontSize * LINE_HEIGHT_RATIO
  const maxWidth = Math.max(0, (annotation.width ?? 0) - TEXT_PADDING * 2)
  const lines = wrapText(text, font, fontSize, maxWidth)

  // A CSS line box centres the glyphs vertically, so the baseline sits half a leading
  // plus the ascender below the top of the line. Matching that is what stops the
  // exported text from drifting a few points away from where it appeared on screen.
  const halfLeading = (lineHeight - fontSize) / 2
  const ascent = font.heightAtSize(fontSize, { descender: false })

  // Each baseline is positioned in the box's own axes first, then rotated with the
  // box — otherwise a rotated text block would keep its lines stacked vertically on
  // the page while the box itself turned.
  const rotate = normalizeAngle(normalizeRotation(pageBox.rotate) - objectRotation)

  lines.forEach((line, index) => {
    if (!line) return

    const localOffset = {
      x: -annotation.width / 2 + TEXT_PADDING,
      y: -annotation.height / 2 + TEXT_PADDING + halfLeading + ascent + index * lineHeight,
    }
    const anchor = viewPointToPdf(
      localOffsetToFrame(annotation, localOffset, objectRotation),
      pageBox
    )

    page.drawText(line, {
      x: anchor.x,
      y: anchor.y,
      size: fontSize,
      font,
      color: hexToRgb(annotation.color),
      rotate: degrees(rotate),
      opacity: annotation.opacity ?? 1,
    })
  })
}

function drawInkAnnotation(page, annotation, pageBox) {
  const stored = annotation.points ?? []
  if (stored.length < 2) return

  // A stroke's rotation is baked into its points rather than handed to pdf-lib: the
  // path is anchored at the page origin, not at the stroke, so an angle passed to
  // drawSvgPath would spin the stroke about the corner of the page.
  const points = rotatePointsAround(
    stored,
    rectCenter(pointsBBox(stored)),
    annotation.rotation ?? 0
  )

  // drawSvgPath consumes y-down coordinates measured from its anchor, which is
  // exactly how view space is defined — so the points go in unchanged and only the
  // anchor and angle depend on the page rotation.
  const path = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`
  const { x, y, rotate } = viewOriginToPdf(pageBox)

  page.drawSvgPath(path, {
    x,
    y,
    rotate: degrees(rotate),
    borderColor: hexToRgb(annotation.color),
    borderWidth: annotation.strokeWidth ?? 2,
    borderOpacity: annotation.opacity ?? 1,
    borderLineCap: 1, // round, matching the on-screen stroke
  })
}

const DRAWERS = {
  [ANNOTATION_TYPES.IMAGE]: drawImageAnnotation,
  [ANNOTATION_TYPES.TEXT]: drawTextAnnotation,
  [ANNOTATION_TYPES.INK]: drawInkAnnotation,
}

/**
 * @param {ArrayBuffer|Uint8Array} sourceBytes the original PDF
 * @param {object[]} annotations flat list, view-space coordinates
 * @param {Record<string, string|{src?: string, bytes?: ArrayBuffer, mimeType?: string}>} assets
 *        image sources keyed by the `assetId` an image annotation refers to
 * @param {object} [options]
 * @param {Record<number, number>} [options.pageRotations]
 *        extra rotation the viewer is showing, per page index
 * @param {boolean} [options.rotateExportedPages]
 *        whether that rotation is written into the exported file (default true)
 * @returns {Promise<Blob>} the flattened PDF
 */
export async function exportFlattenedPdf(
  sourceBytes,
  annotations,
  assets = {},
  { pageRotations = {}, rotateExportedPages = true } = {}
) {
  const pdfDoc = await PDFDocument.load(sourceBytes)
  const pages = pdfDoc.getPages()

  // Captured before anything is written, because annotation placement is defined
  // against the page's ORIGINAL /Rotate. Reading it back after setRotation would
  // silently shift every annotation on a rotated page.
  const intrinsicRotations = pages.map((page) => normalizeRotation(page.getRotation().angle))

  const drawable = inPaintOrder(
    annotations.filter((a) => a && a.pageIndex >= 0 && a.pageIndex < pages.length)
  )

  const [images, fonts] = await Promise.all([
    embedAssets(pdfDoc, drawable, assets),
    embedFonts(pdfDoc, drawable),
  ])

  for (const annotation of drawable) {
    const page = pages[annotation.pageIndex]
    const { width, height } = page.getSize()
    const pageBox = {
      pageWidth: width,
      pageHeight: height,
      rotate: intrinsicRotations[annotation.pageIndex],
    }

    DRAWERS[annotation.type]?.(page, annotation, pageBox, { images, fonts })
  }

  /*
    Carry the viewer's rotation into the file.

    A reader applies /Rotate to the whole page, so the original content and the
    annotations we just drew turn together — the annotations stay glued to whatever
    they were placed on. That is why this happens after drawing and why the drawing
    maths above still uses the intrinsic angle.

    This is on by default because of what the tool is for: someone who rotates a
    sideways scan in order to sign it expects the recipient to get it the right way
    up. Hosts that want the Chrome-style "rotate is just for reading" behaviour can
    set `rotateExportedPages: false`.
  */
  if (rotateExportedPages) {
    pages.forEach((page, index) => {
      const extra = normalizeRotation(pageRotations[index] ?? 0)
      if (!extra) return
      page.setRotation(degrees(normalizeRotation(intrinsicRotations[index] + extra)))
    })
  }

  const bytes = await pdfDoc.save()
  return new Blob([bytes], { type: 'application/pdf' })
}
