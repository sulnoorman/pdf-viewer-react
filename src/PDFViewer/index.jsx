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
 * @param {object} [props.config] see docs/API.md
 * @param {React.Ref} ref exposes addTextStamp / addImageStamp / undo / redo /
 *   getAnnotations / getFlattenedPDF
 */
export const PDFViewer = forwardRef(function PDFViewer({ src, config }, ref) {
  return (
    <LabelProvider labels={config?.labels}>
      <AnnotationProvider>
        <ToolProvider>
          <PDFViewerInner src={src} config={config ?? {}} viewerRef={ref} />
        </ToolProvider>
      </AnnotationProvider>
    </LabelProvider>
  )
})
