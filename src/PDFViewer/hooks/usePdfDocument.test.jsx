import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

/**
 * pdfjs-dist and the worker setup are replaced wholesale: what is under test here is the
 * hook's own bookkeeping — which document belongs to which `src`, what is kept, what is
 * destroyed — not pdf.js.
 */
const getDocument = vi.fn()
const workerConstructions = vi.fn()

/** Every worker built during a test, so its readiness promise can be inspected. */
const workers = []

vi.mock('pdfjs-dist', () => ({
  getDocument: (...args) => getDocument(...args),
  PDFWorker: class PDFWorker {
    constructor() {
      workerConstructions()
      this.destroy = vi.fn()

      /*
       * A thenable that records being handled, standing in for pdf.js's readiness promise.
       *
       * Deliberately not a rejected promise: a real one would create the very unhandled
       * rejection under test before anything could attach to it, failing the whole run for
       * the wrong reason. And waiting to see whether a rejection escapes is no test at all —
       * that reporting depends on timing and on the runner, so it passes either way.
       */
      this.promiseHandled = false
      this.promise = {
        catch: () => {
          this.promiseHandled = true
          return Promise.resolve()
        },
      }

      workers.push(this)
    }
  },
}))
vi.mock('../utils/worker.js', () => ({
  configureWorker: () => {},
  describeWorkerFailure: (err) => err.message,
  // Stands in for the real resolver, which reads import.meta.url. Only the shape matters
  // here — that the hook forwards these to getDocument at all; worker.test.js covers how
  // they are built and the trailing slash they must carry.
  resolveAssetUrls: ({ wasmUrl, standardFontDataUrl } = {}) => ({
    wasmUrl: wasmUrl ?? '/bundled/wasm/',
    standardFontDataUrl: standardFontDataUrl ?? '/bundled/standard_fonts/',
  }),
}))
vi.mock('../utils/source.js', () => ({
  // The identity of `src` is the key, exactly as sourceKey() documents, so a string is
  // enough to stand in for the bytes.
  normalizePdfSource: async (src) => new Uint8Array([src.length]),
  copyBytes: (bytes) => bytes.slice(),
  sourceKey: (src) => src,
}))

const { usePdfDocument, DEFAULT_DOCUMENT_CACHE_SIZE } = await import('./usePdfDocument.js')

/**
 * A pdf.js document whose pages report a size derived from the page number.
 *
 * `dead` is what makes these tests worth running. In pdf.js a document is only usable while
 * its transport is alive, and both `doc.destroy()` and `loadingTask.destroy()` tear that
 * down — the latter is documented as "abort all network requests and destroy the worker".
 * A fake whose `getPage` keeps answering after either of those cannot tell a live document
 * from a corpse, which is exactly how a whole green suite missed a viewer showing blank
 * pages.
 */
function fakeDoc(numPages = 2) {
  const doc = {
    numPages,
    dead: false,
    destroy: vi.fn(() => {
      doc.dead = true
    }),
    getPage: async (pageNumber) => {
      if (doc.dead) throw new Error('Transport destroyed')
      return {
        rotate: 0,
        getViewport: () => ({ width: 100 + pageNumber, height: 800 }),
      }
    },
  }
  return doc
}

/** Resolve the loading task by hand, so a test can hold a document in flight. */
function deferredDoc(doc = fakeDoc()) {
  let release
  const promise = new Promise((resolve) => {
    release = () => resolve(doc)
  })
  return {
    doc,
    task: {
      promise,
      // Destroying the task kills the document with it, as pdf.js does.
      destroy: vi.fn(() => {
        doc.dead = true
      }),
    },
    release,
  }
}

/** Queue documents to be returned by successive getDocument() calls. */
function serve(...deferred) {
  let call = 0
  getDocument.mockImplementation(() => deferred[Math.min(call++, deferred.length - 1)].task)
}

/**
 * Drive the hook across `src` changes while recording the status of every render.
 *
 * The render record is the point: a single `loading` render between two documents unmounts
 * the whole document view, so "was it ever loading?" cannot be answered from the final
 * state alone.
 */
