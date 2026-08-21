import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** Pages this far outside the viewport are still rendered, so scrolling stays smooth. */
export const RENDER_MARGIN_PAGES = 2

/**
 * How much of the viewport a page must cover to be eligible as the active page.
 *
 * The active page decides where a new stamp lands, so "which page am I looking at?" has
 * to match where the user is about to sign. With two pages on screen the *later* one
 * wins — scrolling down to reach a page and then having the stamp land on the one above
 * meant scrolling again to fetch it.
 *
 * The floor is what keeps that from being annoying in the other direction: a sliver of
 * the next page at the bottom edge must not steal the active page, or typing a page
 * number would appear to jump to the next one.
 */
export const ACTIVE_PAGE_MIN_COVERAGE = 0.25

/**
 * Which page the user is looking at, and which pages are worth rendering.
 *
 * One IntersectionObserver drives three things that used to be either missing or
 * separately implemented: the active page (for placing new stamps and for the page
 * indicator), the render window (virtualisation), and thumbnail highlighting.
 *
 * Pages register their container element themselves via a ref callback. The previous
 * implementation queried the DOM after `setTimeout(..., 100)`, which was a race: on a
 * slow first paint the observer attached to nothing and the active page stayed stuck
 * at 0, so a new stamp landed on page 1 wherever the user actually was.
 *
 * @param {{pageCount: number, container: HTMLElement|null, containerRef: React.RefObject<HTMLElement>}} params
 */
export function usePageVisibility({ pageCount, container, containerRef }) {
  const [activePageIndex, setActivePageIndex] = useState(0)
  const [intersecting, setIntersecting] = useState(() => new Set([0]))

  // Read by imperative callers (placing a stamp) without subscribing to re-renders.
  const activePageRef = useRef(0)

  const elementsRef = useRef(new Map())
  const observerRef = useRef(null)

  /**
   * Pick the active page from the live geometry of every registered page.
   *
   * Measured here rather than read from IntersectionObserver entries, for two reasons
   * that together produced "sometimes page 1, sometimes page 2" from the same scroll
   * position:
   *
   *   1. An observer callback carries only the pages that just crossed a threshold, so
   *      deciding from `entries` decides from a fragment of the picture. A page crossing
   *      0.25 on its own would win against a page covering most of the screen, simply
   *      because the other page was not in that batch.
   *   2. `intersectionRatio` is a fraction of the *element*, not of the viewport. A short
   *      page fully in view scores 1.0 while a tall page filling the screen scores 0.6,
   *      so the short one won while occupying less of it.
   *
   * Coverage here is the fraction of the viewport's height the page occupies, which is
   * what "how much of this page am I looking at" actually means.
   */
  const measureActivePage = useCallback(() => {
    const root = containerRef.current
    if (!root) return

    const rootRect = root.getBoundingClientRect()
    if (!rootRect.height) return

    let chosen = null
    // Falls back to whatever covers the most when nothing clears the floor — a page
    // zoomed in far enough that only a band of it is visible still needs to be active.
    let fallback = null
    let fallbackCoverage = 0

    for (const [index, element] of elementsRef.current) {
      const rect = element.getBoundingClientRect()
      const overlap =
        Math.min(rect.bottom, rootRect.bottom) - Math.max(rect.top, rootRect.top)
      if (overlap <= 0) continue

      const coverage = overlap / rootRect.height
      // Ties go to the later page here too, so the rule reads the same everywhere. The
      // index comparison also makes this independent of Map iteration order, which
      // follows registration and is not page order once virtualisation is remounting.
      if (coverage > fallbackCoverage || (coverage === fallbackCoverage && index > fallback)) {
        fallbackCoverage = coverage
        fallback = index
      }
      // Later page wins, which is the whole point of the rule.
      if (coverage >= ACTIVE_PAGE_MIN_COVERAGE && (chosen === null || index > chosen)) {
        chosen = index
      }
    }

    const next = chosen ?? fallback
    if (next === null || next === activePageRef.current) return

    activePageRef.current = next
    setActivePageIndex(next)
  }, [containerRef])

  const registerPage = useCallback(
    (pageIndex, element) => {
      const elements = elementsRef.current
      const previous = elements.get(pageIndex)
      if (previous && observerRef.current) observerRef.current.unobserve(previous)

      if (element) {
        elements.set(pageIndex, element)
        observerRef.current?.observe(element)
      } else {
        elements.delete(pageIndex)
      }
      // A page arriving or leaving changes the answer, and no scroll event follows.
      measureActivePage()
    },
    [measureActivePage]
  )

  useEffect(() => {
    const root = containerRef.current
    if (!container || !root) return

    const visible = new Set()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number.parseInt(entry.target.dataset.pageIndex, 10)
          if (Number.isNaN(index)) continue
          if (entry.isIntersecting) visible.add(index)
          else visible.delete(index)
        }

        // Replace rather than mutate so React sees a change.
        setIntersecting(new Set(visible))

        /*
         * The observer now drives virtualisation only. It also serves as a catch-all for
         * the active page: it fires on layout changes that produce no scroll event —
         * zooming, rotating a page, the container being resized.
         */
        measureActivePage()
      },
      // Only the boundary matters now that coverage is measured directly, so a single
      // threshold is enough; the graded list existed to feed the ratio comparison.
      { root, threshold: 0 }
    )

    observerRef.current = observer
    // Pages mounted before this effect ran still need observing.
    for (const element of elementsRef.current.values()) observer.observe(element)

    /*
     * Scroll is the real driver, and it is read straight from geometry rather than from
     * observer thresholds — between two thresholds an observer reports stale numbers, and
     * that staleness is what made the active page depend on how fast you scrolled.
     *
     * rAF-coalesced: a scroll fires far more often than a frame can paint, and each
     * measurement reads layout.
     */
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measureActivePage()
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    measureActivePage()

    return () => {
      container.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      observerRef.current = null
    }
  }, [container, containerRef, pageCount, measureActivePage])

  /**
   * The render window: everything on screen, plus a margin either side.
   *
   * Annotations are not affected by this — they live in the central store, so a page
   * that has never been scrolled into view still exports correctly.
   */
  const renderWindow = useMemo(() => {
    if (pageCount === 0) return new Set()
    if (intersecting.size === 0) return new Set([0])

    const indices = [...intersecting]
    const first = Math.max(0, Math.min(...indices) - RENDER_MARGIN_PAGES)
    const last = Math.min(pageCount - 1, Math.max(...indices) + RENDER_MARGIN_PAGES)

    const window = new Set()
    for (let i = first; i <= last; i += 1) window.add(i)
    return window
  }, [intersecting, pageCount])

  const scrollToPage = useCallback(
    (pageIndex) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, pageIndex))
      const element = elementsRef.current.get(clamped)
      const root = containerRef.current
      if (!element || !root) return

      // scrollIntoView would also scroll ancestors of the host app; adjusting the
      // container's own scrollTop keeps the effect contained to the viewer.
      const elementTop = element.getBoundingClientRect().top
      const rootTop = root.getBoundingClientRect().top
      root.scrollTop += elementTop - rootTop - 16

      activePageRef.current = clamped
      setActivePageIndex(clamped)
    },
    [pageCount, containerRef]
  )

  return { activePageIndex, activePageRef, renderWindow, registerPage, scrollToPage }
}
