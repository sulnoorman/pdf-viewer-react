import { describe, it, expect, vi, beforeAll } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { usePageVisibility, ACTIVE_PAGE_MIN_COVERAGE } from './usePageVisibility.js'

beforeAll(() => {
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  // jsdom has no rAF in some configurations, and the hook coalesces scrolls through it.
  if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(0), 0)
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
  }
})

const VIEWPORT_HEIGHT = 800

/** A scroll container whose viewport spans y = 0..800 on screen. */
function makeContainer() {
  const element = document.createElement('div')
  element.getBoundingClientRect = () => ({
    top: 0,
    bottom: VIEWPORT_HEIGHT,
    height: VIEWPORT_HEIGHT,
    left: 0,
    right: 600,
    width: 600,
  })
  element.addEventListener = vi.fn()
  element.removeEventListener = vi.fn()
  document.body.appendChild(element)
  return element
}

/** A page positioned at an arbitrary place relative to that viewport. */
function makePage(index, { top, height }) {
  const element = document.createElement('div')
  element.dataset.pageIndex = String(index)
  element.getBoundingClientRect = () => ({
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 600,
    width: 600,
  })
  return element
}

/**
 * Drive the hook with a given page layout and read back the active page.
 *
 * `registerPage` triggers a measurement, so simply registering the pages is enough — no
 * scroll event needed, which is also what makes the first paint correct.
 */
function activePageFor(layout) {
  const container = makeContainer()
  const { result } = renderHook(() => {
    const containerRef = useRef(container)
    return usePageVisibility({ pageCount: layout.length, container, containerRef })
  })

  act(() => {
    layout.forEach((box, index) => result.current.registerPage(index, makePage(index, box)))
  })

  return result.current.activePageIndex
}

describe('active page', () => {
  it('is the only page on screen', () => {
    expect(activePageFor([{ top: 0, height: 800 }])).toBe(0)
  })

  it('is the LATER page when two share the viewport', () => {
    /*
     * The reported problem. Scrolling down until the next page appears and then stamping
     * put the stamp on the page above, so it had to be fetched by scrolling again.
     *
     * Page 1 covers 65% here and still loses — deliberately. The active page decides
     * where a stamp lands, and the page you scrolled towards is the one you meant.
     */
    const active = activePageFor([
      { top: -280, height: 800 }, // page 1: 520px visible = 65%
      { top: 520, height: 800 }, // page 2: 280px visible = 35%
    ])
    expect(active).toBe(1)
  })

  it('ignores a sliver of the next page', () => {
    /*
     * The other direction, and why the rule has a floor. Without it, a few pixels of the
     * next page at the bottom edge would move the active page — so typing a page number
     * would appear to jump, and a stamp would land on a page barely on screen.
     */
    const active = activePageFor([
      { top: -20, height: 800 }, // page 1: 780px visible = 97.5%
      { top: 780, height: 800 }, // page 2: 20px visible = 2.5%
    ])
    expect(active).toBe(0)
  })

  it('takes the later page exactly at the threshold', () => {
    const visible = VIEWPORT_HEIGHT * ACTIVE_PAGE_MIN_COVERAGE
    const active = activePageFor([
      { top: VIEWPORT_HEIGHT - visible - 800, height: 800 },
      { top: VIEWPORT_HEIGHT - visible, height: 800 },
    ])
    expect(active).toBe(1)
  })

  it('picks the last of three when several clear the threshold', () => {
    const active = activePageFor([
      { top: -500, height: 800 }, // 300px = 37.5%
      { top: 300, height: 250 }, // 250px = 31.25%
      { top: 550, height: 800 }, // 250px = 31.25%
    ])
    expect(active).toBe(2)
  })

  it('falls back to the most-covered page when nothing clears the threshold', () => {
    /*
     * Reachable when zoomed out far enough that several short pages share the screen and
     * none of them reaches a quarter of it. Returning nothing there would leave the
     * active page stale, sending stamps to wherever the user last was.
     */
    const active = activePageFor([
      { top: 0, height: 150 }, // 18.75%
      { top: 150, height: 150 }, // 18.75%
      { top: 300, height: 190 }, // 23.75% — the most covered
      { top: 490, height: 150 }, // 18.75%
    ])
    expect(active).toBe(2)
  })

  it('breaks a fallback tie towards the later page, in registration order or not', () => {
    // The rule should read the same everywhere, and must not depend on which order
    // virtualisation happened to mount the pages in.
    const container = makeContainer()
    const { result } = renderHook(() => {
      const containerRef = useRef(container)
      return usePageVisibility({ pageCount: 4, container, containerRef })
    })

    const boxes = [
      { top: 0, height: 150 },
      { top: 150, height: 150 },
      { top: 300, height: 150 },
      { top: 450, height: 150 },
    ]
    act(() => {
      // Deliberately out of order.
      for (const index of [2, 0, 3, 1]) {
        result.current.registerPage(index, makePage(index, boxes[index]))
      }
    })

    expect(result.current.activePageIndex).toBe(3)
  })

  it('ignores pages entirely outside the viewport', () => {
    const active = activePageFor([
      { top: 0, height: 800 },
      { top: 900, height: 800 }, // below the fold
      { top: 1800, height: 800 },
    ])
    expect(active).toBe(0)
  })
})

describe('render window', () => {
  it('covers the visible pages plus a margin, clamped to the document', () => {
    const container = makeContainer()
    const { result } = renderHook(() => {
      const containerRef = useRef(container)
      return usePageVisibility({ pageCount: 3, container, containerRef })
    })
    // Nothing has intersected yet, so the first page still renders — otherwise the viewer
    // would show nothing until an observer callback arrived.
    expect(result.current.renderWindow.has(0)).toBe(true)
  })
})
