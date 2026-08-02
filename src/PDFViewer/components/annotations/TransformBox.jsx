import { useCallback, useRef, useState } from 'react'
import {
  RESIZE_HANDLES,
  toLocalDelta,
  resizeRect,
  moveRect,
  angleFromCenter,
  snapAngle,
  normalizeAngle,
} from '../../utils/transform.js'
import styles from './TransformBox.module.css'

/**
 * A selectable box that can be moved, resized and rotated.
 *
 * Replaces react-rnd, for three reasons:
 *   1. react-rnd has no concept of rotation — it applies raw screen deltas, so a
 *      rotated object (or a rotated page) drags in the wrong direction.
 *   2. It bundles react-draggable, which reads `process.env.DRAGGABLE_DEBUG` and
 *      throws "process is not defined" in a browser. Every consumer of this library
 *      would have had to shim `process` themselves.
 *   3. Dropping it removes a runtime dependency.
 *
 * ## Why the DOM is written directly during a gesture
 *
 * Nothing is dispatched to the annotation store until the pointer is released. While
 * dragging, the element's style is mutated in place, so a drag costs zero React
 * renders and produces exactly one undo step. Committing per pointermove would both
 * re-render every annotation on the page and flood the undo stack.
 *
 * Mark any interactive child (a textarea, a toolbar button) with `data-no-drag` so
 * pressing it does not start a move.
 */
/** Clearance between the object's rotated bounding box and its floating toolbar. */
const TOOLBAR_GAP = 28

