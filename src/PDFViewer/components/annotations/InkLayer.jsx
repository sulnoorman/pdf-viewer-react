import { memo, useRef, useState, useCallback } from 'react'
import { createInkAnnotation } from '../../reducers/annotationReducer.js'
import { simplifyPath } from '../../utils/inkSimplify.js'
import styles from './InkLayer.module.css'

const PENCIL_CURSOR = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>') 0 24, crosshair`

const toPathData = (points) =>
  points.length ? `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}` : ''

/**
 * Freehand drawing surface for one page.
 *
 * Three changes from the original implementation:
 *
 * 1. **viewBox comes from the page's unscaled size**, not from the rendered canvas
 *    dimensions divided by scale. Those dimensions track the *debounced* scale, so
 *    for 300 ms after every zoom the mapping was off by `canvasScale / scale` and
 *    strokes landed away from the cursor.
 *
 * 2. **The in-progress stroke bypasses React entirely.** Points accumulate in a ref
 *    and the path's `d` attribute is written directly to the DOM, so drawing costs
 *    zero re-renders. The old code spread the whole point array into state on every
 *    pointermove — quadratic work plus a full page re-render per sample.
 *
 * 3. **Strokes are simplified on release** before entering the store, so a long
 *    scribble does not carry a thousand collinear points into the exported PDF.
 */
function InkLayerComponent({
  pageIndex,
  pageWidth,
  pageHeight,
  strokes,
  isDrawMode,
  inkColor,
  inkThickness,
  inkOpacity,
  activeId,
  onSelect,
  onCommit,
  onDelete,
  cancelStrokeRef,
}) {
  const svgRef = useRef(null)
  const livePathRef = useRef(null)
  const pointsRef = useRef([])
  // `d` is appended to incrementally; rebuilding the whole string per sample would
  // reintroduce the quadratic cost this design exists to avoid.
  const pathDataRef = useRef('')
  const [isDrawing, setIsDrawing] = useState(false)

  const toViewPoint = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = e.clientX
    point.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const mapped = point.matrixTransform(ctm.inverse())
    return { x: mapped.x, y: mapped.y }
  }, [])

  const clearLive = useCallback(() => {
    pointsRef.current = []
    pathDataRef.current = ''
    livePathRef.current?.setAttribute('d', '')
  }, [])

  /** Drop the current stroke without committing — used when a gesture is interrupted. */
  const cancelStroke = useCallback(() => {
    if (pointsRef.current.length === 0) return
    clearLive()
    setIsDrawing(false)
  }, [clearLive])

  const handlePointerDown = useCallback(
    (e) => {
      if (!isDrawMode) {
        onSelect(null)
        return
      }
      e.preventDefault()
      e.stopPropagation()
      svgRef.current?.setPointerCapture(e.pointerId)

      const point = toViewPoint(e)
      pointsRef.current = [point]
      pathDataRef.current = `M ${point.x},${point.y}`
      livePathRef.current?.setAttribute('d', pathDataRef.current)
      setIsDrawing(true)

      // Let the pinch handler discard this stroke if a second finger lands.
      if (cancelStrokeRef) cancelStrokeRef.current = cancelStroke
    },
    [isDrawMode, onSelect, toViewPoint, cancelStrokeRef, cancelStroke]
  )

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDrawMode || pointsRef.current.length === 0) return
      e.preventDefault()

      const point = toViewPoint(e)
      pointsRef.current.push(point)
      pathDataRef.current += ` L ${point.x},${point.y}`
      livePathRef.current?.setAttribute('d', pathDataRef.current)
    },
    [isDrawMode, toViewPoint]
  )

  const finishStroke = useCallback(
    (e) => {
      if (pointsRef.current.length === 0) return
      e.preventDefault()
      try {
        svgRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        // Capture may already be gone (pointercancel); nothing to release.
      }

      const points = simplifyPath(pointsRef.current)
      clearLive()
      setIsDrawing(false)
      if (cancelStrokeRef) cancelStrokeRef.current = null

      if (points.length > 1) {
        onCommit(
          createInkAnnotation({
            pageIndex,
            points,
            color: inkColor,
            strokeWidth: inkThickness,
            opacity: inkOpacity,
          })
        )
      }
    },
    [clearLive, onCommit, pageIndex, inkColor, inkThickness, inkOpacity, cancelStrokeRef]
  )

  return (
    <svg
      ref={svgRef}
      data-testid="ink-layer"
      className={`${styles.layer} ${isDrawMode ? styles.layerDrawing : ''}`}
      style={{ cursor: isDrawMode ? PENCIL_CURSOR : 'auto' }}
      // View-space units: the SVG spans the whole page, so one unit is one PDF point
      // regardless of what the canvas is currently rasterised at.
      viewBox={`0 0 ${pageWidth} ${pageHeight}`}
      preserveAspectRatio="none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={cancelStroke}
    >
      {strokes.map((stroke) => (
        <Stroke
          key={stroke.id}
          stroke={stroke}
          selected={activeId === stroke.id && !isDrawMode}
          interactive={!isDrawMode}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}

      {/* Always mounted so pointermove can write to it without a React render. */}
      <path
        ref={livePathRef}
        fill="none"
        stroke={inkColor}
        strokeWidth={inkThickness}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={isDrawing ? inkOpacity : 0}
        pointerEvents="none"
      />
    </svg>
  )
}

/** Extra clickable margin around a stroke, in view units (PDF points). */
const HIT_PADDING = 12

function Stroke({ stroke, selected, interactive, onSelect, onDelete }) {
  const d = toPathData(stroke.points)
  if (!d) return null

  return (
    <g>
      {selected && (
        <path
          d={d}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth={stroke.strokeWidth + 4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.3"
          pointerEvents="none"
        />
      )}

      {/*
        Invisible fat stroke that does the hit-testing. A 2pt line is effectively
        impossible to click, especially on touch; this gives it a usable target
        without changing what is drawn.
      */}
      {interactive && (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={stroke.strokeWidth + HIT_PADDING}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.strokeHit}
          onPointerDown={(e) => {
            e.stopPropagation()
            onSelect(stroke.id)
          }}
          // pointerdown is followed by a compatibility mousedown that would bubble up
          // to the deselect handlers, undoing the selection we just made.
          onMouseDown={(e) => e.stopPropagation()}
        />
      )}

      <path
        d={d}
        fill="none"
        stroke={stroke.color}
        strokeWidth={stroke.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={stroke.opacity ?? 1}
        pointerEvents="none"
      />

      {selected && stroke.points.length > 0 && (
        <g
          transform={`translate(${stroke.points[0].x - 12}, ${stroke.points[0].y - 12})`}
          className={styles.deleteBadge}
          onPointerDown={(e) => {
            e.stopPropagation()
            onDelete(stroke.id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <circle cx="12" cy="12" r="10" fill="#ef4444" />
          <path d="M8 8 L16 16 M16 8 L8 16" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

export const InkLayer = memo(InkLayerComponent)
