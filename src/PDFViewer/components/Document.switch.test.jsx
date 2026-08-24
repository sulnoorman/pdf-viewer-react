import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'

/**
 * Switching documents must re-rasterise from the document being switched to.
 *
 * This is an integration test on purpose. Every unit below it was green while the viewer
 * still showed the previous attachment's pages: `usePdfDocument` handed back the right
 * document, and `Page` had `pdfDoc` in its effect dependencies. Only wiring the two
 * together shows whether the pages actually re-render — and now that a switch no longer
 * unmounts the document view, nothing else clears the old canvases.
 *
 * jsdom cannot rasterise, so the assertion is "which document was each page asked for",
 * read from the `getPage` calls, rather than anything about pixels.
 */

const getDocument = vi.fn()

vi.mock('pdfjs-dist', () => ({
  getDocument: (...args) => getDocument(...args),
  PDFWorker: class PDFWorker {
    destroy() {}
  },
  TextLayer: class TextLayer {
    async render() {}
  },
  AnnotationLayer: class AnnotationLayer {
    async render() {}
  },
  GlobalWorkerOptions: {},
}))
vi.mock('../utils/worker.js', () => ({
  configureWorker: () => {},
  describeWorkerFailure: (err) => err.message,
}))
vi.mock('../utils/source.js', () => ({
  // Encodes the src itself, so the two documents are distinguishable downstream. Keying on
  // `src.length` was not: "a.pdf" and "b.pdf" are the same length.
  normalizePdfSource: async (src) => new TextEncoder().encode(src),
  copyBytes: (bytes) => bytes.slice(),
  sourceKey: (src) => src,
}))

const { PDFViewer } = await import('../index.jsx')

/**
 * A document that records which of its pages were asked for.
 *
 * @param {string} label identifies the document in assertions
 */
function fakeDoc(label, numPages = 2) {
  const asked = []
  const doc = {
    label,
    asked,
    numPages,
    // A destroyed document stops answering, as pdf.js does — otherwise this fake cannot
    // tell a live document from one whose transport has been torn down, and a viewer
    // rendering blank pages would look perfectly healthy here.
    dead: false,
    destroy: vi.fn(() => {
      doc.dead = true
    }),
    getPage: async (pageNumber) => {
      if (doc.dead) throw new Error('Transport destroyed')
      asked.push(pageNumber)
      return {
        rotate: 0,
        getViewport: () => ({ width: 300, height: 400, clone: () => ({}) }),
        render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
        getTextContent: async () => ({ items: [] }),
        // Empty, so Page returns before touching the annotation layer.
        getAnnotations: async () => [],
      }
    },
  }
  return doc
}

beforeEach(() => {
  getDocument.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})

  // jsdom has no 2D context at all; Page only ever blits into it.
  HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} })

  // Virtualisation reports nothing as visible here, which is fine: the render window keeps
  // the first page rendered regardless, and that is the page these assertions read.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Every page a document was asked for after clearing the record. */
const askedSince = (doc) => doc.asked.splice(0, doc.asked.length)

describe('switching between documents', () => {
  it('re-rasterises from the document being switched to, including on a cache hit', async () => {
    const first = fakeDoc('first')
    const second = fakeDoc('second')

    const docs = { 'a.pdf': first, 'b.pdf': second }
    getDocument.mockImplementation(({ data }) => {
      const doc = docs[new TextDecoder().decode(data)]
      return {
        promise: Promise.resolve(doc),
        // pdf.js takes the document down with the task; a fake that does not cannot see
        // the difference.
        destroy: vi.fn(() => {
          doc.dead = true
        }),
      }
    })

    const view = render(<PDFViewer src="a.pdf" documentId="a" />)
    await waitFor(() => expect(first.asked.length).toBeGreaterThan(0))
    askedSince(first)

    // Switch away, and confirm the second document is the one being read.
    await act(async () => {
      view.rerender(<PDFViewer src="b.pdf" documentId="b" />)
    })
    await waitFor(() => expect(second.asked.length).toBeGreaterThan(0))
    askedSince(second)

    /*
     * Back to the first. This is the case that failed: the document is served from the
     * cache with no loading state, so the page components are never unmounted — and if they
     * do not re-run their render, every canvas still holds the other attachment's pixels.
     */
    await act(async () => {
      view.rerender(<PDFViewer src="a.pdf" documentId="a" />)
    })

    await waitFor(() => expect(first.asked.length).toBeGreaterThan(0))
    expect(askedSince(second)).toEqual([])
    expect(docs['a.pdf']).toBe(first)
  })

  it('builds fresh page elements rather than reusing the other document’s', async () => {
    /*
     * The guard for the residue bug, and the reason the test above was not enough: asking
     * the right document for its pages says nothing about what is still *on screen*.
     *
     * Rasterising is asynchronous. Reuse the page components across a switch and their
     * canvas, text layer and annotation layer keep the previous document's content until
     * the new raster lands — which, on a large document, is long enough to read. jsdom
     * cannot rasterise, so what is checked is the thing that makes it impossible: the page
     * elements are rebuilt, so there is nothing left to be stale.
     *
     * Only reachable since documents started being cached. Before that a switch passed
     * through a loading state, which unmounted the whole view and took the canvases with it.
     */
    const first = fakeDoc('first')
    const second = fakeDoc('second')
    const docs = { 'a.pdf': first, 'b.pdf': second }
    getDocument.mockImplementation(({ data }) => {
      const doc = docs[new TextDecoder().decode(data)]
      return {
        promise: Promise.resolve(doc),
        // pdf.js takes the document down with the task; a fake that does not cannot see
        // the difference.
        destroy: vi.fn(() => {
          doc.dead = true
        }),
      }
    })

    const view = render(<PDFViewer src="a.pdf" documentId="a" />)
    await waitFor(() => expect(first.asked.length).toBeGreaterThan(0))

    await act(async () => {
      view.rerender(<PDFViewer src="b.pdf" documentId="b" />)
    })
    await waitFor(() => expect(second.asked.length).toBeGreaterThan(0))

    /*
     * Captured while the second document is showing, and compared after returning to the
     * first. It has to be this way round: the first switch is a cache *miss*, so it passes
     * through a loading state that unmounts everything and would rebuild the elements
     * whatever the key. Only the switch back is a hit, and only a hit keeps the view mounted
     * — which is exactly where reuse would leave the wrong content on screen.
     */
    const showingSecond = document.querySelector('.pdf-page-container')
    const scrollerBefore = document.querySelector('[class*="scroller"]')
    expect(showingSecond).toBeTruthy()

    await act(async () => {
      view.rerender(<PDFViewer src="a.pdf" documentId="a" />)
    })
    await waitFor(() => expect(first.asked.length).toBeGreaterThan(0))

    expect(document.querySelector('.pdf-page-container')).not.toBe(showingSecond)
    // The scroller itself is deliberately NOT rebuilt: the scroll position lives on it.
    expect(document.querySelector('[class*="scroller"]')).toBe(scrollerBefore)
  })
})
