import { memo, useEffect, useRef, useState } from 'react'
import { useViewer } from '../context/ViewerContext.jsx'
import { displayPageSize, normalizeRotation } from '../utils/coords.js'
import styles from './ThumbnailSidebar.module.css'
import { useLabels } from '../context/LabelContext.jsx'
import { formatLabel } from '../labels.js'

/** Rendered width of a thumbnail, in CSS pixels. */
const THUMBNAIL_WIDTH = 116

/**
 * Page thumbnails.
 *
 * Thumbnails rasterise lazily: a page is only drawn once its tile scrolls into the
 * sidebar. Rendering all of them up front would defeat the point of virtualising the
 * main view — a 200-page document would still rasterise 200 times on open.
 */
export function ThumbnailSidebar({ activePageIndex, onGoToPage }) {
  const labels = useLabels()
  const { pdfDoc, pageSizes, pageRotations } = useViewer()
  if (!pdfDoc) return null

  return (
    <aside
      className={styles.sidebar}
      aria-label={labels.thumbnailSidebar}
    >
      <ul className={styles.list}>
        {Array.from({ length: pdfDoc.numPages }, (_, i) => (
          <Thumbnail
            key={i}
            pdfDoc={pdfDoc}
            pageIndex={i}
            pageSize={pageSizes[i]}
            userRotation={pageRotations[i] ?? 0}
            isActive={i === activePageIndex}
            onSelect={onGoToPage}
          />
        ))}
      </ul>
    </aside>
  )
}

function ThumbnailComponent({ pdfDoc, pageIndex, pageSize, userRotation, isActive, onSelect }) {
  const labels = useLabels()
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [visible, setVisible] = useState(false)

  // Thumbnails follow the viewer's rotation, otherwise the sidebar contradicts the
  // page next to it.
  const display = displayPageSize(pageSize ?? { width: 0, height: 0 }, userRotation)
  const aspect = display.width ? display.height / display.width : 1.414
  const height = Math.round(THUMBNAIL_WIDTH * aspect)

  useEffect(() => {
    const element = containerRef.current
    if (!element || visible) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
      },
      { rootMargin: '200px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || !pdfDoc) return
    let renderTask = null
    let cancelled = false

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageIndex + 1)
        if (cancelled || !canvasRef.current) return

        // `rotation` replaces the page's own /Rotate, so the viewer's extra turn has
        // to be added to it rather than passed on its own.
        const rotation = normalizeRotation(page.rotate + userRotation)
        const base = page.getViewport({ scale: 1, rotation })
        const viewport = page.getViewport({ scale: THUMBNAIL_WIDTH / base.width, rotation })
        const dpr = window.devicePixelRatio || 1

        const canvas = canvasRef.current
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        renderTask = page.render({
          canvasContext: canvas.getContext('2d', { alpha: false }),
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
          viewport,
        })
        await renderTask.promise
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('[react-pdf-viewer-stamping] Thumbnail render failed:', err)
        }
      }
    }

    render()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [visible, pdfDoc, pageIndex, userRotation])

  return (
    <li ref={containerRef} className={styles.item}>
      <button
        type="button"
        onClick={() => onSelect(pageIndex)}
        aria-current={isActive ? 'page' : undefined}
        aria-label={formatLabel(labels.goToPage, { page: pageIndex + 1 })}
        className={`${styles.tile} ${isActive ? styles.tileActive : ''}`}
        style={{ width: THUMBNAIL_WIDTH, height }}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
      </button>
      <span className={`${styles.number} ${isActive ? styles.numberActive : ''}`}>
        {pageIndex + 1}
      </span>
    </li>
  )
}

const Thumbnail = memo(ThumbnailComponent)
