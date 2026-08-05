/**
 * The state a host can read, before a document has loaded.
 *
 * Exported so `useViewerState` has something to return when it is called before
 * `<PDFViewer>` has mounted — which it always is, since the hook runs first.
 */
export const INITIAL_VIEWER_STATE = Object.freeze({
  status: 'idle',
  error: null,
  pageCount: 0,
  activePageIndex: 0,
  scale: 1,
  zoomMode: 'auto',
  hasSpecimen: false,
  hasAnnotation: false,
  counts: Object.freeze({ specimen: 0, stamp: 0, image: 0, text: 0, ink: 0, total: 0 }),
  canUndo: false,
  canRedo: false,
  isDrawMode: false,
  selectedId: null,
  showThumbnails: false,
})

/**
 * Compare two state values, looking inside plain objects.
 *
 * Every value this store holds is a primitive or a small flat record, and `counts` is
 * rebuilt from scratch on each annotation edit. Comparing it by reference would mean
 * dragging a stamp one pixel notified every subscriber with numbers that had not
 * moved — the exact problem the controller is meant to remove.
 */
function equalValue(a, b) {
  if (Object.is(a, b)) return true
  if (!isPlainObject(a) || !isPlainObject(b)) return false

  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => Object.is(a[key], b[key]))
}

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * A tiny observable store, deliberately free of React.
 *
 * It exists so viewer state can live *outside* `<PDFViewer>`. A host that wants to
 * disable its own Submit button cannot read state held inside a component it renders,
 * which is why the only way to get at it used to be an `onChange` callback and a
 * `useState` mirror in the host.
 *
 * `setState` compares one level deep and does nothing when every value is unchanged.
 * Without that, the effect that pushes state in would notify subscribers on every
 * annotation edit — and `useSyncExternalStore` re-renders each subscriber on every
 * notification, so dragging a stamp would re-render the host's whole tree.
 */
export function createViewerStore(initial = INITIAL_VIEWER_STATE) {
  let state = initial
  const listeners = new Set()

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /**
     * Merge a partial update. Returns whether anything actually changed, which the
     * tests assert on and which makes the no-op path obvious at the call site.
     */
    setState(patch) {
      if (!patch) return false

      const changed = Object.keys(patch).some((key) => !equalValue(state[key], patch[key]))
      if (!changed) return false

      state = { ...state, ...patch }
      // Copied first: a listener that unsubscribes during the loop would otherwise
      // mutate the Set being iterated.
      for (const listener of [...listeners]) listener()
      return true
    },
  }
}
