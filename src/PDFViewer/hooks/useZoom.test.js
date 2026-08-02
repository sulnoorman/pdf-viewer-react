import { describe, it, expect } from 'vitest'
import { calculateScaleForMode, clampScale, MIN_SCALE, MAX_SCALE, FIT_PADDING } from './useZoom.js'

const A4 = { width: 595, height: 842 }
const LANDSCAPE = { width: 1000, height: 400 }
const container = { width: 1000, height: 800 }

describe('clampScale', () => {
  it('keeps the scale inside the supported range', () => {
    expect(clampScale(0)).toBe(MIN_SCALE)
    expect(clampScale(-5)).toBe(MIN_SCALE)
    expect(clampScale(999)).toBe(MAX_SCALE)
    expect(clampScale(1.5)).toBe(1.5)
  })
})

describe('calculateScaleForMode', () => {
  it('returns exactly 1 for actual size regardless of container', () => {
    expect(calculateScaleForMode('actual-size', [A4], container)).toBe(1)
    expect(calculateScaleForMode('actual-size', [], null)).toBe(1)
  })

  it('fits the page width', () => {
    expect(calculateScaleForMode('page-width', [A4], container)).toBeCloseTo(
      (container.width - FIT_PADDING) / A4.width,
      9
    )
  })

  it('fits the whole page by the tighter axis', () => {
    const expected = Math.min(
      (container.width - FIT_PADDING) / A4.width,
      (container.height - FIT_PADDING) / A4.height
    )
    expect(calculateScaleForMode('page-fit', [A4], container)).toBeCloseTo(expected, 9)
  })

  it('caps automatic zoom at 125%', () => {
    // A small page in a wide window must not be blown up to fill it.
    const tiny = [{ width: 200, height: 300 }]
    expect(calculateScaleForMode('auto', tiny, container)).toBe(1.25)
  })

  it('lets automatic zoom shrink a page that does not fit', () => {
    const huge = [{ width: 4000, height: 3000 }]
    expect(calculateScaleForMode('auto', huge, container)).toBeLessThan(1)
  })

  it('sizes to the WIDEST page, not the first one', () => {
    // The regression: fit maths read page 1 only, so a landscape insert later in the
    // document overflowed horizontally.
    const mixed = [A4, LANDSCAPE]
    const scale = calculateScaleForMode('page-width', mixed, container)
    expect(scale).toBeCloseTo((container.width - FIT_PADDING) / LANDSCAPE.width, 9)
    expect(LANDSCAPE.width * scale).toBeLessThanOrEqual(container.width)
  })

  it('sizes page-fit to the tallest page too', () => {
    const mixed = [LANDSCAPE, A4]
    const scale = calculateScaleForMode('page-fit', mixed, container)
    expect(A4.height * scale).toBeLessThanOrEqual(container.height)
    expect(LANDSCAPE.width * scale).toBeLessThanOrEqual(container.width)
  })

  it('returns null when it cannot compute anything useful', () => {
    expect(calculateScaleForMode('page-width', [], container)).toBeNull()
    expect(calculateScaleForMode('page-width', [A4], { width: 0, height: 0 })).toBeNull()
    expect(calculateScaleForMode('custom', [A4], container)).toBeNull()
    expect(calculateScaleForMode('nonsense', [A4], container)).toBeNull()
  })
})
