import { useEffect, useReducer, useCallback, useMemo, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { configureWorker, describeWorkerFailure, resolveAssetUrls } from '../utils/worker.js'
import { normalizeRotation } from '../utils/coords.js'
import { normalizePdfSource, copyBytes, sourceKey } from '../utils/source.js'
import { useLatestRef } from './useLatestRef.js'

/** How many parsed documents to keep, when the host says nothing. */
export const DEFAULT_DOCUMENT_CACHE_SIZE = 3

/**
 * Page metadata is fetched in batches of this many.
 *
 * Each `getPage()` is a round trip to the worker, and this used to be a serial loop — 116
 * sequential round trips for a 116-page document, repeated on every switch. Unbounded
 * concurrency is not the answer either: a 500-page document would fire 500 requests at once
 * and stall everything behind them.
 */
const PAGE_METADATA_BATCH = 32

const IDLE = {
  status: 'idle',
  pdfDoc: null,
  pageSizes: [],
  sourceBytes: null,
  error: null,
  documentKey: null,
}

/**
 * Distinguishes one loaded document from another as a React key.
 *
 * `src` cannot serve: it may be a File or an ArrayBuffer, and a key has to be a string.
 * A counter is enough — it only has to differ between documents, never mean anything.
 */
let nextDocumentKey = 1

/**
 * Tear something down without caring whether it worked.
 *
 * `PDFDocumentProxy.destroy()` and `PDFDocumentLoadingTask.destroy()` both return promises,
 * and both reject when what they are tearing down has already gone — which happens routinely
 * and harmlessly. Effect cleanups run in declaration order, so the shared worker is disposed
 * of before the documents using it, and React's StrictMode runs every cleanup once on mount
 * for good measure. Unattended, those rejections surface in the console as
 * "Uncaught (in promise) Error: Worker was destroyed" the moment the viewer mounts in
 * development.
 *
 * Swallowing is the right answer for a teardown specifically: there is no state left to
 * corrupt and nothing a caller could do about it. Nothing else in this file ignores an error.
 */
function release(destroyable) {
  try {
    const result = destroyable?.destroy?.()
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch {
    // Synchronous throw from a destroy() is the same story.
  }
}

/* ------------------------------------------------------------------ *
 * The document cache
 * ------------------------------------------------------------------ */

const CACHE_ACTIONS = {
  LOADED: 'cache/loaded',
  FAILED: 'cache/failed',
  TOUCHED: 'cache/touched',
  EVICTED: 'cache/evicted',
}

const EMPTY_CACHE = { documents: new Map(), failure: null }

/**
 * Least-recently-used, exploiting the fact that a `Map` iterates in insertion order: a hit
 * deletes and re-inserts the key to move it to the end, so the first key is always the
 * coldest. Nothing here calls `destroy()` — a reducer must stay pure, so the caller
 * destroys whatever comes back in `evicted`.
 */
function cacheReducer(state, action) {
  switch (action.type) {
    case CACHE_ACTIONS.TOUCHED: {
      const entry = state.documents.get(action.key)
      if (!entry) return state
      const documents = new Map(state.documents)
      documents.delete(action.key)
      documents.set(action.key, entry)
      return { ...state, documents }
    }

    case CACHE_ACTIONS.LOADED: {
      const documents = new Map(state.documents)
      documents.delete(action.key)
      documents.set(action.key, action.entry)

      /*
       * Evicting is the caller's job to finish, but choosing what to evict is state. The
       * key just inserted can never be chosen: it was moved to the end above, and this
       * walks from the front.
       */
      const evicted = []
      for (const key of documents.keys()) {
        if (documents.size - evicted.length <= Math.max(1, action.limit)) break
        evicted.push(key)
      }
      for (const key of evicted) documents.delete(key)

      return {
        documents,
        failure: state.failure?.key === action.key ? null : state.failure,
        evicted: evicted.map((key) => state.documents.get(key)).filter(Boolean),
      }
    }

    case CACHE_ACTIONS.FAILED:
      return { ...state, failure: { key: action.key, error: action.error }, evicted: undefined }

    case CACHE_ACTIONS.EVICTED: {
      if (!state.documents.has(action.key)) return state
      const documents = new Map(state.documents)
      documents.delete(action.key)
      return { ...state, documents, evicted: undefined }
    }

    default:
      return state
  }
}

/* ------------------------------------------------------------------ *
 * Hook
 * ------------------------------------------------------------------ */

/**
 * Loads a PDF and reports the geometry of every page up front.
 *
 * Four things worth knowing:
 *
 * - **The bytes are loaded once and kept.** Export used to re-fetch `src`, which
 *   wasted a round trip and broke entirely for sources that were not re-fetchable.
 * - **Page sizes are prefetched.** Zoom-fit used to measure only page 1, so any
 *   document mixing page sizes fitted to the wrong width; virtualisation also needs
 *   the full document height before anything is rasterised.
 * - **Documents already visited are kept parsed**, so a host cycling one viewer through
 *   several documents does not pay for the whole load again. See below.
 * - **The "no src" case is derived, not written from the effect.** Resetting state
 *   synchronously inside an effect triggers a cascading render.
 *
 * ## Why the cache lives in reducer state
 *
 * A hit has to be visible *during render*. Held in a ref, the first render after `src`
 * changes would not know the document was already there, so it would report `loading` —
 * which unmounts the whole document view, throwing away the scroll position and every page
 * component, exactly what the cache exists to avoid. Correcting it in an effect does not
 * help: one frame is enough to unmount. And a ref cannot be read during render anyway
 * (`react-hooks/refs`, rightly). Reducer state can.
 *
 * @param {import('../utils/source.js').PdfSource} src
 * @param {{workerSrc?: string, workerPort?: Worker, cacheSize?: number,
 *          onLoadError?: (e: Error) => void}} options
 */
export function usePdfDocument(
  src,
  {
    workerSrc,
    workerPort,
    wasmUrl,
    standardFontDataUrl,
    cacheSize = DEFAULT_DOCUMENT_CACHE_SIZE,
    onLoadError,
  } = {}
) {
  const [cache, dispatch] = useReducer(cacheReducer, EMPTY_CACHE)
  const [reloadToken, bumpReloadToken] = useReducer((n) => n + 1, 0)

  // An inline arrow in the host's JSX must not retrigger a document load.
  const onLoadErrorRef = useLatestRef(onLoadError)

  const key = src ? sourceKey(src) : null
  const entry = key === null ? null : cache.documents.get(key)
  const failure = key !== null && cache.failure?.key === key ? cache.failure.error : null

  /*
   * Shadows the cache for teardown and for scroll bookkeeping.
   *
   * The unmount cleanup has to destroy every document held, and a cleanup closure would
   * otherwise capture the Map as it was when the effect ran. `useLatestRef` assigns from
   * an effect, because writing to a ref during render is no more allowed than reading one;
   * both consumers here run later than that.
   */
  const documentsRef = useLatestRef(cache.documents)

  /**
   * One worker for every document.
   *
   * `getDocument()` spins up its own worker per document otherwise, so cycling between
   * attachments started and tore one down each time — cost paid on every switch.
   *
   * Skipped when the host supplied a `workerPort`: that is already a single shared worker,
   * and building a `PDFWorker` over the same port fights it.
   */
  const workerRef = useRef(null)
  useEffect(() => {
    if (workerPort) return undefined
    configureWorker({ workerSrc, workerPort })
    const worker = new pdfjsLib.PDFWorker()

    /*
     * Not decoration, and not covered by `release()` below: `PDFWorker.destroy()` returns
     * void, so there is no result to attach to — this promise is the only place a handler
     * can go.
     *
     * pdf.js rejects a worker's readiness promise when the worker is disposed of before it
     * finished starting: `this.#capability.reject(new Error("Worker was destroyed"))`.
     * Nothing here awaits it, so left alone it surfaced as an unhandled rejection on every
     * mount in development — StrictMode runs each effect, its cleanup, then the effect
     * again, and the load effect's first await is a `fetch`, so the worker is destroyed long
     * before `getDocument()` is reached. The worker that rejects is therefore one that was
     * never used: nothing is wrong, and nobody can act on it.
     */
    worker.promise?.catch(() => {})

    workerRef.current = worker
    return () => {
      workerRef.current = null
      worker.destroy()
    }
  }, [workerSrc, workerPort])

  /** Destroy everything held, on unmount only. */
  useEffect(
    () => () => {
      for (const held of documentsRef.current.values()) release(held.pdfDoc)
    },
    [documentsRef]
  )

  const reload = useCallback(() => {
    // Without evicting first this would hand back the cached copy, so "Try again" would
    // do nothing at all.
    if (key !== null) dispatch({ type: CACHE_ACTIONS.EVICTED, key })
    bumpReloadToken()
  }, [key])

  // Destroying is a side effect, so the reducer only nominates; this carries it out.
  useEffect(() => {
    if (!cache.evicted?.length) return
    for (const held of cache.evicted) release(held.pdfDoc)
  }, [cache.evicted])

  useEffect(() => {
    if (!src || key === null) return undefined

    // Already parsed: nothing to load, only to mark as recently used.
    if (cache.documents.has(key)) {
      dispatch({ type: CACHE_ACTIONS.TOUCHED, key })
      return undefined
    }

    configureWorker({ workerSrc, workerPort })

    let cancelled = false
    let loadingTask = null
    /*
     * Whether the document reached the cache, and therefore whether its loading task is
     * still needed.
     *
     * pdf.js documents `PDFDocumentLoadingTask.destroy()` as "abort all network requests and
     * destroy the worker" — it tears down the document's whole transport, and
     * `PDFDocumentProxy.destroy()` is a wrapper over the same thing. So the cleanup below
     * cannot simply always call it: doing that killed the very document just handed to the
     * cache, and the viewer then showed blank white pages with a perfectly correct page
     * count and geometry, because the page sizes had been read before the teardown.
     *
     * Once cached, the task belongs to the document and lives until the entry is evicted or
     * the viewer unmounts, where `pdfDoc.destroy()` handles it.
     */
    let handedToCache = false

    const load = async () => {
      let doc = null
      try {
        const sourceBytes = await normalizePdfSource(src)
        if (cancelled) return

        // pdf.js detaches the buffer it is handed, so it gets its own copy and the
        // pristine bytes stay available for export.
        loadingTask = pdfjsLib.getDocument({
          data: copyBytes(sourceBytes),
          ...(workerRef.current ? { worker: workerRef.current } : {}),
          /*
           * Where to fetch the image decoders and standard font data. Both have to be given
           * per document — unlike the worker, pdf.js exposes no global for them, and has no
           * default: an unset `wasmUrl` is concatenated with the filename as the string
           * "null", which is how this surfaced as `Cannot find package 'nulljbig2…'`.
           */
          ...resolveAssetUrls({ wasmUrl, standardFontDataUrl }),
        })
        doc = await loadingTask.promise
        if (cancelled) return

        const pageSizes = await readPageSizes(doc, () => cancelled)
        if (cancelled || !pageSizes) return

        dispatch({
          type: CACHE_ACTIONS.LOADED,
          key,
          limit: cacheSize,
          entry: {
            pdfDoc: doc,
            pageSizes,
            sourceBytes,
            scrollTop: 0,
            documentKey: `doc-${nextDocumentKey++}`,
          },
        })
        // Handed to the cache: neither the document nor its task is ours to destroy.
        handedToCache = true
        doc = null
      } catch (err) {
        if (cancelled || err?.name === 'RenderingCancelledException') return
        // Previously there was no catch at all: a bad URL or a corrupt file left the
        // viewer on a blank dark screen with the reason only in the console.
        //
        // Worker failures get an extra paragraph: pdf.js reports them as "Setting up
        // fake worker failed", which names no cause and no fix.
        err.message = describeWorkerFailure(err)
        console.error('[@armsolusi/pdf-viewer] Failed to load document:', err)
        dispatch({ type: CACHE_ACTIONS.FAILED, key, error: err })
        onLoadErrorRef.current?.(err)
      } finally {
        // A load abandoned midway still produced a document nobody holds.
        if (doc) release(doc)
      }
    }

    load()

    return () => {
      cancelled = true
      // Only a task whose document never reached the cache. See `handedToCache` above:
      // destroying it takes the document down with it.
      if (!handedToCache) release(loadingTask)
    }
    // `cache.documents` is deliberately absent: this must run when the document being
    // asked for changes, not every time the cache is reordered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    key,
    src,
    workerSrc,
    workerPort,
    wasmUrl,
    standardFontDataUrl,
    cacheSize,
    reloadToken,
    onLoadErrorRef,
  ])

  /** Remember where the reader was, so returning to a document lands there. */
  const rememberScroll = useCallback(
    (scrollTop) => {
      const held = documentsRef.current.get(key)
      // Written straight onto the entry rather than dispatched: it changes on every scroll
      // frame, and nothing renders from it.
      if (held) held.scrollTop = scrollTop
    },
    [key, documentsRef]
  )

  /**
   * Read it back. A function rather than a value, so restoring can depend on *which*
   * document is being shown without depending on a number that moves every scroll frame —
   * which would drag the view back as the reader scrolled.
   */
  const getRememberedScroll = useCallback(
    () => documentsRef.current.get(key)?.scrollTop ?? 0,
    [key, documentsRef]
  )

  return useMemo(() => {
    const scroll = { rememberScroll, getRememberedScroll }
    if (!src) return { ...IDLE, reload, ...scroll }
    if (entry) {
      return {
        status: 'ready',
        pdfDoc: entry.pdfDoc,
        pageSizes: entry.pageSizes,
        sourceBytes: entry.sourceBytes,
        documentKey: entry.documentKey,
        error: null,
        reload,
        ...scroll,
      }
    }
    if (failure) return { ...IDLE, status: 'error', error: failure, reload, ...scroll }
    return { ...IDLE, status: 'loading', reload, ...scroll }
  }, [src, entry, failure, reload, rememberScroll, getRememberedScroll])
}

/**
 * Every page's display geometry, in page order.
 *
 * Batched rather than serial: each `getPage()` is a round trip to the worker, and doing
 * them one after another meant a 116-page document paid 116 sequential round trips before
 * anything could be rasterised — on the first load as much as on a switch.
 *
 * @returns {Promise<Array|null>} null if the caller cancelled partway
 */
async function readPageSizes(doc, cancelled) {
  const pageSizes = []

  for (let start = 1; start <= doc.numPages; start += PAGE_METADATA_BATCH) {
    const end = Math.min(start + PAGE_METADATA_BATCH - 1, doc.numPages)
    const numbers = []
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) numbers.push(pageNumber)

    // Promise.all preserves order, so page indices stay aligned with the document.
    const batch = await Promise.all(
      numbers.map(async (pageNumber) => {
        const page = await doc.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1 })
        return {
          width: viewport.width,
          height: viewport.height,
          rotate: normalizeRotation(page.rotate),
        }
      })
    )
    if (cancelled()) return null
    pageSizes.push(...batch)
  }

  return pageSizes
}