function driver(options = {}) {
  const statuses = []
  const view = renderHook(
    ({ src }) => {
      const result = usePdfDocument(src, options)
      statuses.push(result.status)
      return result
    },
    { initialProps: { src: null } }
  )

  return {
    statuses,
    result: view.result,
    unmount: view.unmount,
    /** Point at a document and wait for it to settle. */
    open: async (src, release) => {
      view.rerender({ src })
      if (release) {
        await act(async () => {
          release()
        })
      }
      await waitFor(() => expect(view.result.current.status).not.toBe('loading'))
    },
    switchTo: (src) => {
      statuses.length = 0
      view.rerender({ src })
    },
  }
}

beforeEach(() => {
  getDocument.mockReset()
  workerConstructions.mockReset()
  workers.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loading', () => {
  it('reports loading until the document arrives, then ready', async () => {
    const first = deferredDoc()
    serve(first)

    const d = driver()
    await d.open('a.pdf', first.release)

    expect(d.result.current.status).toBe('ready')
    expect(d.result.current.pageSizes).toHaveLength(2)
  })

  it('reports loading — not the previous document — while a new src is in flight', async () => {
    /*
     * Staleness used to be decided by `pdfDoc === null`, which could not see a swap at all:
     * on a new `src` the previous document was still in state, so the hook said 'ready'
     * while the effect cleanup had already destroyed it. Every getPage() then threw, caught
     * and logged.
     */
    const first = deferredDoc(fakeDoc(2))
    const second = deferredDoc(fakeDoc(5))
    serve(first, second)

    const d = driver()
    await d.open('a.pdf', first.release)

    d.switchTo('b.pdf')
    expect(d.result.current.status).toBe('loading')
    expect(d.result.current.pdfDoc).toBeNull()

    await act(async () => {
      second.release()
    })
    await waitFor(() => expect(d.result.current.status).toBe('ready'))
    expect(d.result.current.pageSizes).toHaveLength(5)
  })

  it('surfaces a load failure for the src it belongs to', async () => {
    getDocument.mockReturnValue({
      promise: Promise.reject(new Error('broken')),
      destroy: vi.fn(),
    })

    const d = driver()
    await d.open('bad.pdf')

    expect(d.result.current.status).toBe('error')
    expect(d.result.current.error.message).toBe('broken')
  })

  it('does not show a failed document error under the next one', async () => {
    /*
     * The old staleness test carried a `status !== 'error'` guard, which existed only
     * because a failed load left `pdfDoc` null and would otherwise have looked stale for
     * ever. Keeping it would have been a bug of its own — exactly this one.
     */
    getDocument.mockReturnValue({
      promise: Promise.reject(new Error('broken')),
      destroy: vi.fn(),
    })

    const d = driver()
    await d.open('bad.pdf')
    expect(d.result.current.status).toBe('error')

    const good = deferredDoc()
    serve(good)
    d.switchTo('good.pdf')

    expect(d.result.current.status).toBe('loading')
    expect(d.result.current.error).toBeNull()
  })

  it('is idle with no src', () => {
    const d = driver()
    expect(d.result.current.status).toBe('idle')
    expect(getDocument).not.toHaveBeenCalled()
  })
})