export function TransformBox({
  rect,
  rotation = 0,
  /** Rotation of the page the box lives on; screen deltas are undone by this first. */
  frameRotation = 0,
  selected = false,
  lockAspectRatio = false,
  resizable = true,
  rotatable = false,
  opacity = 1,
  className = '',
  onSelect,
  onCommit,
  /** Flipped while a gesture is live, so the pinch handler knows to stand down. */
  isDraggingRef,
  children,
  toolbar,
}) {
  const nodeRef = useRef(null)
  const toolbarRef = useRef(null)
  const gestureRef = useRef(null)
  const [isTransforming, setIsTransforming] = useState(false)

  /**
   * Keep the floating toolbar upright and visually below the object.
   *
   * The toolbar is a child of the rotated box, so without this it turns with the
   * object — a signature rotated 90° left its controls lying on their side, which is
   * exactly when the user is reaching for them.
   *
   * `rotate(-total) translateY(D) translate(-50%,-50%)` reads right to left: centre
   * the bar on its anchor, push it down, then undo every rotation between here and
   * the screen. The parent's rotation then cancels it, leaving the bar level and
   * offset straight down no matter how the object or the page is turned.
   */
  const toolbarTransform = useCallback(
    (draftRect, draftRotation) => {
      const total = ((frameRotation + draftRotation) * Math.PI) / 180
      // Half-height of the rotated bounding box, so the bar clears the object at any
      // angle rather than overlapping a corner.
      const halfHeight =
        (Math.abs(draftRect.width * Math.sin(total)) +
          Math.abs(draftRect.height * Math.cos(total))) /
        2
      const distance = halfHeight + TOOLBAR_GAP
      return `rotate(${-(frameRotation + draftRotation)}deg) translateY(${distance}px) translate(-50%, -50%)`
    },
    [frameRotation]
  )

  /** Push a draft rect/rotation straight to the DOM, bypassing React. */
  const paint = useCallback(
    (draftRect, draftRotation) => {
      const node = nodeRef.current
      if (!node) return
      node.style.left = `${draftRect.x}px`
      node.style.top = `${draftRect.y}px`
      node.style.width = `${draftRect.width}px`
      node.style.height = `${draftRect.height}px`
      node.style.transform = `rotate(${draftRotation}deg)`

      // Follow along live, otherwise the bar lags visibly during a rotate gesture.
      if (toolbarRef.current) {
        toolbarRef.current.style.transform = toolbarTransform(draftRect, draftRotation)
      }
    },
    [toolbarTransform]
  )

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button != null && e.button !== 0) return

      const handle = e.target?.dataset?.handle
      const isRotate = e.target?.dataset?.rotate === 'true'
      const noDrag = e.target?.closest?.('[data-no-drag]')

      // A plain click on a non-draggable child (textarea, toolbar) selects but does
      // not begin a gesture.
      if (!handle && !isRotate && noDrag) {
        onSelect?.()
        return
      }

      e.stopPropagation()
      onSelect?.()

      const node = nodeRef.current
      if (!node) return

      const bounds = node.getBoundingClientRect()
      gestureRef.current = {
        kind: isRotate ? 'rotate' : handle ? 'resize' : 'move',
        handle,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startRect: rect,
        startRotation: rotation,
        centre: { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 },
        current: { rect, rotation },
      }
      gestureRef.current.startAngle = angleFromCenter(gestureRef.current.centre, {
        x: e.clientX,
        y: e.clientY,
      })

      e.currentTarget.setPointerCapture(e.pointerId)
      if (isDraggingRef) isDraggingRef.current = true
      setIsTransforming(true)
    },
    [rect, rotation, onSelect, isDraggingRef]
  )

  const handlePointerMove = useCallback(
    (e) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.pointerId !== e.pointerId) return
      e.preventDefault()

      const screenDelta = { x: e.clientX - gesture.startX, y: e.clientY - gesture.startY }

      if (gesture.kind === 'rotate') {
        const angle = angleFromCenter(gesture.centre, { x: e.clientX, y: e.clientY })
        const raw = gesture.startRotation + (angle - gesture.startAngle)
        const next = e.shiftKey ? snapAngle(raw) : normalizeAngle(raw)
        gesture.current = { rect: gesture.startRect, rotation: next }
      } else if (gesture.kind === 'resize') {
        // Undo the page rotation and then the object's own, so the delta is expressed
        // in the axes the handle actually moves along.
        const localDelta = toLocalDelta(screenDelta, frameRotation + gesture.startRotation)
        gesture.current = {
          rect: resizeRect({
            rect: gesture.startRect,
            rotation: gesture.startRotation,
            handle: gesture.handle,
            delta: localDelta,
            lockAspectRatio,
          }),
          rotation: gesture.startRotation,
        }
      } else {
        // Translation only needs the page rotation undone; the object's own rotation
        // does not affect which way "right" is for a move.
        const frameDelta = toLocalDelta(screenDelta, frameRotation)
        gesture.current = {
          rect: moveRect(gesture.startRect, frameDelta),
          rotation: gesture.startRotation,
        }
      }

      paint(gesture.current.rect, gesture.current.rotation)
    },
    [frameRotation, lockAspectRatio, paint]
  )

  const endGesture = useCallback(
    (e) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.pointerId !== e.pointerId) return
      gestureRef.current = null
      if (isDraggingRef) isDraggingRef.current = false
      setIsTransforming(false)

      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Capture may already be gone on pointercancel.
      }

      const { rect: finalRect, rotation: finalRotation } = gesture.current
      const moved =
        finalRect.x !== gesture.startRect.x ||
        finalRect.y !== gesture.startRect.y ||
        finalRect.width !== gesture.startRect.width ||
        finalRect.height !== gesture.startRect.height ||
        finalRotation !== gesture.startRotation

      // A click that did not move anything must not create an undo step.
      if (moved) onCommit?.(finalRect, finalRotation, nodeRef.current)
    },
    [onCommit, isDraggingRef]
  )

  return (
    <div
      ref={nodeRef}
      className={[styles.box, selected && styles.boxSelected, isTransforming && styles.boxTransforming, className]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        transform: `rotate(${rotation}deg)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      // pointerdown is followed by a compatibility mousedown; without this it bubbles
      // to the page and immediately clears the selection we just made.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={`${styles.outline} ${selected ? styles.outlineSelected : ''}`} />

      {/*
        Opacity applies to the annotation's own content and nothing else.

        Putting it on the root looked equivalent but was not: CSS opacity forms a
        stacking context and multiplies down the whole subtree, so a child cannot opt
        back out with `opacity: 1`. Fading a stamp to 20% also faded its selection
        border, resize handles and toolbar to 20% — leaving the controls unusable at
        exactly the moment the user was adjusting them.
      */}
      <div className={styles.content} style={{ opacity }}>
        {children}
      </div>

      {selected && resizable && (
        <>
          {Object.entries(RESIZE_HANDLES).map(([name, position]) => (
            <span
              key={name}
              data-handle={name}
              aria-hidden="true"
              className={styles.handle}
              style={{
                left: `${position.x * 100}%`,
                top: `${position.y * 100}%`,
                cursor: HANDLE_CURSORS[name],
              }}
            />
          ))}
        </>
      )}

      {selected && rotatable && (
        <span
          data-rotate="true"
          aria-hidden="true"
          className={styles.rotateHandle}
        />
      )}

      {selected && toolbar && (
        <div
          ref={toolbarRef}
          className={styles.toolbarAnchor}
          style={{ transform: toolbarTransform(rect, rotation) }}
        >
          {toolbar}
        </div>
      )}
    </div>
  )
}

/**
 * Cursors are fixed to the unrotated axes. Rotating them to match the object would
 * need per-angle cursor selection; the handles are still in the visually correct
 * place, only the arrow direction is nominal.
 */
const HANDLE_CURSORS = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
}
