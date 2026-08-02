/**
 * The single source of truth for every coordinate conversion in this library.
 *
 * Before this module the maths lived in four unrelated places and the PDF y-flip was
 * hand-written three separate times, which is why annotations landed in the wrong
 * spot on pages carrying a /Rotate entry.
 *
 * ## The three coordinate spaces
 *
 * 1. **Screen space** — CSS pixels inside `.pdf-page-container`. Depends on `scale`.
 *    Origin top-left, y down.
 * 2. **View space** — the page as it appears at scale 1 with the page's intrinsic
 *    /Rotate already applied. Origin top-left, y down, units are PDF points.
 *    *Everything in the annotation store is in this space.*
 * 3. **PDF user space** — raw MediaBox coordinates. Origin bottom-left, y UP.
 *    This is what pdf-lib draws in.
 *
 * Storing view space (rather than raw user space) is deliberate: it is exactly what
 * pdf.js hands back from `getViewport()`, so screen conversion is a plain divide by
 * `scale`, and a stamp stays glued to the same visual spot on the page no matter how
 * the viewer is rotated.
 *
 * ## Rotation
 *
 * Two rotations must never be conflated:
 *   - `intrinsicRotate` — the page's own /Rotate (`page.rotate` in pdf.js)
 *   - `userRotation`    — extra rotation applied by the viewer's rotate button
 * `totalRotation = (intrinsicRotate + userRotation) % 360` is what you feed to
 * `getViewport({ rotation })`. Only `intrinsicRotate` matters for export, because
 * user rotation is a viewing preference that must not alter the output file.
 */

import { localOffsetToFrame, normalizeAngle } from './transform.js'

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ x: number, y: number, width: number, height: number }} Rect */
/** @typedef {{ pageWidth: number, pageHeight: number, rotate?: number }} PageBox */

/** Rotations pdf.js and the PDF spec allow. */
export const VALID_ROTATIONS = [0, 90, 180, 270]

/**
 * Coerce any angle into one of 0/90/180/270.
 * PDF files in the wild carry negative and >360 values, and pdf.js normalises them,
 * so we must too or the lookup tables below silently miss.
 */
export function normalizeRotation(angle) {
  const n = Number(angle) || 0
  const wrapped = (((Math.round(n / 90) * 90) % 360) + 360) % 360
  return wrapped
}

/**
 * Dimensions of the page as displayed, i.e. after rotation swaps the axes.
 *
 * @param {PageBox} pageBox
 * @returns {{ width: number, height: number }}
 */
export function viewSize({ pageWidth, pageHeight, rotate = 0 }) {
  const r = normalizeRotation(rotate)
  return r === 90 || r === 270
    ? { width: pageHeight, height: pageWidth }
    : { width: pageWidth, height: pageHeight }
}

/**
 * Size a page occupies on screen once the viewer's own rotation is applied.
 *
 * `base` is the page at its intrinsic /Rotate; `userRotation` is the extra turn from
 * the rotate buttons. A quarter turn swaps the axes, a half turn does not.
 *
 * Only the outer box changes: annotations keep living in base view space, and the
 * page content is rotated as a whole by CSS. That is why there is no rect-remapping
 * function here — see the Page component for why rotating the container beats
 * rotating every annotation individually.
 *
 * @param {{width: number, height: number}} base
 * @param {number} userRotation degrees clockwise
 */
export function displayPageSize(base, userRotation = 0) {
  const r = normalizeRotation(userRotation)
  const width = base?.width ?? 0
  const height = base?.height ?? 0
  return r === 90 || r === 270 ? { width: height, height: width } : { width, height }
}

/* ------------------------------------------------------------------ *
 * Screen <-> view
 * ------------------------------------------------------------------ */

/** @param {Point} pt @param {number} scale @returns {Point} */
export function screenToView({ x, y }, scale) {
  return { x: x / scale, y: y / scale }
}

/** @param {Point} pt @param {number} scale @returns {Point} */
export function viewToScreen({ x, y }, scale) {
  return { x: x * scale, y: y * scale }
}

/** @param {Rect} rect @param {number} scale @returns {Rect} */
export function screenRectToView({ x, y, width, height }, scale) {
  return { x: x / scale, y: y / scale, width: width / scale, height: height / scale }
}

/** @param {Rect} rect @param {number} scale @returns {Rect} */
export function viewRectToScreen({ x, y, width, height }, scale) {
  return { x: x * scale, y: y * scale, width: width * scale, height: height * scale }
}

/* ------------------------------------------------------------------ *
 * View -> PDF user space
 * ------------------------------------------------------------------ */