describe('the document cache', () => {
  it('returns to a document with no loading render at all', async () => {
    /*
     * The invariant the whole feature rests on.
     *
     * One `loading` render is enough to unmount the document view, taking the scroll
     * position and every page component with it — which is what made switching tabs feel
     * like a fresh load even when the bytes were already in the browser's cache. So this
     * asserts on the render record, not on the settled state.
     */
    const first = deferredDoc(fakeDoc(2))
    const second = deferredDoc(fakeDoc(5))
    serve(first, second)

    const d = driver()
    await d.open('a.pdf', first.release)
    await d.open('b.pdf', second.release)

    d.switchTo('a.pdf')

    expect(d.statuses).not.toContain('loading')
    expect(d.result.current.status).toBe('ready')
    expect(d.result.current.pageSizes).toHaveLength(2)
    // Nothing was fetched or parsed a second time.
    expect(getDocument).toHaveBeenCalledTimes(2)
  })

  it('hands back a document that still works', async () => {
    /*
     * Kept alive, not merely kept. The cache used to store a document whose transport had
     * already been torn down: the effect cleanup called `loadingTask.destroy()` on every
     * `src` change, and pdf.js documents that as "abort all network requests and destroy the
     * worker" — the same teardown as `doc.destroy()`.
     *
     * Everything read from the cache still looked right, because page sizes were computed
     * before the teardown. Only rasterising failed, so the viewer showed blank white pages
     * with the correct page count and geometry.
     */
    const first = deferredDoc()
    const second = deferredDoc()
    serve(first, second)

    const d = driver()
    await d.open('a.pdf', first.release)
    await d.open('b.pdf', second.release)
    await d.open('a.pdf')

    expect(first.doc.dead).toBe(false)
    // The thing a page actually does when it rasterises.
    await expect(d.result.current.pdfDoc.getPage(1)).resolves.toBeTruthy()
  })

  it('keeps the document it is leaving behind', async () => {
    // The opposite of what it used to do. Destroying on every `src` change is precisely
    // what made the next visit pay for the whole load again.
    const first = deferredDoc()
    const second = deferredDoc()
    serve(first, second)

    const d = driver()
    await d.open('a.pdf', first.release)
    await d.open('b.pdf', second.release)

    expect(first.doc.destroy).not.toHaveBeenCalled()
  })

  it('evicts and destroys the coldest document past the limit', async () => {
    const docs = [deferredDoc(), deferredDoc(), deferredDoc()]
    serve(...docs)

    const d = driver({ cacheSize: 2 })
    await d.open('a.pdf', docs[0].release)
    await d.open('b.pdf', docs[1].release)
    await d.open('c.pdf', docs[2].release)

    await waitFor(() => expect(docs[0].doc.destroy).toHaveBeenCalled())
    expect(docs[1].doc.destroy).not.toHaveBeenCalled()
    expect(docs[2].doc.destroy).not.toHaveBeenCalled()
  })

  it('counts a revisit as recent, so it is not the next to go', async () => {
    // Plain insertion order would evict A here, which is the one the reader keeps coming
    // back to. Touching on a hit is what makes it least-recently-*used*.
    const docs = [deferredDoc(), deferredDoc(), deferredDoc()]
    serve(...docs)

    const d = driver({ cacheSize: 2 })
    await d.open('a.pdf', docs[0].release)
    await d.open('b.pdf', docs[1].release)
    await d.open('a.pdf') // revisit, from cache
    await d.open('c.pdf', docs[2].release)

    await waitFor(() => expect(docs[1].doc.destroy).toHaveBeenCalled())
    expect(docs[0].doc.destroy).not.toHaveBeenCalled()
  })

  it('never evicts the document being shown', async () => {
    // With a limit of 1 the arriving document is the only one that may stay; evicting it
    // would leave the viewer holding a destroyed document, the very bug this replaced.
    const docs = [deferredDoc(), deferredDoc()]
    serve(...docs)

    const d = driver({ cacheSize: 1 })
    await d.open('a.pdf', docs[0].release)
    await d.open('b.pdf', docs[1].release)

    expect(d.result.current.status).toBe('ready')
    expect(docs[1].doc.destroy).not.toHaveBeenCalled()
    await waitFor(() => expect(docs[0].doc.destroy).toHaveBeenCalled())
  })

  it('reloads every time when the cache is switched off', async () => {
    const docs = [deferredDoc(), deferredDoc(), deferredDoc()]
    serve(...docs)

    const d = driver({ cacheSize: 0 })
    await d.open('a.pdf', docs[0].release)
    await d.open('b.pdf', docs[1].release)
    await d.open('a.pdf', docs[2].release)

    expect(getDocument).toHaveBeenCalledTimes(3)
  })

  it('destroys everything it holds on unmount', async () => {
    // Not only the active one: each cached document owns worker-side state.
    const docs = [deferredDoc(), deferredDoc()]
    serve(...docs)

    const d = driver()
    await d.open('a.pdf', docs[0].release)
    await d.open('b.pdf', docs[1].release)

    act(() => d.unmount())

    expect(docs[0].doc.destroy).toHaveBeenCalled()
    expect(docs[1].doc.destroy).toHaveBeenCalled()
  })

  it('destroys a document whose load was abandoned midway', async () => {
    /*
     * The narrow window that leaks: cancelled *after* getDocument was called but before its
     * promise settled. The document arrives with nobody holding it — it never reaches the
     * cache, so nothing else would ever destroy it.
     *
     * Cancelling any earlier is harmless and needs no cleanup, because no document exists
     * yet; the flush below is what puts the load inside the window rather than before it.
     */
    const abandoned = deferredDoc()
    const wanted = deferredDoc()
    serve(abandoned, wanted)

    const d = driver()
    d.switchTo('a.pdf')
    await act(async () => {}) // let the source resolve, so getDocument is under way
    d.switchTo('b.pdf')

    await act(async () => {
      abandoned.release()
      wanted.release()
    })

    await waitFor(() => expect(abandoned.doc.destroy).toHaveBeenCalled())
  })

  it('attaches a handler to the promise a teardown returns', async () => {
    /*
     * `destroy()` on a document or a loading task returns a promise, and it rejects when the
     * thing being torn down has already gone. That happens routinely: effect cleanups run in
     * declaration order, so the shared worker goes before the documents using it, and
     * StrictMode runs every cleanup once on mount for good measure.
     *
     * Unattended it reached the user as "Uncaught (in promise) Error: Worker was destroyed"
     * the moment the viewer mounted in development — alarming, and about nothing.
     *
     * Asserting that the result was *handled* rather than waiting to see whether a rejection
     * escapes: unhandled-rejection reporting depends on timing and on the runner, so a test
     * built on it passes either way and guards nothing. This checks the actual contract.
     */
    let handled = false
    // A thenable that only records being handled. Returning a genuinely rejected promise
    // would create the very unhandled rejection under test, before `catch` was attached.
    const trackedResult = {
      catch: () => {
        handled = true
        return Promise.resolve()
      },
    }

    const failing = deferredDoc()
    failing.doc.destroy = vi.fn(() => trackedResult)
    const next = deferredDoc()
    serve(failing, next)

    const d = driver({ cacheSize: 1 })
    await d.open('a.pdf', failing.release)
    // Evicting the first runs its destroy().
    await d.open('b.pdf', next.release)

    await waitFor(() => expect(failing.doc.destroy).toHaveBeenCalled())
    expect(handled).toBe(true)
  })

  it('defaults to keeping three documents', async () => {
    expect(DEFAULT_DOCUMENT_CACHE_SIZE).toBe(3)

    const docs = [deferredDoc(), deferredDoc(), deferredDoc()]
    serve(...docs)

    const d = driver()
    await d.open('a.pdf', docs[0].release)
    await d.open('b.pdf', docs[1].release)
    await d.open('c.pdf', docs[2].release)

    expect(docs[0].doc.destroy).not.toHaveBeenCalled()
  })
})

