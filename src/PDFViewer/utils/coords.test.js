import { describe, it, expect } from 'vitest'
import {
  normalizeRotation,
  viewSize,
  screenToView,
  viewToScreen,
  screenRectToView,
  viewRectToScreen,
  viewPointToPdf,
  pdfPointToView,
  viewRectToPdf,
  viewOriginToPdf,
  pointsBBox,
  overlapArea,
  displayPageSize,
  VALID_ROTATIONS,
} from './coords.js'

// A deliberately non-square page so a transposed width/height cannot pass unnoticed.
const W = 600
const H = 800

const box = (rotate) => ({ pageWidth: W, pageHeight: H, rotate })

describe('normalizeRotation', () => {
  it('passes through the four legal values', () => {
    for (const r of VALID_ROTATIONS) expect(normalizeRotation(r)).toBe(r)
  })

  it('wraps values seen in real PDFs', () => {
    expect(normalizeRotation(360)).toBe(0)
    expect(normalizeRotation(450)).toBe(90)
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(-270)).toBe(90)
  })

  it('falls back to 0 for junk', () => {
    expect(normalizeRotation(undefined)).toBe(0)
    expect(normalizeRotation(null)).toBe(0)
    expect(normalizeRotation('nope')).toBe(0)
  })
})

describe('viewSize', () => {
  it('swaps the axes for quarter turns only', () => {
    expect(viewSize(box(0))).toEqual({ width: W, height: H })
    expect(viewSize(box(180))).toEqual({ width: W, height: H })
    expect(viewSize(box(90))).toEqual({ width: H, height: W })
    expect(viewSize(box(270))).toEqual({ width: H, height: W })
  })
})

describe('displayPageSize', () => {
  const base = { width: 400, height: 700 }

  it('swaps the axes for quarter turns only', () => {
    expect(displayPageSize(base, 0)).toEqual({ width: 400, height: 700 })
    expect(displayPageSize(base, 180)).toEqual({ width: 400, height: 700 })
    expect(displayPageSize(base, 90)).toEqual({ width: 700, height: 400 })
    expect(displayPageSize(base, 270)).toEqual({ width: 700, height: 400 })
  })

  it('normalises the angle first', () => {
    expect(displayPageSize(base, 450)).toEqual(displayPageSize(base, 90))
    expect(displayPageSize(base, -90)).toEqual(displayPageSize(base, 270))
    expect(displayPageSize(base, 360)).toEqual(displayPageSize(base, 0))
  })

  it('returns to the original size after four turns', () => {
    let size = base
    for (let i = 0; i < 4; i += 1) size = displayPageSize(size, 90)
    expect(size).toEqual(base)
  })

  it('copes with a missing page size', () => {
    expect(displayPageSize(undefined, 90)).toEqual({ width: 0, height: 0 })
  })
})

describe('screen <-> view', () => {
  it('round-trips a point through any scale', () => {
    for (const scale of [0.1, 0.5, 1, 2.5, 10]) {
      const pt = { x: 123.4, y: 567.8 }
      const back = viewToScreen(screenToView(pt, scale), scale)
      expect(back.x).toBeCloseTo(pt.x, 9)
      expect(back.y).toBeCloseTo(pt.y, 9)
    }
  })

  it('round-trips a rect through any scale', () => {
    const rect = { x: 10, y: 20, width: 30, height: 40 }
    for (const scale of [0.25, 1, 3.75]) {
      expect(viewRectToScreen(screenRectToView(rect, scale), scale)).toEqual(rect)
    }
  })
})

describe('viewPointToPdf / pdfPointToView', () => {
  it.each(VALID_ROTATIONS)('round-trips for /Rotate %i', (rotate) => {
    const view = { x: 137, y: 249 }
    const back = pdfPointToView(viewPointToPdf(view, box(rotate)), box(rotate))
    expect(back.x).toBeCloseTo(view.x, 9)
    expect(back.y).toBeCloseTo(view.y, 9)
  })

  it('maps the view origin to the expected user-space corner', () => {
    // View (0,0) is the top-left of the page *as displayed*.
    expect(viewPointToPdf({ x: 0, y: 0 }, box(0))).toEqual({ x: 0, y: H })
    expect(viewPointToPdf({ x: 0, y: 0 }, box(90))).toEqual({ x: 0, y: 0 })
    expect(viewPointToPdf({ x: 0, y: 0 }, box(180))).toEqual({ x: W, y: 0 })
    expect(viewPointToPdf({ x: 0, y: 0 }, box(270))).toEqual({ x: W, y: H })
  })

  it('keeps every mapped point inside the page box', () => {
    for (const rotate of VALID_ROTATIONS) {
      const v = viewSize(box(rotate))
      const corners = [
        { x: 0, y: 0 },
        { x: v.width, y: 0 },
        { x: 0, y: v.height },
        { x: v.width, y: v.height },
      ]
      for (const c of corners) {
        const p = viewPointToPdf(c, box(rotate))
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(W)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeLessThanOrEqual(H)
      }
    }
  })
})

