import { memo } from 'react'
import { Page } from './Page.jsx'
import { useViewer } from '../context/ViewerContext.jsx'
import { useTools } from '../context/ToolContext.jsx'
import styles from './Document.module.css'

/**
 * The scrolling page column.
 *
 * Every page always renders its container at full size so the scrollbar is accurate
 * from the start and cross-page drag hit-testing keeps working, but only pages inside
 * the render window rasterise. Previously all pages rendered at once, which made a
 * few-hundred-page document unusable.
 */
export function Document({ registerPage, renderWindow }) {
  const { pdfDoc, documentKey, setScrollContainer } = useViewer()
  const { setActiveId } = useTools()

  return (
    <div
      ref={setScrollContainer}
      className={styles.scroller}
      // Only a click on the empty background clears the selection. Firing this for
      // every mousedown inside the document deselected annotations that had just been
      // selected by a pointerdown handler — stopPropagation on a pointer event does
      // not stop the compatibility mouse event that follows it.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setActiveId(null)
      }}
    >
      {/*
        Keyed by the document as well as the page index.

        A page holding one document's canvas, text layer and annotation layer is not the
        same component as a page holding another's, and the key says so: switching document
        builds fresh ones rather than reusing them. Keyed by index alone, the old canvas
        stayed on screen — still showing the other document — until the new raster landed,
        which on a large document is long enough to read.

        The scroller itself stays mounted either way, so the scroll position survives.
      */}
      {pdfDoc &&
        Array.from({ length: pdfDoc.numPages }, (_, i) => (
          <MemoPage
            key={`${documentKey}:${i}`}
            pageNumber={i + 1}
            registerPage={registerPage}
            shouldRender={renderWindow.has(i)}
          />
        ))}
    </div>
  )
}

// Scrolling changes the render window, which re-renders Document. Without memo that
// would re-render every page on every scroll tick.
const MemoPage = memo(Page)
