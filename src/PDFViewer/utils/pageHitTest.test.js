import { describe, it, expect } from 'vitest'
import { resolveDropTarget } from './pageHitTest.js'

/** Build a detached DOM containing page containers at the given screen boxes. */
function makePages(boxes) {
  const root = document.createElement('div')
  boxes.forEach((box, index) => {
    const el = document.createElement('div')
    el.className = 'pdf-page-container'
    el.dataset.pageIndex = String(index)
    el.getBoundingClientRect = () => ({
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: box.right - box.left,
      height: box.bottom - box.top,
    })
    root.appendChild(el)
  })
  return root
}

// Two stacked pages with a 20px gutter, as the continuous scroll view lays them out.
const PAGES = [
  { left: 0, top: 0, right: 500, bottom: 700 },
  { left: 0, top: 720, right: 500, bottom: 1420 },
]

const rect = (left, top, right, bottom) => ({ left, top, right, bottom })

describe('resolveDropTarget', () => {
  it('returns the page a box sits entirely within', () => {
    const root = makePages(PAGES)
    expect(resolveDropTarget(rect(10, 10, 110, 60), root).pageIndex).toBe(0)
    expect(resolveDropTarget(rect(10, 800, 110, 850), root).pageIndex).toBe(1)
  })

  it('picks the page with the larger overlap when straddling a boundary', () => {
    const root = makePages(PAGES)
    // 690..760: 10px on page 0, 40px on page 1 -> page 1 wins.
    expect(resolveDropTarget(rect(10, 690, 110, 760), root).pageIndex).toBe(1)
    // 640..730: 60px on page 0, 10px on page 1 -> page 0 wins.
    expect(resolveDropTarget(rect(10, 640, 110, 730), root).pageIndex).toBe(0)
  })

  /*
   * These two used to expect null, and the caller then kept the annotation on the page it
   * was dragged FROM — which is wrong as soon as a drag has travelled: a stamp dropped in
   * the gutter before page 5 jumped back to page 1. Every drop now names a page, so the
   * caller always has bounds to clamp against and nothing can be left off the document.
   */
  it('falls back to the nearest page when dropped in the gutter', () => {
    const root = makePages(PAGES)
    // 702..718 sits in the 20px gutter, nearer page 0's centre than page 1's.
    expect(resolveDropTarget(rect(10, 702, 110, 718), root).pageIndex).toBe(0)
    // Just below the gutter's midpoint the nearer centre is page 1's.
    expect(resolveDropTarget(rect(10, 1000, 110, 1016), root).pageIndex).toBe(1)
  })

  it('falls back to the nearest page when dropped beside every page', () => {
    const root = makePages(PAGES)
    // Out in the margin at high zoom-out: level with page 0, so page 0 wins.
    expect(resolveDropTarget(rect(900, 10, 1000, 60), root).pageIndex).toBe(0)
    expect(resolveDropTarget(rect(900, 1300, 1000, 1350), root).pageIndex).toBe(1)
  })


  it('returns the page rect so the caller can rebase coordinates', () => {
    const root = makePages(PAGES)
    const target = resolveDropTarget(rect(10, 800, 110, 850), root)
    expect(target.pageRect.top).toBe(720)
    // Rebasing: a box at screen y=800 is 80pt down page 1.
    expect(800 - target.pageRect.top).toBe(80)
  })

  it('copes with no pages rendered yet', () => {
    expect(resolveDropTarget(rect(0, 0, 10, 10), makePages([]))).toBeNull()
  })
})