/**
 * Map a point from view space to PDF user space.
 *
 * Derived by inverting the pdf.js PageViewport transform for each rotation
 * (W,H are the *unrotated* MediaBox dimensions):
 *   r=0    view = (px, H - py)
 *   r=90   view = (py, px)
 *   r=180  view = (W - px, py)
 *   r=270  view = (H - py, W - px)
 *
 * @param {Point} pt point in view space
 * @param {PageBox} pageBox unrotated page size plus intrinsic rotation
 * @returns {Point} point in PDF user space
 */
export function viewPointToPdf({ x, y }, { pageWidth: W, pageHeight: H, rotate = 0 }) {
  switch (normalizeRotation(rotate)) {
    case 90:
      return { x: y, y: x }
    case 180:
      return { x: W - x, y }
    case 270:
      return { x: W - y, y: H - x }
    default:
      return { x, y: H - y }
  }
}

/**
 * Map a point from PDF user space back to view space. Inverse of viewPointToPdf.
 *
 * @param {Point} pt @param {PageBox} pageBox @returns {Point}
 */
export function pdfPointToView({ x, y }, { pageWidth: W, pageHeight: H, rotate = 0 }) {
  switch (normalizeRotation(rotate)) {
    case 90:
      return { x: y, y: x }
    case 180:
      return { x: W - x, y }
    case 270:
      return { x: H - y, y: W - x }
    default:
      return { x, y: H - y }
  }
}

/**
 * Convert a view-space rectangle into the anchor + angle that pdf-lib's draw calls
 * expect.
 *
 * pdf-lib places a box by its **bottom-left corner** and rotates the box about that
 * corner. So the anchor is the box's own bottom-left corner *after the object's own
 * rotation has been applied*, mapped into user space.
 *
 * ## Composing the two rotations
 *
 * The page's `/Rotate` and the object's own rotation are measured in opposite
 * senses: view space has y pointing down, so a clockwise turn on screen is a
 * counter-clockwise turn in PDF user space. That gives `pdfRotate = page − object`,
 * derived by mapping the object's local +x axis through each page rotation and
 * verified corner-by-corner in coords.test.js.
 *
 * Passing `objectRotation` was originally missing, which is why a stamp the user had
 * turned upright still exported lying flat.
 *
 * @param {Rect} rect rectangle in view space (y down, top-left origin), unrotated
 * @param {PageBox} pageBox unrotated page size plus intrinsic /Rotate
 * @param {number} [objectRotation] the annotation's own rotation, degrees clockwise
 * @returns {{ x: number, y: number, rotate: number }} pdf-lib anchor and degrees CCW
 */
export function viewRectToPdf(rect, pageBox, objectRotation = 0) {
  const { width, height } = rect
  const spin = normalizeAngle(objectRotation)

  // The box's own bottom-left corner: half a width to the left of the centre, half a
  // height below it, expressed in the box's rotated axes.
  const anchorView = localOffsetToFrame(rect, { x: -width / 2, y: height / 2 }, spin)

  const anchor = viewPointToPdf(anchorView, pageBox)
  return {
    x: anchor.x,
    y: anchor.y,
    rotate: normalizeAngle(normalizeRotation(pageBox.rotate) - spin),
  }
}

/**
 * Anchor for content authored in view coordinates that pdf-lib draws y-down from a
 * single origin — i.e. `drawSvgPath`, which the ink layer uses.
 *
 * This is the view-space origin (0,0) expressed in user space, plus the angle that
 * re-orients the path with the page.
 *
 * @param {PageBox} pageBox
 * @returns {{ x: number, y: number, rotate: number }}
 */
export function viewOriginToPdf({ pageWidth: W, pageHeight: H, rotate = 0 }) {
  const r = normalizeRotation(rotate)
  const origin = viewPointToPdf({ x: 0, y: 0 }, { pageWidth: W, pageHeight: H, rotate: r })
  return { x: origin.x, y: origin.y, rotate: r }
}

/* ------------------------------------------------------------------ *
 * Geometry helpers
 * ------------------------------------------------------------------ */

/**
 * Axis-aligned bounding box of a point list. Ink strokes store raw points; their
 * bbox is what selection, hit-testing and (later) move/resize operate on.
 *
 * @param {Point[]} points
 * @returns {Rect} zero-sized rect at the origin when there are no points
 */
export function pointsBBox(points) {
  if (!points || points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Area of the intersection of two DOMRect-like boxes.
 * Used to decide which page a stamp landed on after a cross-page drag.
 *
 * @returns {number} overlapping area in px², 0 when disjoint
 */
export function overlapArea(a, b) {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return w * h
}
