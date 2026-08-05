import { useCallback, useSyncExternalStore } from 'react'
import { INITIAL_VIEWER_STATE } from './createViewerStore.js'

const identity = (state) => state

/**
 * Read viewer state from a handle created by `usePdfViewer`.
 *
 * ```jsx
 * const viewer = usePdfViewer()
 * const hasAnnotation = useViewerState(viewer, (s) => s.hasAnnotation)
 * ```
 *
 * Pass a selector whenever you can. Without one the host re-renders on every viewer
 * change, including the scale ticking during a pinch; with one it re-renders only
 * when the value it actually reads changes, because `useSyncExternalStore` bails out
 * on an `Object.is`-equal snapshot.
 *
 * For the same reason a selector must return a primitive or a stable reference — one
 * that builds a fresh object (`(s) => ({ a: s.a })`) is never equal to the last and
 * will re-render on every notification.
 *
 * @param {object|null} viewer handle from `usePdfViewer()`
 * @param {(state: object) => any} [selector]
 */
export function useViewerState(viewer, selector = identity) {
  const subscribe = useCallback(
    (listener) => viewer?.subscribe(listener) ?? noop,
    [viewer]
  )

  const getSnapshot = useCallback(
    // Falls back to the initial state so a host can read `hasSpecimen` on its very
    // first render, before <PDFViewer> has mounted and attached itself.
    () => selector(viewer?.getState() ?? INITIAL_VIEWER_STATE),
    [viewer, selector]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function noop() {}
