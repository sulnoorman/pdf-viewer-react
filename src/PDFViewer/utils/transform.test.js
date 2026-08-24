import { describe, it, expect } from 'vitest'
import {
  rotatePoint,
  toLocalDelta,
  rectCenter,
  handleSigns,
  resizeRect,
  moveRect,
  angleFromCenter,
  snapAngle,
  normalizeAngle,
  pointOnRect,
  containRect,
  clampRectInto,
  shrinkRectInto,
  rotatedHalfExtents,
  RESIZE_HANDLES,
  MIN_BOX_SIZE,
} from './transform.js'

const RECT = { x: 100, y: 50, width: 200, height: 100 }
const close = (received, expected, precision = 6) => expect(received).toBeCloseTo(expected, precision)

describe('rotatePoint', () => {
  it('is identity at 0 and 360 degrees', () => {
    expect(rotatePoint({ x: 3, y: 4 }, 0)).toEqual({ x: 3, y: 4 })
    const full = rotatePoint({ x: 3, y: 4 }, 360)
    close(full.x, 3)
    close(full.y, 4)
  })

  it('rotates clockwise in screen coordinates', () => {
    // y grows downward, so +x rotated 90 deg clockwise points down.
    const result = rotatePoint({ x: 1, y: 0 }, 90)
    close(result.x, 0)
    close(result.y, 1)
  })

  it('preserves length', () => {
    for (const angle of [17, 45, 123, 271]) {
      const r = rotatePoint({ x: 3, y: 4 }, angle)
      close(Math.hypot(r.x, r.y), 5)
    }
  })

  it('round-trips through the inverse', () => {
    const point = { x: 12, y: -7 }
    for (const angle of [0, 30, 90, 180, 275]) {
      const back = rotatePoint(rotatePoint(point, angle), -angle)
      close(back.x, point.x)
      close(back.y, point.y)
    }
  })
})

describe('toLocalDelta', () => {
  it('undoes the frame rotation', () => {
    // Dragging right on screen, inside a frame rotated 90 deg clockwise, means
    // dragging "up" in the frame's own axes. This is the exact case react-rnd got
    // wrong: it treated the screen delta as the frame delta.
    const local = toLocalDelta({ x: 10, y: 0 }, 90)
    close(local.x, 0)
    close(local.y, -10)
  })

  it('is a no-op at zero rotation', () => {
    expect(toLocalDelta({ x: 5, y: -3 }, 0)).toEqual({ x: 5, y: -3 })
  })
})

describe('handleSigns', () => {
  it('maps each handle to the edges it moves', () => {
    expect(handleSigns('se')).toEqual({ signX: 1, signY: 1 })
    expect(handleSigns('nw')).toEqual({ signX: -1, signY: -1 })
    expect(handleSigns('n')).toEqual({ signX: 0, signY: -1 })
    expect(handleSigns('e')).toEqual({ signX: 1, signY: 0 })
  })

  it('returns no movement for an unknown handle', () => {
    expect(handleSigns('nope')).toEqual({ signX: 0, signY: 0 })
  })
})

describe('moveRect', () => {
  it('translates without touching the size', () => {
    expect(moveRect(RECT, { x: 10, y: -5 })).toEqual({
      x: 110,
      y: 45,
      width: 200,
      height: 100,
    })
  })
})

