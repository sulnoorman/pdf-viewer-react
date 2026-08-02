export { PDFViewer } from './PDFViewer/index.jsx'

// Exposed so a host can see every overridable key without reading the source, and
// build a translation by mapping over it.
export { DEFAULT_LABELS } from './PDFViewer/labels.js'

// Annotation type tags, for hosts inspecting the result of getAnnotations().
export { ANNOTATION_TYPES } from './PDFViewer/reducers/annotationReducer.js'
