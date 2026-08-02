import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** Pages this far outside the viewport are still rendered, so scrolling stays smooth. */
export const RENDER_MARGIN_PAGES = 2

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

  const registerPage = useCallback((pageIndex, element) => {
    const elements = elementsRef.current
    const previous = elements.get(pageIndex)
    if (previous && observerRef.current) observerRef.current.unobserve(previous)

    if (element) {
      elements.set(pageIndex, element)
      observerRef.current?.observe(element)
    } else {
      elements.delete(pageIndex)
    }
  }, [])

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

        // The most-covered page wins. Comparing ratios rather than taking the first
        // intersecting page keeps the indicator stable when two pages share the view.
        let bestRatio = 0
        let bestIndex = null
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio
            bestIndex = Number.parseInt(entry.target.dataset.pageIndex, 10)
          }
        }
        if (bestIndex !== null && !Number.isNaN(bestIndex)) {
          activePageRef.current = bestIndex
          setActivePageIndex(bestIndex)
        }
      },
      { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1] }
    )

    observerRef.current = observer
    // Pages mounted before this effect ran still need observing.
    for (const element of elementsRef.current.values()) observer.observe(element)

    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [container, containerRef, pageCount])

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