describe('viewRectToPdf', () => {
  const rect = { x: 50, y: 70, width: 120, height: 40 }

  /**
   * The contract: pdf-lib anchors a box at its bottom-left corner and rotates the box
   * about that anchor by `rotate` degrees counter-clockwise. Reconstructing the four
   * drawn corners from (anchor, rotate, w, h) must reproduce exactly the four view
   * corners mapped individually through viewPointToPdf.
   */
  function drawnCorners({ x, y, rotate }, width, height) {
    const rad = (rotate * Math.PI) / 180
    const cos = Math.round(Math.cos(rad))
    const sin = Math.round(Math.sin(rad))
    // Local axes of the box after rotation.
    const ux = { x: cos, y: sin } // local +x (box width direction)
    const uy = { x: -sin, y: cos } // local +y (box height direction, "up")
    return {
      bottomLeft: { x, y },
      bottomRight: { x: x + ux.x * width, y: y + ux.y * width },
      topLeft: { x: x + uy.x * height, y: y + uy.y * height },
      topRight: {
        x: x + ux.x * width + uy.x * height,
        y: y + ux.y * width + uy.y * height,
      },
    }
  }

  it.each(VALID_ROTATIONS)('places all four corners correctly for /Rotate %i', (rotate) => {
    const anchor = viewRectToPdf(rect, box(rotate))
    const drawn = drawnCorners(anchor, rect.width, rect.height)

    // View-space corners. Remember view y grows downward, so "bottom" is y + height.
    const expected = {
      topLeft: viewPointToPdf({ x: rect.x, y: rect.y }, box(rotate)),
      topRight: viewPointToPdf({ x: rect.x + rect.width, y: rect.y }, box(rotate)),
      bottomLeft: viewPointToPdf({ x: rect.x, y: rect.y + rect.height }, box(rotate)),
      bottomRight: viewPointToPdf({ x: rect.x + rect.width, y: rect.y + rect.height }, box(rotate)),
    }

    for (const corner of ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']) {
      expect(drawn[corner].x).toBeCloseTo(expected[corner].x, 6)
      expect(drawn[corner].y).toBeCloseTo(expected[corner].y, 6)
    }
  })

  it('reproduces the historical unrotated formula', () => {
    // Guards the regression path: before coords.js this was hand-written as
    // `y: pageHeight - stamp.y - stamp.height` in three separate places.
    expect(viewRectToPdf(rect, box(0))).toEqual({
      x: rect.x,
      y: H - rect.y - rect.height,
      rotate: 0,
    })
  })

  it('reports the rotation pdf-lib must apply so content stays upright', () => {
    for (const rotate of VALID_ROTATIONS) {
      expect(viewRectToPdf(rect, box(rotate)).rotate).toBe(rotate)
    }
  })

  describe('with the annotation itself rotated', () => {
    /**
     * The regression this locks down: `annotation.rotation` was never passed here, so
     * a stamp the user had turned upright on screen still exported lying flat. The
     * viewer showed one thing and the file contained another.
     */
    it('changes the exported angle when the object is rotated', () => {
      const upright = viewRectToPdf(rect, box(0), 0)
      const turned = viewRectToPdf(rect, box(0), 90)
      expect(turned.rotate).not.toBe(upright.rotate)
    })

    it('composes object rotation with page rotation as page − object', () => {
      // View space is y-down and PDF user space is y-up, so a clockwise turn on
      // screen is a counter-clockwise turn in the file: the two subtract.
      expect(viewRectToPdf(rect, box(0), 90).rotate).toBe(270)
      expect(viewRectToPdf(rect, box(90), 90).rotate).toBe(0)
      expect(viewRectToPdf(rect, box(180), 90).rotate).toBe(90)
      expect(viewRectToPdf(rect, box(90), 270).rotate).toBe(180)
    })

    it('always reports an angle in [0, 360)', () => {
      for (const pageRotate of VALID_ROTATIONS) {
        for (const objectRotation of [0, 37, 90, 180, 270, 359]) {
          const { rotate } = viewRectToPdf(rect, box(pageRotate), objectRotation)
          expect(rotate).toBeGreaterThanOrEqual(0)
          expect(rotate).toBeLessThan(360)
        }
      }
    })

    it.each([0, 45, 90, 180, 270])(
      'places all four corners correctly when the object is turned %i degrees',
      (objectRotation) => {
        const pageRotate = 0
        const anchor = viewRectToPdf(rect, box(pageRotate), objectRotation)

        // Reconstruct the drawn box from pdf-lib's contract: anchor is the box's
        // bottom-left, rotated `anchor.rotate` degrees counter-clockwise about itself.
        const rad = (anchor.rotate * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const ux = { x: cos, y: sin }
        const uy = { x: -sin, y: cos }

        const drawn = {
          bottomLeft: { x: anchor.x, y: anchor.y },
          bottomRight: { x: anchor.x + ux.x * rect.width, y: anchor.y + ux.y * rect.width },
          topLeft: { x: anchor.x + uy.x * rect.height, y: anchor.y + uy.y * rect.height },
        }

        // Independently: rotate the box corners in view space, then map to PDF.
        const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        const spin = ({ x, y }) => {
          const r = (objectRotation * Math.PI) / 180
          return {
            x: centre.x + (x * Math.cos(r) - y * Math.sin(r)),
            y: centre.y + (x * Math.sin(r) + y * Math.cos(r)),
          }
        }
        const half = { w: rect.width / 2, h: rect.height / 2 }
        const expected = {
          bottomLeft: viewPointToPdf(spin({ x: -half.w, y: half.h }), box(pageRotate)),
          bottomRight: viewPointToPdf(spin({ x: half.w, y: half.h }), box(pageRotate)),
          topLeft: viewPointToPdf(spin({ x: -half.w, y: -half.h }), box(pageRotate)),
        }

        for (const corner of ['bottomLeft', 'bottomRight', 'topLeft']) {
          expect(drawn[corner].x).toBeCloseTo(expected[corner].x, 6)
          expect(drawn[corner].y).toBeCloseTo(expected[corner].y, 6)
        }
      }
    )

    it('leaves the unrotated case byte-identical to before', () => {
      // Guards the generalisation: adding object rotation must not disturb the
      // already-verified page-rotation maths.
      for (const pageRotate of VALID_ROTATIONS) {
        expect(viewRectToPdf(rect, box(pageRotate), 0)).toEqual(
          viewRectToPdf(rect, box(pageRotate))
        )
      }
    })
  })
})

describe('viewOriginToPdf', () => {
  it('matches the historical ink anchor on unrotated pages', () => {
    // drawSvgPath was previously anchored at { x: 0, y: pageHeight }.
    expect(viewOriginToPdf(box(0))).toEqual({ x: 0, y: H, rotate: 0 })
  })

  it('agrees with viewPointToPdf for every rotation', () => {
    for (const rotate of VALID_ROTATIONS) {
      const origin = viewOriginToPdf(box(rotate))
      expect(origin).toMatchObject(viewPointToPdf({ x: 0, y: 0 }, box(rotate)))
      expect(origin.rotate).toBe(rotate)
    }
  })
})

describe('pointsBBox', () => {
  it('returns an empty rect for no points', () => {
    expect(pointsBBox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(pointsBBox(undefined)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  it('bounds a stroke', () => {
    const points = [
      { x: 10, y: 40 },
      { x: 5, y: 90 },
      { x: 70, y: 20 },
    ]
    expect(pointsBBox(points)).toEqual({ x: 5, y: 20, width: 65, height: 70 })
  })

  it('handles a single point as a zero-sized box', () => {
    expect(pointsBBox([{ x: 3, y: 4 }])).toEqual({ x: 3, y: 4, width: 0, height: 0 })
  })
})

describe('overlapArea', () => {
  const r = (left, top, right, bottom) => ({ left, top, right, bottom })

  it('is zero for disjoint boxes', () => {
    expect(overlapArea(r(0, 0, 10, 10), r(20, 20, 30, 30))).toBe(0)
  })

  it('is zero for boxes touching on an edge', () => {
    expect(overlapArea(r(0, 0, 10, 10), r(10, 0, 20, 10))).toBe(0)
  })

  it('measures a partial overlap', () => {
    expect(overlapArea(r(0, 0, 10, 10), r(5, 5, 15, 15))).toBe(25)
  })

  it('measures full containment as the inner area', () => {
    expect(overlapArea(r(0, 0, 100, 100), r(10, 10, 20, 30))).toBe(200)
  })
})