describe('resizeRect', () => {
  it('grows from the south-east handle keeping the north-west corner fixed', () => {
    const next = resizeRect({ rect: RECT, handle: 'se', delta: { x: 40, y: 20 } })
    expect(next).toEqual({ x: 100, y: 50, width: 240, height: 120 })
  })

  it('grows from the north-west handle keeping the south-east corner fixed', () => {
    const next = resizeRect({ rect: RECT, handle: 'nw', delta: { x: -40, y: -20 } })
    expect(next).toEqual({ x: 60, y: 30, width: 240, height: 120 })
    // South-east corner unchanged.
    expect(next.x + next.width).toBe(RECT.x + RECT.width)
    expect(next.y + next.height).toBe(RECT.y + RECT.height)
  })

  it('only touches one axis for edge handles', () => {
    const east = resizeRect({ rect: RECT, handle: 'e', delta: { x: 30, y: 999 } })
    expect(east.height).toBe(RECT.height)
    expect(east.width).toBe(230)

    const north = resizeRect({ rect: RECT, handle: 'n', delta: { x: 999, y: -10 } })
    expect(north.width).toBe(RECT.width)
    expect(north.height).toBe(110)
  })

  it('never shrinks below the minimum', () => {
    const next = resizeRect({ rect: RECT, handle: 'se', delta: { x: -9999, y: -9999 } })
    expect(next.width).toBe(MIN_BOX_SIZE)
    expect(next.height).toBe(MIN_BOX_SIZE)
  })

  it('is a no-op for an unknown handle', () => {
    expect(resizeRect({ rect: RECT, handle: 'nope', delta: { x: 10, y: 10 } })).toBe(RECT)
  })

  describe('with a locked aspect ratio', () => {
    const aspect = RECT.width / RECT.height

    it('keeps the ratio when dragging a corner', () => {
      const next = resizeRect({
        rect: RECT,
        handle: 'se',
        delta: { x: 100, y: 5 },
        lockAspectRatio: true,
      })
      close(next.width / next.height, aspect)
    })

    it('keeps the ratio when dragging an edge', () => {
      const next = resizeRect({
        rect: RECT,
        handle: 'e',
        delta: { x: 100, y: 0 },
        lockAspectRatio: true,
      })
      close(next.width / next.height, aspect)
    })

    it('keeps the ratio even when clamped at the minimum', () => {
      const next = resizeRect({
        rect: RECT,
        handle: 'se',
        delta: { x: -9999, y: -9999 },
        lockAspectRatio: true,
      })
      close(next.width / next.height, aspect)
      expect(Math.min(next.width, next.height)).toBeGreaterThanOrEqual(MIN_BOX_SIZE)
    })
  })

  describe('when the box is rotated', () => {
    /**
     * The contract that matters: whatever the rotation, the corner opposite the
     * dragged handle must not move on screen. Anything else and a rotated stamp
     * squirms away from the cursor as you resize it.
     */
    const anchorFor = (handle) => {
      const { signX, signY } = handleSigns(handle)
      return { x: signX === 1 ? 0 : 1, y: signY === 1 ? 0 : 1 }
    }

    it.each([0, 30, 90, 180, 270])('pins the opposite corner at %i degrees', (rotation) => {
      for (const handle of ['nw', 'ne', 'se', 'sw']) {
        const anchor = anchorFor(handle)
        const before = pointOnRect(RECT, anchor, rotation)

        const next = resizeRect({ rect: RECT, rotation, handle, delta: { x: 25, y: 15 } })
        const after = pointOnRect(next, anchor, rotation)

        close(after.x, before.x, 6)
        close(after.y, before.y, 6)
      }
    })

    it('still pins the anchor with a locked aspect ratio', () => {
      const rotation = 45
      const before = pointOnRect(RECT, { x: 0, y: 0 }, rotation)
      const next = resizeRect({
        rect: RECT,
        rotation,
        handle: 'se',
        delta: { x: 30, y: 30 },
        lockAspectRatio: true,
      })
      const after = pointOnRect(next, { x: 0, y: 0 }, rotation)
      close(after.x, before.x, 6)
      close(after.y, before.y, 6)
    })

    it('produces the same size as an unrotated resize', () => {
      // Rotation must change where the box sits, never how big it becomes.
      const plain = resizeRect({ rect: RECT, handle: 'se', delta: { x: 25, y: 15 } })
      const spun = resizeRect({ rect: RECT, rotation: 137, handle: 'se', delta: { x: 25, y: 15 } })
      close(spun.width, plain.width)
      close(spun.height, plain.height)
    })
  })
})

describe('angleFromCenter', () => {
  const centre = { x: 0, y: 0 }

  it('reports 0 straight up and grows clockwise', () => {
    close(angleFromCenter(centre, { x: 0, y: -10 }), 0)
    close(angleFromCenter(centre, { x: 10, y: 0 }), 90)
    close(angleFromCenter(centre, { x: 0, y: 10 }), 180)
    close(angleFromCenter(centre, { x: -10, y: 0 }), 270)
  })

  it('always returns a value in [0, 360)', () => {
    for (const point of [
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
    ]) {
      const angle = angleFromCenter(centre, point)
      expect(angle).toBeGreaterThanOrEqual(0)
      expect(angle).toBeLessThan(360)
    }
  })
})

