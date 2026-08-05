import { forwardRef } from 'react'
import { AnnotationProvider } from './context/AnnotationContext.jsx'
import { ToolProvider } from './context/ToolContext.jsx'
import { LabelProvider } from './context/LabelContext.jsx'
import { PDFViewerInner } from './PDFViewerInner.jsx'

/**
 * A PDF viewer with built-in stamping and freehand annotation.
 *
 * This file used to be 475 lines holding document loading, zoom maths, scroll
 * anchoring, keyboard handling, three separate annotation stores, an undo stack and
 * the whole pdf-lib export pipeline. All of that now lives in hooks, reducers and
 * utils; what remains is composition.
 *
 * @param {object} props
 * @param {string} props.src URL of the PDF to display
 * @param {object} [props.config] see the README
 * @param {object} [props.viewer] handle from `usePdfViewer()`; the recommended way to
 *   read state and drive the viewer, because it also works from outside this subtree
 * @param {React.Ref} ref the older, smaller door onto the same API: addTextStamp /
 *   addImageStamp / undo / redo / getAnnotations / getFlattenedPDF
 */
export const PDFViewer = forwardRef(function PDFViewer({ src, config, viewer }, ref) {
  return (
    <LabelProvider labels={config?.labels}>
      <AnnotationProvider>
        <ToolProvider>
          <PDFViewerInner src={src} config={config ?? {}} viewerRef={ref} viewer={viewer} />
        </ToolProvider>
      </AnnotationProvider>
    </LabelProvider>
  )
})
