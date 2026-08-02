import { useState, useEffect, useRef, useCallback } from 'react'

export const MIN_SCALE = 0.1
export const MAX_SCALE = 10
export const FIT_PADDING = 40

/** Zoom modes offered in the toolbar, plus 'custom' for an arbitrary scale. */
export const ZOOM_MODES = ['auto', 'actual-size', 'page-fit', 'page-width', 'custom']

export const clampScale = (value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

/**
 * Compute the scale for a fit mode.
 *
 * Uses the widest and tallest page in the document rather than page 1, so a file that
 * mixes A4 portrait with a landscape insert no longer overflows horizontally.
 *
 * Exported separately from the hook so it can be unit tested without a DOM.
 *
 * @param {string} mode
 * @param {{width:number,height:number}[]} pageSizes at scale 1
 * @param {{width:number,height:number}} container client box
 * @returns {number|null} null when the mode does not imply a computed scale
 */
export function calculateScaleForMode(mode, pageSizes, container) {
  if (mode === 'actual-size') return 1
  if (!pageSizes?.length || !container?.width || !container?.height) return null

  const widest = Math.max(...pageSizes.map((p) => p.width))
  const tallest = Math.max(...pageSizes.map((p) => p.height))

  const fitWidth = (container.width - FIT_PADDING) / widest
  const fitHeight = (container.height - FIT_PADDING) / tallest

  switch (mode) {
    case 'page-width':
      return fitWidth
    case 'page-fit':
      return Math.min(fitWidth, fitHeight)
    case 'auto':
      // Never blow a small page up past 125% just because the window is wide.
      return Math.min(fitWidth, 1.25)
    default:
      return null
  }
}

/**
 * Zoom state, fit modes, wheel/pinch handling and scroll anchoring.
 *
 * @param {object} params
 * @param {object[]} params.pageSizes
 * @param {HTMLElement|null} params.container presence signal: effects must re-run when
 *   the container appears, and a ref mutation alone does not trigger that
 * @param {React.RefObject<HTMLElement>} params.containerRef handle used to read and
 *   mutate scroll offsets; state values are treated as immutable by React's lint rules
 */
export function useZoom({ pageSizes, container, containerRef }) {
  const [scale, setScaleState] = useState(1)
  const [zoomMode, setZoomMode] = useState('auto')

  // Where to re-anchor the scroll position after the next scale change.
  const pendingScrollRef = useRef(null)
  const prevScaleRef = useRef(scale)

  /** Set an explicit scale; this always means the user left the fit modes behind. */
  const setScale = useCallback((next) => {
    setScaleState((current) => clampScale(typeof next === 'function' ? next(current) : next))
    setZoomMode('custom')
  }, [])

  const zoomIn = useCallback(() => setScale((s) => s + 0.2), [setScale])
  const zoomOut = useCallback(() => setScale((s) => s - 0.2), [setScale])

  // Recompute fit modes on mount, on document change and on resize.
  useEffect(() => {
    if (zoomMode === 'custom' || !pageSizes.length) return

    const apply = () => {
      const el = containerRef.current
      if (!el) return
      const next = calculateScaleForMode(zoomMode, pageSizes, {
        width: el.clientWidth,
        height: el.clientHeight,
      })
      if (next) setScaleState(clampScale(next))
    }

    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [zoomMode, pageSizes, container, containerRef])

  // After the scale changes, put the content the user was looking at back under
  // their cursor (wheel zoom) or back in the middle (button/keyboard zoom).
  useEffect(() => {
    const prevScale = prevScaleRef.current
    prevScaleRef.current = scale

    const el = containerRef.current
    if (!container || !el || scale === prevScale) return

    const pending = pendingScrollRef.current
    pendingScrollRef.current = null

    if (pending?.pageIndex !== undefined) {
      const pageEl = el.querySelector(
        `.pdf-page-container[data-page-index="${pending.pageIndex}"]`
      )
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect()
        const currentClientX = pageRect.left + pageRect.width * pending.normX
        const currentClientY = pageRect.top + pageRect.height * pending.normY
        el.scrollLeft += currentClientX - pending.targetClientX
        el.scrollTop += currentClientY - pending.targetClientY
        return
      }
    }

    // Centre anchoring. Also the fallback when the pointer was over the grey
    // background rather than a page — that case previously fell through both
    // branches and produced a disorienting jump.
    const rect = el.getBoundingClientRect()
    const ratio = scale / prevScale
    el.scrollTop = (el.scrollTop + rect.height / 2) * ratio - rect.height / 2
    if (el.scrollWidth > el.clientWidth) {
      el.scrollLeft = (el.scrollLeft + rect.width / 2) * ratio - rect.width / 2
    }
  }, [scale, container, containerRef])

  /** Remember the point under the pointer so the next scale change can re-anchor. */
  const anchorAtPointer = useCallback((clientX, clientY, target) => {
    const pageEl = target?.closest?.('.pdf-page-container')
    if (!pageEl) {
      pendingScrollRef.current = null
      return
    }
    const pageRect = pageEl.getBoundingClientRect()
    pendingScrollRef.current = {
      pageIndex: pageEl.dataset.pageIndex,
      normX: (clientX - pageRect.left) / pageRect.width,
      normY: (clientY - pageRect.top) / pageRect.height,
      targetClientX: clientX,
      targetClientY: clientY,
    }
  }, [])

  // Ctrl/Cmd + wheel (and trackpad pinch, which the browser reports the same way).
  useEffect(() => {
    if (!container) return
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()

      // Normalise across the three deltaMode units so a line-scrolling mouse and a
      // pixel-precise trackpad zoom at a comparable rate.
      let ticks = e.deltaY / 100
      if (e.deltaMode === 1) ticks = e.deltaY / 3
      else if (e.deltaMode === 2) ticks = e.deltaY

      anchorAtPointer(e.clientX, e.clientY, e.target)
      setScale((s) => s * Math.pow(1.2, -ticks))
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [container, containerRef, setScale, anchorAtPointer])

  return {
    scale,
    setScale,
    zoomMode,
    setZoomMode,
    zoomIn,
    zoomOut,
    anchorAtPointer,
  }
}