describe('snapAngle / normalizeAngle', () => {
  it('snaps to the nearest step', () => {
    expect(snapAngle(7)).toBe(0)
    expect(snapAngle(8)).toBe(15)
    expect(snapAngle(44)).toBe(45)
    expect(snapAngle(358)).toBe(0)
  })

  it('honours a custom step', () => {
    expect(snapAngle(80, 90)).toBe(90)
    expect(snapAngle(44, 90)).toBe(0)
  })

  it('passes through unchanged when the step is zero', () => {
    expect(snapAngle(37, 0)).toBe(37)
  })

  it('wraps negatives and overflow', () => {
    expect(normalizeAngle(-90)).toBe(270)
    expect(normalizeAngle(450)).toBe(90)
    expect(normalizeAngle(0)).toBe(0)
  })
})

describe('pointOnRect', () => {
  it('returns the plain corners when unrotated', () => {
    expect(pointOnRect(RECT, RESIZE_HANDLES.nw)).toEqual({ x: 100, y: 50 })
    expect(pointOnRect(RECT, RESIZE_HANDLES.se)).toEqual({ x: 300, y: 150 })
    expect(pointOnRect(RECT, { x: 0.5, y: 0.5 })).toEqual(rectCenter(RECT))
  })

  it('leaves the centre fixed under rotation', () => {
    const centre = rectCenter(RECT)
    for (const rotation of [0, 45, 90, 200]) {
      const result = pointOnRect(RECT, { x: 0.5, y: 0.5 }, rotation)
      close(result.x, centre.x)
      close(result.y, centre.y)
    }
  })

  it('swaps corner positions at 180 degrees', () => {
    const nw = pointOnRect(RECT, RESIZE_HANDLES.nw, 180)
    const se = pointOnRect(RECT, RESIZE_HANDLES.se)
    close(nw.x, se.x)
    close(nw.y, se.y)
  })
})

describe('rotatedHalfExtents', () => {
  it('is half the rect when unrotated', () => {
    expect(rotatedHalfExtents(RECT)).toEqual({ x: 100, y: 50 })
  })

  it('swaps the axes at 90 degrees', () => {
    const half = rotatedHalfExtents(RECT, 90)
    close(half.x, 50)
    close(half.y, 100)
  })

  it('grows in both axes at 45 degrees', () => {
    // A 200x100 box turned 45 deg reaches out (200+100)/2/sqrt(2) each way.
    const half = rotatedHalfExtents(RECT, 45)
    close(half.x, 150 / Math.SQRT2)
    close(half.y, 150 / Math.SQRT2)
    expect(half.x).toBeGreaterThan(100)
  })
})

