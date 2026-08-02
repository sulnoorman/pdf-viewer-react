import { describe, it, expect } from 'vitest'
import { simplifyPath, DEFAULT_TOLERANCE } from './inkSimplify.js'

describe('simplifyPath', () => {
  it('passes through degenerate inputs', () => {
    expect(simplifyPath([])).toEqual([])
    expect(simplifyPath(undefined)).toEqual([])
    const one = [{ x: 1, y: 2 }]
    expect(simplifyPath(one)).toEqual(one)
    const two = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ]
    expect(simplifyPath(two)).toEqual(two)
  })

  it('collapses a straight line to its endpoints', () => {
    const line = Array.from({ length: 200 }, (_, i) => ({ x: i, y: 0 }))
    expect(simplifyPath(line)).toEqual([
      { x: 0, y: 0 },
      { x: 199, y: 0 },
    ])
  })

  it('always keeps the first and last point', () => {
    const points = Array.from({ length: 50 }, (_, i) => ({ x: i, y: Math.sin(i) * 0.01 }))
    const result = simplifyPath(points)
    expect(result[0]).toEqual(points[0])
    expect(result.at(-1)).toEqual(points.at(-1))
  })

  it('keeps corners that carry the shape', () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 25, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 25 },
      { x: 50, y: 50 },
    ]
    expect(simplifyPath(lShape)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
    ])
  })

  it('discards deviations under the tolerance and keeps those above it', () => {
    const withBump = (height) => [
      { x: 0, y: 0 },
      { x: 50, y: height },
      { x: 100, y: 0 },
    ]
    expect(simplifyPath(withBump(0.1), 1)).toHaveLength(2)
    expect(simplifyPath(withBump(5), 1)).toHaveLength(3)
  })

  it('substantially shrinks a realistic scribble', () => {
    // A hand-drawn stroke sampled at pointer rate: dense samples along a smooth curve.
    const scribble = Array.from({ length: 1200 }, (_, i) => ({
      x: i * 0.4,
      y: Math.sin(i / 40) * 30,
    }))
    const result = simplifyPath(scribble)
    expect(result.length).toBeLessThan(scribble.length / 8)
    expect(result.length).toBeGreaterThan(4)
  })

  it('never mutates the input', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 10 },
      { x: 2, y: 0 },
    ]
    const copy = JSON.parse(JSON.stringify(points))
    simplifyPath(points)
    expect(points).toEqual(copy)
  })

  it('returns every point when tolerance is zero', () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0 }))
    expect(simplifyPath(points, 0)).toHaveLength(10)
  })

  it('handles a very long stroke without recursing', () => {
    // Iterative RDP: a 100k-point stroke must not overflow the stack.
    const long = Array.from({ length: 100_000 }, (_, i) => ({ x: i, y: (i % 7) * 0.05 }))
    expect(() => simplifyPath(long, DEFAULT_TOLERANCE)).not.toThrow()
  })
})
