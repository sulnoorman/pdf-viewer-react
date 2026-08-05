import { useState } from 'react'
import { createViewerStore } from './createViewerStore.js'

/**
 * Every method the handle forwards to the mounted viewer.
 *
 * Listed as data rather than written out one by one so the handle, the `ref` shape and
 * the TypeScript declarations cannot drift apart — adding a method here is the only
 * edit needed.
 */
export const VIEWER_METHODS = Object.freeze([
  // Document
  'reload',
  // Export
  'getFlattenedPDF',
  'getAnnotations',
  // Annotations
  'addTextStamp',
  'addImageStamp',
  'uploadStamp',
  'duplicateSelected',
  'deleteSelected',
  // History
  'undo',
  'redo',
  // Zoom
  'zoomIn',
  'zoomOut',
  'setScale',
  'setZoomMode',
  // Pages
  'goToPage',
  'rotatePages',
  // Tools
  'setDrawMode',
  'setInk',
  // UI
  'toggleThumbnails',
])

/**
 * Create a viewer handle to pass to `<PDFViewer viewer={...} />`.
 *
 * This is the answer to "read the state without an onChange callback". State that
 * lives inside `<PDFViewer>` is unreachable from the component that renders it, so
 * the handle owns a store the viewer writes into and the host reads out of, via
 * `useViewerState`. It is the same shape TipTap's `useEditor` and TanStack Table use.
 *
 * The returned object's **identity never changes**, which is what makes it safe to
 * pass as a prop: it cannot cause the viewer to re-render, and it can go in a
 * dependency array without becoming a re-run trigger.
 *
 * Methods are thin forwarders to the mounted viewer. Calling one before mount — on
 * the very first render, or after unmount — is a no-op returning `undefined` rather
 * than a crash, because a host wiring up a toolbar has no reliable moment to know the
 * viewer is ready.
 */
export function usePdfViewer() {
  /*
   * `useState` with a lazy initialiser, not `useRef` or `useMemo`.
   *
   * useMemo would be wrong: React may throw a memo cache away at any time, and this
   * identity is a promise made to the host. A ref would work but reading `.current`
   * during render is exactly what react-hooks/refs forbids. A state value initialised
   * once and never set says "computed once, stable forever" without either problem.
   */
  const [handle] = useState(createHandle)
  return handle
}

function createHandle() {
  const store = createViewerStore()
  const impl = { current: null }

  const handle = {
    /** @internal wired by <PDFViewer> on mount; not part of the public surface. */
    __attach(implementation) {
      impl.current = implementation
      return () => {
        // Guarded because StrictMode runs the effect, cleans up and runs it again:
        // the first cleanup must not disconnect the second attachment.
        if (impl.current === implementation) impl.current = null
      }
    },
    /** @internal */
    __store: store,

    getState: store.getState,
    subscribe: store.subscribe,
  }

  for (const name of VIEWER_METHODS) {
    handle[name] = (...args) => impl.current?.[name]?.(...args)
  }

  return handle
}
