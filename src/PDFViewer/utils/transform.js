/**
 * Geometry for moving, resizing and rotating an annotation box.
 *
 * This exists because react-rnd has no concept of rotation: it derives drag deltas in
 * screen space, so the moment either the object or the page is rotated, dragging right
 * moves the object down. Both page rotation and stamp rotation need the same thing —
 * a box that can be manipulated inside a rotated frame — so the maths lives here, pure
 * and tested, and the component is a thin shell over it.
 *
 * ## Frames
 *
 * - **Frame space** — the page's own coordinate system, y down. Rects are stored here.
 * - **Local space** — the object's axes after its own `rotation` is applied.
 * - **Screen space** — CSS pixels. Differs from frame space by the page's rotation.
 *
 * A rect is `{ x, y, width, height }` describing the box *before* rotation; the box is
 * then rotated by `rotation` degrees clockwise about its own centre.
 */

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ x: number, y: number, width: number, height: number }} Rect */

/** Smallest box a user can resize to, in frame units. */
export const MIN_BOX_SIZE = 16

/** The eight resize handles, with their position in normalised box coordinates. */
export const RESIZE_HANDLES = Object.freeze({
  nw: { x: 0, y: 0 },
  n: { x: 0.5, y: 0 },
  ne: { x: 1, y: 0 },
  e: { x: 1, y: 0.5 },
  se: { x: 1, y: 1 },
  s: { x: 0.5, y: 1 },
  sw: { x: 0, y: 1 },
  w: { x: 0, y: 0.5 },
})

const toRadians = (degrees) => (degrees * Math.PI) / 180

/**
 * Rotate a vector clockwise (screen convention: y grows downward).
 *
 * The angle is wrapped first so a full turn is exactly the identity. Without that,
 * `sin(360°)` returns -2.4e-16 and that noise leaks all the way into the exported
 * PDF's coordinates.
 */