describe('containRect', () => {
  const PAGE = { width: 600, height: 800 }

  it('returns the very same object when the rect already fits', () => {
    /*
     * The property the whole feature rests on. Dragging a stamp and dropping it in open
     * page area must not move it by even a fraction of a point, so "already inside"
     * has to be a true no-op — identity, not an equal copy.
     */
    const rect = { x: 100, y: 100, width: 200, height: 100 }
    expect(containRect(rect, 0, PAGE)).toBe(rect)
  })

  it('treats an edge-flush rect as fitting', () => {
    const flush = { x: 0, y: 0, width: 200, height: 100 }
    expect(containRect(flush, 0, PAGE)).toBe(flush)

    const opposite = { x: 400, y: 700, width: 200, height: 100 }
    expect(containRect(opposite, 0, PAGE)).toBe(opposite)
  })

  it('slides a rect back in from each of the four edges', () => {
    const size = { width: 200, height: 100 }
    // Off the top: this is the reported bug — a specimen dragged above the page.
    expect(containRect({ x: 100, y: -60, ...size }, 0, PAGE)).toMatchObject({ x: 100, y: 0 })
    expect(containRect({ x: -40, y: 100, ...size }, 0, PAGE)).toMatchObject({ x: 0, y: 100 })
    expect(containRect({ x: 100, y: 900, ...size }, 0, PAGE)).toMatchObject({ x: 100, y: 700 })
    expect(containRect({ x: 700, y: 100, ...size }, 0, PAGE)).toMatchObject({ x: 400, y: 100 })
  })

  it('moves the shortest distance, not to a fixed margin', () => {
    // 10 over the top edge means 10 back down, and nothing on the untouched axis.
    const result = containRect({ x: 250, y: -10, width: 200, height: 100 }, 0, PAGE)
    expect(result).toMatchObject({ x: 250, y: 0 })
  })

  it('keeps the size and rotation untouched', () => {
    const result = containRect({ x: -40, y: -40, width: 200, height: 100 }, 30, PAGE)
    expect(result.width).toBe(200)
    expect(result.height).toBe(100)
  })

  it('contains the ROTATED bounding box, not just the rect', () => {
    /*
     * A rect flush against the top edge is inside; the same rect turned 45 deg is not,
     * because its corners now reach above it. Clamping the rect alone would leave a
     * corner of a rotated specimen poking off the page.
     */
    const flush = { x: 200, y: 0, width: 200, height: 100 }
    expect(containRect(flush, 0, PAGE)).toBe(flush)

    const turned = containRect(flush, 45, PAGE)
    expect(turned).not.toBe(flush)
    // Its centre has to drop to where the rotated half-height fits.
    close(rectCenter(turned).y, 150 / Math.SQRT2)
  })

  it('centres a box larger than the page rather than returning NaN', () => {
    // Reachable by resizing a stamp beyond the page, or on a very small page.
    const huge = { x: -500, y: -500, width: 900, height: 1200 }
    const result = containRect(huge, 0, PAGE)
    expect(result.x).toBe(600 / 2 - 900 / 2)
    expect(result.y).toBe(800 / 2 - 1200 / 2)
    expect(Number.isNaN(result.x)).toBe(false)
  })

  it('is a no-op without usable bounds', () => {
    const rect = { x: -100, y: -100, width: 50, height: 50 }
    expect(containRect(rect, 0, undefined)).toBe(rect)
    expect(containRect(rect, 0, { width: 0, height: 0 })).toBe(rect)
  })
})

describe('clampRectInto', () => {
  const size = { width: 200, height: 100 }
  // A page in the middle of a document: sides bind, top and bottom do not.
  const MIDDLE = { left: 0, right: 600, top: null, bottom: null }

  it('returns the very same object when nothing needs to move', () => {
    const rect = { x: 100, y: 100, ...size }
    expect(clampRectInto(rect, 0, MIDDLE)).toBe(rect)
  })

  it('holds the sides on a middle page but lets it travel vertically', () => {
    // This is what keeps dragging a stamp onto the next page working.
    expect(clampRectInto({ x: -50, y: -9999, ...size }, 0, MIDDLE)).toMatchObject({
      x: 0,
      y: -9999,
    })
    expect(clampRectInto({ x: 700, y: 9999, ...size }, 0, MIDDLE)).toMatchObject({
      x: 400,
      y: 9999,
    })
  })

  it('holds the top only on the first page', () => {
    const first = { left: 0, right: 600, top: 0, bottom: null }
    expect(clampRectInto({ x: 100, y: -80, ...size }, 0, first)).toMatchObject({ x: 100, y: 0 })
    // Still free downwards: the document continues below.
    const low = { x: 100, y: 5000, ...size }
    expect(clampRectInto(low, 0, first)).toBe(low)
  })

  it('holds the bottom only on the last page', () => {
    const last = { left: 0, right: 600, top: null, bottom: 800 }
    expect(clampRectInto({ x: 100, y: 900, ...size }, 0, last)).toMatchObject({ x: 100, y: 700 })
    const high = { x: 100, y: -5000, ...size }
    expect(clampRectInto(high, 0, last)).toBe(high)
  })

  it('holds a rotated box by its corners', () => {
    // Flush against the left edge unrotated; turned 45 deg its corners now reach past it.
    const flush = { x: 0, y: 300, ...size }
    expect(clampRectInto(flush, 0, MIDDLE)).toBe(flush)

    const turned = clampRectInto(flush, 45, MIDDLE)
    expect(turned).not.toBe(flush)
    close(rectCenter(turned).x, 150 / Math.SQRT2)
  })

  it('centres a box too large for the space rather than favouring one side', () => {
    const single = { left: 0, right: 600, top: 0, bottom: 800 }
    const wide = { x: -100, y: 100, width: 900, height: 100 }
    const result = clampRectInto(wide, 0, single)
    close(rectCenter(result).x, 300)
  })

  it('is a no-op without limits', () => {
    const rect = { x: -500, y: -500, ...size }
    expect(clampRectInto(rect, 0, undefined)).toBe(rect)
  })
})

