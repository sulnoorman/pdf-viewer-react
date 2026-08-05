import { useEffect, useState, useCallback, useMemo } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { configureWorker, describeWorkerFailure } from '../utils/worker.js'
import { normalizeRotation } from '../utils/coords.js'
import { normalizePdfSource, copyBytes } from '../utils/source.js'
import { useLatestRef } from './useLatestRef.js'

const IDLE = { status: 'idle', pdfDoc: null, pageSizes: [], sourceBytes: null, error: null }

/**
 * Loads a PDF and reports the geometry of every page up front.
 *
 * Three things worth knowing:
 *
 * - **The bytes are loaded once and kept.** Export used to re-fetch `src`, which
 *   wasted a round trip and broke entirely for sources that were not re-fetchable.
 * - **Page sizes are prefetched.** Zoom-fit used to measure only page 1, so any
 *   document mixing page sizes fitted to the wrong width; virtualisation will also
 *   need the full document height before anything is rasterised.
 * - **The "no src" case is derived, not written from the effect.** Resetting state
 *   synchronously inside an effect triggers a cascading render.
 *
 * @param {import('../utils/source.js').PdfSource} src
 * @param {{workerSrc?: string, workerPort?: Worker, onLoadError?: (e: Error) => void}} options
 */
export function usePdfDocument(src, { workerSrc, workerPort, onLoadError } = {}) {
  const [loaded, setLoaded] = useState(IDLE)
  const [reloadToken, setReloadToken] = useState(0)

  // An inline arrow in the host's JSX must not retrigger a document load.
  const onLoadErrorRef = useLatestRef(onLoadError)

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!src) return

    configureWorker({ workerSrc, workerPort })

    let cancelled = false
    let loadingTask = null
    let doc = null

    const load = async () => {
      try {
        const sourceBytes = await normalizePdfSource(src)
        if (cancelled) return

        // pdf.js detaches the buffer it is handed, so it gets its own copy and the
        // pristine bytes stay available for export.
        loadingTask = pdfjsLib.getDocument({ data: copyBytes(sourceBytes) })
        doc = await loadingTask.promise
        if (cancelled) return

        // Metadata only — cheap even for a few hundred pages.
        const pageSizes = []
        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
          const page = await doc.getPage(pageNumber)
          if (cancelled) return
          const viewport = page.getViewport({ scale: 1 })
          pageSizes.push({
            width: viewport.width,
            height: viewport.height,
            rotate: normalizeRotation(page.rotate),
          })
        }
        if (cancelled) return

        setLoaded({ status: 'ready', pdfDoc: doc, pageSizes, sourceBytes, error: null })
      } catch (err) {
        if (cancelled || err?.name === 'RenderingCancelledException') return
        // Previously there was no catch at all: a bad URL or a corrupt file left the
        // viewer on a blank dark screen with the reason only in the console.
        //
        // Worker failures get an extra paragraph: pdf.js reports them as "Setting up
        // fake worker failed", which names no cause and no fix.
        err.message = describeWorkerFailure(err)
        console.error('[@armsolusi/pdf-viewer] Failed to load document:', err)
        setLoaded({ ...IDLE, status: 'error', error: err })
        onLoadErrorRef.current?.(err)
      }
    }

    load()

    return () => {
      cancelled = true
      loadingTask?.destroy?.()
      if (doc && typeof doc.destroy === 'function') doc.destroy()
    }
  }, [src, workerSrc, workerPort, reloadToken, onLoadErrorRef])

  // While a new src is in flight the previous result is still in `loaded`; report
  // 'loading' rather than showing stale pages as ready.
  const isStale = Boolean(src) && loaded.pdfDoc === null && loaded.status !== 'error'

  return useMemo(() => {
    if (!src) return { ...IDLE, reload }
    if (isStale) return { ...IDLE, status: 'loading', reload }
    return { ...loaded, reload }
  }, [src, isStale, loaded, reload])
}
