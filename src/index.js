export { PDFViewer } from './PDFViewer/index.jsx'

/**
 * The controller pair. `usePdfViewer()` creates a stable handle to pass as the
 * `viewer` prop; `useViewerState(viewer, selector?)` reads state out of it from
 * anywhere in the host, without an onChange callback or a mirrored useState.
 */
export { usePdfViewer } from './PDFViewer/viewer/usePdfViewer.js'
export { useViewerState } from './PDFViewer/viewer/useViewerState.js'

// Exposed so a host can see every overridable key without reading the source, and
// build a translation by mapping over it.
export { DEFAULT_LABELS } from './PDFViewer/labels.js'

// Annotation type tags, for hosts inspecting the result of getAnnotations().
export { ANNOTATION_TYPES } from './PDFViewer/reducers/annotationReducer.js'

/**
 * The toolbar's shipped order. Filter it rather than writing `displayActions` out by
 * hand, so hiding one control does not lock you out of controls added later.
 */
export { DEFAULT_TOOLBAR_ACTIONS } from './PDFViewer/components/toolbar/registry.js'