describe('reload', () => {
  it('ignores the cache, so Try again actually tries again', async () => {
    // Reading the cached copy back would make the retry button do nothing at all.
    const first = deferredDoc()
    const second = deferredDoc()
    serve(first, second)

    const d = driver()
    await d.open('a.pdf', first.release)
    expect(getDocument).toHaveBeenCalledTimes(1)

    await act(async () => {
      d.result.current.reload()
    })
    await act(async () => {
      second.release()
    })

    await waitFor(() => expect(getDocument).toHaveBeenCalledTimes(2))
  })
})

describe('page metadata', () => {
  it('stays in page order across batch boundaries', async () => {
    /*
     * Measuring pages was a serial loop — one worker round trip per page, 116 of them for
     * a 116-page document, before anything could be rasterised. Batching them is only safe
     * if the order survives, because everything downstream indexes by page.
     */
    const doc = deferredDoc(fakeDoc(70))
    serve(doc)

    const d = driver()
    await d.open('long.pdf', doc.release)

    const sizes = d.result.current.pageSizes
    expect(sizes).toHaveLength(70)
    expect(sizes.map((s) => s.width)).toEqual(
      Array.from({ length: 70 }, (_, i) => 100 + (i + 1))
    )
  })
})

describe('the worker', () => {
  it('is built once and shared by every document', async () => {
    // getDocument() spins up its own worker per document otherwise, so cycling between
    // attachments started and tore one down on every switch.
    const docs = [deferredDoc(), deferredDoc()]
    serve(...docs)

    const d = driver()
    await d.open('a.pdf', docs[0].release)
    await d.open('b.pdf', docs[1].release)

    expect(workerConstructions).toHaveBeenCalledTimes(1)
    expect(getDocument.mock.calls[0][0].worker).toBe(getDocument.mock.calls[1][0].worker)
  })

  it('handles its readiness promise, which rejects if it is disposed of unused', async () => {
    /*
     * pdf.js rejects a worker's readiness promise when the worker is destroyed before it
     * finished starting — `build/pdf.mjs`: `this.#capability.reject(new Error("Worker was
     * destroyed"))`. Nothing here ever awaits that promise, so unattended it became an
     * unhandled rejection.
     *
     * It happened on every mount in development. StrictMode runs each effect, its cleanup,
     * then the effect again; the load effect's first await is a `fetch`, so `getDocument()`
     * has not been reached by the time the synchronous cleanup destroys the worker. The
     * worker that rejects is one that was never used, which is why nothing broke and why it
     * appeared exactly once — a library error in the console, about nothing.
     *
     * Not covered by the `release()` helper: `PDFWorker.destroy()` returns void, so there is
     * no result to attach to. The handler has to go on the readiness promise itself.
     */
    const doc = deferredDoc()
    serve(doc)

    const d = driver()
    await d.open('a.pdf', doc.release)

    expect(workers).toHaveLength(1)
    expect(workers[0].promiseHandled).toBe(true)
  })

  it('tells pdf.js where its image decoders and fonts are', async () => {
    /*
     * pdf.js v6 decodes CCITT, JBIG2 and JPEG 2000 in WebAssembly, fetched at runtime from
     * `wasmUrl` — and there is no default. Unset, the decoder never starts, and a stencil
     * mask that fails to decode is not skipped: it is painted in full, so a scanned logo
     * comes out as a solid black rectangle with the rest of the page perfectly intact.
     *
     * Nothing throws and nothing rejects, which is why this is asserted on the call rather
     * than left to be noticed.
     */
    const doc = deferredDoc()
    serve(doc)

    const d = driver()
    await d.open('a.pdf', doc.release)

    const [params] = getDocument.mock.calls[0]
    expect(params.wasmUrl).toMatch(/wasm\/$/)
    expect(params.standardFontDataUrl).toMatch(/standard_fonts\/$/)
  })

  it('lets the host point at its own copies', async () => {
    const doc = deferredDoc()
    serve(doc)

    const d = driver({
      wasmUrl: 'https://cdn.example.com/wasm/',
      standardFontDataUrl: 'https://cdn.example.com/fonts/',
    })
    await d.open('a.pdf', doc.release)

    const [params] = getDocument.mock.calls[0]
    expect(params.wasmUrl).toBe('https://cdn.example.com/wasm/')
    expect(params.standardFontDataUrl).toBe('https://cdn.example.com/fonts/')
  })

  it('leaves a host-supplied port alone', async () => {
    // A port the host constructed is already one shared worker; building a PDFWorker over
    // the same port fights it.
    const doc = deferredDoc()
    serve(doc)

    const d = driver({ workerPort: {} })
    await d.open('a.pdf', doc.release)

    expect(workerConstructions).not.toHaveBeenCalled()
    expect(getDocument.mock.calls[0][0].worker).toBeUndefined()
  })
})

