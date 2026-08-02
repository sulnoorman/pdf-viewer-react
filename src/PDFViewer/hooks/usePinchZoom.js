import { useEffect, useRef } from 'react'
import { useLatestRef } from './useLatestRef.js'

/** Below this the pinch is indistinguishable from two fingers resting on the glass. */
const MIN_PINCH_DISTANCE = 24

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * Two-finger pinch zoom.
 *
 * Only trackpad pinch worked before, because a trackpad reports it as ctrl+wheel. On
 * a phone or tablet, pinching zoomed the browser chrome instead of the document —
 * the viewer had no touch handlers at all.
 *
 * ## Disambiguating one finger from two
 *
 * A single finger already means something: draw a stroke, or drag a stamp. The rules
 * when a second finger lands are deliberate:
 *
 *   - **A stroke is in progress** → the stroke is discarded and the pinch takes over.
 *     Nothing is committed until the finger lifts, so there is nothing to lose, and a
 *     stray line appearing every time someone zooms would be worse.
 *   - **A stamp is being dragged** → the pinch is refused and the drag continues.
 *     The TransformBox has captured the pointer; yanking it away mid-drag would leave
 *     the stamp in an arbitrary spot.
 *   - **Otherwise** → pinch.
 *
 * @param {object} params
 * @param {HTMLElement|null} params.container presence signal for the scroll container
 * @param {React.RefObject<HTMLElement>} params.containerRef handle used to bind listeners
 * @param {(updater: (s: number) => number) => void} params.setScale
 * @param {(clientX: number, clientY: number, target: Element) => void} params.anchorAtPointer
 * @param {React.RefObject<null | (() => void)>} params.cancelStrokeRef
 *   set by the ink layer while a stroke is live
 * @param {React.RefObject<boolean>} params.isDraggingRef true while a TransformBox owns a pointer
 */
export function usePinchZoom({
  container,
  containerRef,
  setScale,
  anchorAtPointer,
  cancelStrokeRef,
  isDraggingRef,
}) {
  const setScaleRef = useLatestRef(setScale)
  const anchorRef = useLatestRef(anchorAtPointer)

  const pointersRef = useRef(new Map())
  const pinchRef = useRef(null)

  useEffect(() => {
    if (!container) return
    const el = containerRef.current
    if (!el) return

    const pointers = pointersRef.current

    const endPinch = () => {
      pinchRef.current = null
    }

    const tryStartPinch = () => {
      if (pointers.size !== 2) return
      if (isDraggingRef?.current) return

      // A live stroke is discarded rather than committed — see the note above.
      cancelStrokeRef?.current?.()

      const [a, b] = [...pointers.values()]
      const startDistance = distance(a, b)
      if (startDistance < MIN_PINCH_DISTANCE) return

      pinchRef.current = { startDistance, startScale: null }
    }

    const onPointerDown = (e) => {
      if (e.pointerType !== 'touch') return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      tryStartPinch()
    }

    const onPointerMove = (e) => {
      if (e.pointerType !== 'touch') return
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      const pinch = pinchRef.current
      if (!pinch || pointers.size < 2) return

      e.preventDefault()

      const [a, b] = [...pointers.values()]
      const current = distance(a, b)
      if (current < MIN_PINCH_DISTANCE) return

      const centre = midpoint(a, b)
      const target = document.elementFromPoint(centre.x, centre.y)
      if (target) anchorRef.current?.(centre.x, centre.y, target)

      const ratio = current / pinch.startDistance
      setScaleRef.current?.((scale) => {
        // Capture the scale the gesture started from, so the whole pinch is measured
        // against one baseline instead of compounding every move event.
        if (pinch.startScale === null) pinch.startScale = scale
        return pinch.startScale * ratio
      })
    }

    const onPointerUp = (e) => {
      if (e.pointerType !== 'touch') return
      pointers.delete(e.pointerId)
      if (pointers.size < 2) endPinch()
    }

    el.addEventListener('pointerdown', onPointerDown, { passive: true })
    el.addEventListener('pointermove', onPointerMove, { passive: false })
    el.addEventListener('pointerup', onPointerUp, { passive: true })
    el.addEventListener('pointercancel', onPointerUp, { passive: true })
    el.addEventListener('pointerleave', onPointerUp, { passive: true })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('pointerleave', onPointerUp)
      pointers.clear()
      endPinch()
    }
  }, [container, containerRef, setScaleRef, anchorRef, cancelStrokeRef, isDraggingRef])
}