describe('shrinkRectInto', () => {
  const LIMITS = { left: 0, right: 600, top: 0, bottom: 800 }

  /** The corner a resize holds still, as normalised coordinates. */
  const anchorFor = (handle) => {
    const { signX, signY } = handleSigns(handle)
    return { x: signX === 1 ? 0 : 1, y: signY === 1 ? 0 : 1 }
  }

  it('returns the very same object when the rect already fits', () => {
    const rect = { x: 100, y: 100, width: 200, height: 100 }
    expect(shrinkRectInto({ rect, handle: 'se', limits: LIMITS })).toBe(rect)
  })

  it('gives back size rather than position', () => {
    // Dragging the east handle past the right edge must stop the box growing, not slide
    // it left — the anchor corner is under the user's expectation, and the cursor is on
    // the edge they are pushing against.
    const rect = { x: 400, y: 100, width: 400, height: 100 }
    const result = shrinkRectInto({ rect, handle: 'e', limits: LIMITS })
    expect(result.x).toBe(400)
    expect(result.x + result.width).toBeCloseTo(600, 6)
  })

  it.each(['nw', 'ne', 'se', 'sw'])('keeps the %s anchor corner still', (handle) => {
    const rect = { x: -100, y: -100, width: 900, height: 1000 }
    const anchor = anchorFor(handle)
    const before = pointOnRect(rect, anchor)
    const after = pointOnRect(shrinkRectInto({ rect, handle, limits: LIMITS }), anchor)
    close(after.x, before.x)
    close(after.y, before.y)
  })

  it('brings the result inside the limits', () => {
    const rect = { x: 100, y: 100, width: 900, height: 1200 }
    const result = shrinkRectInto({ rect, handle: 'se', limits: LIMITS })
    expect(result.x + result.width).toBeLessThanOrEqual(600 + 1e-6)
    expect(result.y + result.height).toBeLessThanOrEqual(800 + 1e-6)
  })

  it('keeps the aspect ratio when locked', () => {
    const rect = { x: 0, y: 0, width: 900, height: 300 }
    const aspect = rect.width / rect.height
    const result = shrinkRectInto({ rect, handle: 'se', limits: LIMITS, lockAspectRatio: true })
    close(result.width / result.height, aspect)
    expect(result.width).toBeLessThanOrEqual(600 + 1e-6)
  })

  it('lets the axes shrink independently when not locked', () => {
    // A text box is not ratio-locked, so capping its width must not shorten it.
    const rect = { x: 0, y: 100, width: 900, height: 200 }
    const result = shrinkRectInto({ rect, handle: 'se', limits: LIMITS })
    expect(result.height).toBe(200)
    expect(result.width).toBeLessThan(900)
  })

  it('never shrinks below the minimum', () => {
    const tight = { left: 0, right: 4, top: 0, bottom: 4 }
    const rect = { x: 0, y: 0, width: 200, height: 200 }
    const result = shrinkRectInto({ rect, handle: 'se', limits: tight })
    expect(result.width).toBeGreaterThanOrEqual(MIN_BOX_SIZE)
    expect(result.height).toBeGreaterThanOrEqual(MIN_BOX_SIZE)
  })

  it('ignores an unconstrained side', () => {
    const rect = { x: 100, y: 100, width: 200, height: 5000 }
    const open = { left: 0, right: 600, top: null, bottom: null }
    expect(shrinkRectInto({ rect, handle: 'se', limits: open })).toBe(rect)
  })
})