export function rotatePoint({ x, y }, degrees) {
  const wrapped = normalizeAngle(degrees ?? 0)
  if (!wrapped) return { x, y }
  const rad = toRadians(wrapped)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

/** Express a screen-space delta in the axes of a frame rotated by `degrees`. */
export function toLocalDelta(delta, degrees) {
  return rotatePoint(delta, -degrees)
}

/** Centre of a rect, in the frame the rect is expressed in. */
export function rectCenter({ x, y, width, height }) {
  return { x: x + width / 2, y: y + height / 2 }
}

/**
 * Which edges a handle moves. +1 grows the box in the positive axis direction,
 * -1 in the negative, 0 leaves that axis alone.
 */
export function handleSigns(handle) {
  const position = RESIZE_HANDLES[handle]
  if (!position) return { signX: 0, signY: 0 }
  return {
    signX: position.x === 0.5 ? 0 : position.x === 1 ? 1 : -1,
    signY: position.y === 0.5 ? 0 : position.y === 1 ? 1 : -1,
  }
}

/**
 * Resize a rect by dragging one handle, keeping the opposite corner visually pinned.
 *
 * `delta` is the pointer movement already expressed in the object's LOCAL axes — the
 * caller is responsible for undoing the frame and object rotation first. Because the
 * anchor must stay put on screen even when the box is rotated, the centre is shifted
 * by the size change rotated back into frame space.
 *
 * @param {object} params
 * @param {Rect} params.rect current rect, in frame space
 * @param {number} [params.rotation] the object's own rotation, degrees clockwise
 * @param {string} params.handle one of RESIZE_HANDLES
 * @param {Point} params.delta pointer delta in local axes
 * @param {boolean} [params.lockAspectRatio]
 * @param {number} [params.minSize]
 * @returns {Rect} the new rect, in frame space
 */
export function resizeRect({
  rect,
  rotation = 0,
  handle,
  delta,
  lockAspectRatio = false,
  minSize = MIN_BOX_SIZE,
}) {
  const { signX, signY } = handleSigns(handle)
  if (signX === 0 && signY === 0) return rect

  const { width, height } = rect
  let nextWidth = signX === 0 ? width : Math.max(minSize, width + signX * delta.x)
  let nextHeight = signY === 0 ? height : Math.max(minSize, height + signY * delta.y)

  if (lockAspectRatio && width > 0 && height > 0) {
    const aspect = width / height

    if (signX !== 0 && signY !== 0) {
      // Corner drag: follow whichever axis the user moved further, proportionally.
      const growthX = Math.abs(nextWidth / width - 1)
      const growthY = Math.abs(nextHeight / height - 1)
      if (growthX >= growthY) nextHeight = nextWidth / aspect
      else nextWidth = nextHeight * aspect
    } else if (signX !== 0) {
      nextHeight = nextWidth / aspect
    } else {
      nextWidth = nextHeight * aspect
    }

    // Clamping one axis has to pull the other with it or the ratio drifts.
    if (nextWidth < minSize) {
      nextWidth = minSize
      nextHeight = nextWidth / aspect
    }
    if (nextHeight < minSize) {
      nextHeight = minSize
      nextWidth = nextHeight * aspect
    }
  }

  // Growing to the east moves the centre east by half the growth, and so on. Rotating
  // that shift back into frame space is what keeps the anchor corner still on screen.
  const shift = rotatePoint(
    { x: (signX * (nextWidth - width)) / 2, y: (signY * (nextHeight - height)) / 2 },
    rotation
  )

  const centre = rectCenter(rect)
  return {
    x: centre.x + shift.x - nextWidth / 2,
    y: centre.y + shift.y - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
  }
}

/** Move a rect by a delta already expressed in frame space. */
export function moveRect(rect, delta) {
  return { ...rect, x: rect.x + delta.x, y: rect.y + delta.y }
}

/** Angle in degrees from a centre to a point, 0 = straight up, growing clockwise. */
export function angleFromCenter(center, point) {
  const degrees = (Math.atan2(point.x - center.x, center.y - point.y) * 180) / Math.PI
  return (degrees + 360) % 360
}

/** Snap an angle to the nearest step; used while Shift is held. */
export function snapAngle(degrees, step = 15) {
  if (!step) return normalizeAngle(degrees)
  return normalizeAngle(Math.round(degrees / step) * step)
}

/** Wrap any angle into [0, 360). */
export function normalizeAngle(degrees) {
  return ((degrees % 360) + 360) % 360
}

/**
 * Map a point expressed as an offset from the box centre, in the box's own rotated
 * axes, into the frame the rect lives in.
 *
 * This is the bridge between "where something sits inside the box" (a text baseline,
 * a corner) and "where that ends up on the page once the box is rotated".
 *
 * @param {Rect} rect
 * @param {Point} offset from the centre, in local axes
 * @param {number} [rotation] degrees clockwise
 */
export function localOffsetToFrame(rect, offset, rotation = 0) {
  const centre = rectCenter(rect)
  const rotated = rotatePoint(offset, rotation)
  return { x: centre.x + rotated.x, y: centre.y + rotated.y }
}

/**
 * Frame-space position of a normalised point inside a rotated box.
 * Used to place resize handles on the correct visual corner once rotated.
 *
 * @param {Rect} rect
 * @param {Point} normalized 0..1 in each axis
 * @param {number} rotation degrees clockwise
 */
export function pointOnRect(rect, normalized, rotation = 0) {
  return localOffsetToFrame(
    rect,
    { x: (normalized.x - 0.5) * rect.width, y: (normalized.y - 0.5) * rect.height },
    rotation
  )
}

/** Rotate a list of points about a pivot. Used to bake ink rotation into its points. */
export function rotatePointsAround(points, pivot, rotation = 0) {
  if (!rotation) return points
  return points.map((point) => {
    const rotated = rotatePoint({ x: point.x - pivot.x, y: point.y - pivot.y }, rotation)
    return { x: pivot.x + rotated.x, y: pivot.y + rotated.y }
  })
}