describe('scroll position', () => {
  it('is remembered per document, not shared between them', async () => {
    /*
     * Only necessary because the scroller now survives a switch. Before the cache, the
     * whole document view was unmounted and rebuilt, so there was no offset to inherit;
     * with it surviving, arriving at another document would land at the previous one's
     * offset — worse than landing at the top.
     */
    const docs = [deferredDoc(), deferredDoc()]
    serve(...docs)

    const d = driver()
    await d.open('a.pdf', docs[0].release)
    act(() => d.result.current.rememberScroll(1200))
    expect(d.result.current.getRememberedScroll()).toBe(1200)

    await d.open('b.pdf', docs[1].release)
    // A document never scrolled starts at the top rather than inheriting 1200.
    expect(d.result.current.getRememberedScroll()).toBe(0)
    act(() => d.result.current.rememberScroll(300))

    await d.open('a.pdf')
    expect(d.result.current.getRememberedScroll()).toBe(1200)

    await d.open('b.pdf')
    expect(d.result.current.getRememberedScroll()).toBe(300)
  })

  it('is forgotten along with the document it belongs to', async () => {
    // Evicted means reloaded, and a fresh load has no history to land on.
    const docs = [deferredDoc(), deferredDoc(), deferredDoc()]
    serve(...docs)

    const d = driver({ cacheSize: 1 })
    await d.open('a.pdf', docs[0].release)
    act(() => d.result.current.rememberScroll(900))

    await d.open('b.pdf', docs[1].release)
    await d.open('a.pdf', docs[2].release)

    expect(d.result.current.getRememberedScroll()).toBe(0)
  })

  it('reports zero with no document at all', () => {
    const d = driver()
    expect(d.result.current.getRememberedScroll()).toBe(0)
  })
})
