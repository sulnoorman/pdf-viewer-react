import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePageVisibility, RENDER_MARGIN_PAGES } from './usePageVisibility.js'

/**
 * jsdom has no IntersectionObserver. This fake records the observed elements and
 * lets a test drive the callback, which is exactly the surface the hook depends on.
 */
class FakeIntersectionObserver {
  static instances = []

  constructor(callback) {
    this.callback = callback
    this.observed = new Set()
    FakeIntersectionObserver.instances.push(this)
  }

  observe(element) {
    this.observed.add(element)
  }
  unobserve(element) {
    this.observed.delete(element)
  }
  disconnect() {
    this.observed.clear()
  }

  /** @param {Array<{index: number, ratio: number}>} entries */
  emit(entries) {
    this.callback(
      entries.map(({ index, ratio }) => ({
        target: { dataset: { pageIndex: String(index) } },
        isIntersecting: ratio > 0,
        intersectionRatio: ratio,
      }))
    )
  }
}

function makePageElement(index) {
  const el = document.createElement('div')
  el.dataset.pageIndex = String(index)
  el.getBoundingClientRect = () => ({
    top: index * 800,
    left: 0,
    right: 500,
    bottom: index * 800 + 700,
    height: 700,
  })
  return el
}

function setup(pageCount = 10) {
  const container = document.createElement('div')
  // `height` matters: the active page is chosen from the fraction of the viewport a page
  // covers, so a rect without it measures nothing. A real getBoundingClientRect always
  // has one — only this stub could omit it.
  container.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    right: 500,
    bottom: 600,
    height: 600,
  })
  container.scrollTop = 0

  const containerRef = { current: container }
  const view = renderHook(() =>
    usePageVisibility({ pageCount, container, containerRef })
  )

  // Pages register themselves on mount.
  const elements = Array.from({ length: pageCount }, (_, i) => makePageElement(i))
  act(() => {
    for (let i = 0; i < pageCount; i += 1) view.result.current.registerPage(i, elements[i])
  })

  return { view, container, elements }
}

const latestObserver = () => FakeIntersectionObserver.instances.at(-1)

beforeEach(() => {
  FakeIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePageVisibility', () => {
  it('starts on the first page', () => {
    const { view } = setup()
    expect(view.result.current.activePageIndex).toBe(0)
    expect(view.result.current.activePageRef.current).toBe(0)
  })

  it('observes every registered page', () => {
    const { elements } = setup(5)
    expect(latestObserver().observed.size).toBe(elements.length)
  })

  it('stops observing a page that unregisters', () => {
    const { view } = setup(5)
    act(() => view.result.current.registerPage(2, null))
    expect(latestObserver().observed.size).toBe(4)
  })

  it('does not let an observer callback alone decide the active page', () => {
    /*
     * The cause of the reported "sometimes page 1, sometimes page 2".
     *
     * An observer callback carries only the pages that just crossed a threshold, so a
     * page crossing on its own used to win outright — even against a page filling the
     * screen, simply because that one was not in the same batch. The active page is now
     * measured from the live geometry of every page, so this batch changes nothing:
     * only page 0 is actually within the viewport here.
     *
     * The rule for which page wins is covered in usePageVisibility.test.jsx.
     */
    const { view } = setup()
    act(() =>
      latestObserver().emit([
        { index: 3, ratio: 0.3 },
        { index: 4, ratio: 0.7 },
      ])
    )
    expect(view.result.current.activePageIndex).toBe(0)
  })

  it('keeps activePageRef in step with the rendered index', () => {
    // The ref is what decides which page a newly added stamp lands on, and it is read
    // imperatively — so it drifting out of step would be invisible until a stamp
    // appeared on the wrong page.
    const { view } = setup()
    act(() => view.result.current.scrollToPage(6))
    expect(view.result.current.activePageIndex).toBe(6)
    expect(view.result.current.activePageRef.current).toBe(6)
  })

  it('renders the visible pages plus a margin either side', () => {
    const { view } = setup(20)
    act(() => latestObserver().emit([{ index: 10, ratio: 1 }]))

    const window = view.result.current.renderWindow
    for (let i = 10 - RENDER_MARGIN_PAGES; i <= 10 + RENDER_MARGIN_PAGES; i += 1) {
      expect(window.has(i)).toBe(true)
    }
    expect(window.has(10 - RENDER_MARGIN_PAGES - 1)).toBe(false)
    expect(window.has(10 + RENDER_MARGIN_PAGES + 1)).toBe(false)
  })

  it('clamps the render window at the document edges', () => {
    const { view } = setup(3)
    act(() => latestObserver().emit([{ index: 0, ratio: 1 }]))
    expect([...view.result.current.renderWindow]).toEqual([0, 1, 2])
  })

  it('spans a range when two pages are on screen at once', () => {
    const { view } = setup(20)
    act(() =>
      latestObserver().emit([
        { index: 7, ratio: 0.5 },
        { index: 8, ratio: 0.5 },
      ])
    )
    const window = view.result.current.renderWindow
    expect(window.has(7 - RENDER_MARGIN_PAGES)).toBe(true)
    expect(window.has(8 + RENDER_MARGIN_PAGES)).toBe(true)
  })

  it('drops pages from the window once they leave the viewport', () => {
    const { view } = setup(20)
    act(() => latestObserver().emit([{ index: 10, ratio: 1 }]))
    expect(view.result.current.renderWindow.has(10)).toBe(true)

    act(() =>
      latestObserver().emit([
        { index: 10, ratio: 0 },
        { index: 0, ratio: 1 },
      ])
    )
    expect(view.result.current.renderWindow.has(10)).toBe(false)
    expect(view.result.current.renderWindow.has(0)).toBe(true)
  })

  it('never leaves the render window empty', () => {
    const { view } = setup(5)
    act(() => latestObserver().emit([{ index: 0, ratio: 0 }]))
    expect(view.result.current.renderWindow.size).toBeGreaterThan(0)
  })

  describe('scrollToPage', () => {
    it('scrolls the container to the requested page', () => {
      const { view, container } = setup(10)
      act(() => view.result.current.scrollToPage(3))
      // Page 3 sits at top 2400 relative to a container at top 0, minus a 16px gutter.
      expect(container.scrollTop).toBe(3 * 800 - 16)
      expect(view.result.current.activePageIndex).toBe(3)
    })

    it('clamps out-of-range requests', () => {
      const { view } = setup(5)
      act(() => view.result.current.scrollToPage(99))
      expect(view.result.current.activePageIndex).toBe(4)

      act(() => view.result.current.scrollToPage(-7))
      expect(view.result.current.activePageIndex).toBe(0)
    })

    it('is a no-op for a page that has not registered', () => {
      const { view, container } = setup(5)
      act(() => view.result.current.registerPage(2, null))
      const before = container.scrollTop
      act(() => view.result.current.scrollToPage(2))
      expect(container.scrollTop).toBe(before)
    })
  })
})
