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
