/**
 * Ramer–Douglas–Peucker simplification for freehand strokes.
 *
 * A pointer emits a sample every few milliseconds, so a single scribble can carry a
 * thousand points that are visually collinear. Every one of them used to be written
 * into the exported SVG path, bloating the PDF and slowing rendering, for no visible
 * gain. Simplifying on release keeps the shape while discarding the redundancy.
 *
 * The tolerance is in view-space units (PDF points), so it is zoom-independent:
 * a stroke drawn at 400% is simplified exactly like the same stroke drawn at 100%.
 */

/** Squared distance from p to the segment ab — squared to avoid a sqrt per point. */
function segmentDistanceSq(p, a, b) {
  let x = a.x
  let y = a.y
  let dx = b.x - x
  let dy = b.y - y

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy)
    if (t > 1) {
      x = b.x
      y = b.y
    } else if (t > 0) {
      x += dx * t
      y += dy * t
    }
  }

  dx = p.x - x
  dy = p.y - y
  return dx * dx + dy * dy
}

/** Iterative RDP — recursion would blow the stack on a long stroke. */
function rdp(points, toleranceSq) {
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1

  const stack = [[0, points.length - 1]]

  while (stack.length) {
    const [first, last] = stack.pop()
    if (last - first < 2) continue

    let maxDistSq = 0
    let index = -1

    for (let i = first + 1; i < last; i += 1) {
      const distSq = segmentDistanceSq(points[i], points[first], points[last])
      if (distSq > maxDistSq) {
        maxDistSq = distSq
        index = i
      }
    }

    if (maxDistSq > toleranceSq && index !== -1) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }

  const result = []
  for (let i = 0; i < points.length; i += 1) if (keep[i]) result.push(points[i])
  return result
}

export const DEFAULT_TOLERANCE = 0.6

/**
 * @param {{x:number,y:number}[]} points raw samples in view space
 * @param {number} [tolerance] maximum deviation, in PDF points
 * @returns {{x:number,y:number}[]} simplified stroke, always keeping the endpoints
 */
export function simplifyPath(points, tolerance = DEFAULT_TOLERANCE) {
  if (!points || points.length <= 2) return points ? [...points] : []
  if (tolerance <= 0) return [...points]
  return rdp(points, tolerance * tolerance)
}
