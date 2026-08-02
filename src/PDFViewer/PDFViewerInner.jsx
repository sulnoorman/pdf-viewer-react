import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
// Only the .textLayer and .annotationLayer rules, extracted from pdfjs-dist at
// build time. Importing pdf_viewer.css whole shipped 233 kB, 89% of which styles
// pdf.js's own viewer chrome — see scripts/extract-pdfjs-css.mjs.
import './styles/pdfjs-layers.generated.css'
import './styles/theme.css'
import styles from './PDFViewer.module.css'

import { Toolbar } from './components/Toolbar.jsx'
import { Document } from './components/Document.jsx'
import { ThumbnailSidebar } from './components/ThumbnailSidebar.jsx'
import { LoadingState, ErrorState, EmptyState } from './components/feedback/DocumentStatus.jsx'
import { ViewerProvider } from './context/ViewerContext.jsx'
import { useTools } from './context/ToolContext.jsx'
import {
  useAnnotationActions,
  useAnnotationState,
  useAnnotationCounts,
} from './context/AnnotationContext.jsx'
import { usePdfDocument } from './hooks/usePdfDocument.js'
import { useZoom } from './hooks/useZoom.js'
import { usePageVisibility } from './hooks/usePageVisibility.js'
import { usePinchZoom } from './hooks/usePinchZoom.js'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { useLatestRef } from './hooks/useLatestRef.js'
import {
  createImageAnnotation,
  createTextAnnotation,
  selectAll,
} from './reducers/annotationReducer.js'
import { exportFlattenedPdf } from './utils/exportPdf.js'
import { displayPageSize, normalizeRotation } from './utils/coords.js'
import { useStampAssets } from './hooks/useStampAssets.js'
import { createId } from './utils/id.js'
import { useLabels } from './context/LabelContext.jsx'

/** Image stamps start this wide; the height follows the image's aspect ratio. */
const DEFAULT_STAMP_WIDTH = 150

/**
 * Everything below the providers.
 *
 * Split out from index.jsx because these hooks consume the very contexts index.jsx
 * mounts, and a component cannot read a provider it renders itself.
 */
export function PDFViewerInner({ src, config = {}, viewerRef }) {
  const {
    specimenAsset,
    stampAssets: stampAssetsProp,
    onSpecimenChange,
    onAnnotationsChange,
    onDownload,
    onLoadError,
    canDownload = true,
    allowMultipleStamps = true,
    maxStamps = null,
    /**
     * Whether rotating a page in the viewer also rotates it in the exported file.
     * Defaults to true: this is a stamping tool, so someone who turns a sideways scan
     * to sign it expects the recipient to receive it the right way up. Set false for
     * the Chrome-style "rotation is only for reading" behaviour.
     */
    rotateExportedPages = true,
    /** Let the user pick their own stamp image from disk. */
    allowStampUpload = true,
    customToolbarActions = [],
    workerSrc,
    workerPort,
  } = config

  /*
   * The scroll container is held in STATE, not a ref.
   *
   * It only exists once the document is ready — before that the viewer shows a
   * loading state and <Document> is not mounted. A ref mutation does not re-run
   * effects, so the wheel, pinch and IntersectionObserver listeners attached to a
   * null container on first render and never retried — trackpad pinch fell straight
   * through to the browser instead of zooming the document.
   */
  const [scrollContainer, setScrollContainerState] = useState(null)
  const scrollContainerRef = useRef(null)
  const setScrollContainer = useCallback((element) => {
    scrollContainerRef.current = element
    setScrollContainerState(element)
  }, [])
  const [showThumbnails, setShowThumbnails] = useState(false)

  /**
   * Extra rotation the viewer applies on top of each page's intrinsic /Rotate.
   * Purely a viewing preference: it never reaches the exported file, because turning
   * a scan to read it must not rewrite the document.
   */
  const [pageRotations, setPageRotations] = useState({})

  const { pdfDoc, pageSizes, sourceBytes, status, error, reload } = usePdfDocument(src, {
    workerSrc,
    workerPort,
    onLoadError,
  })

  const pageCount = pdfDoc?.numPages ?? 0
  const { activePageIndex, activePageRef, renderWindow, registerPage, scrollToPage } =
    usePageVisibility({ pageCount, container: scrollContainer, containerRef: scrollContainerRef })

  // Fit modes must measure the page as displayed, not as stored, or rotating a
  // landscape page to portrait would leave it overflowing.
  const displayPageSizes = useMemo(
    () => pageSizes.map((size, i) => displayPageSize(size, pageRotations[i] ?? 0)),
    [pageSizes, pageRotations]
  )

  const zoom = useZoom({
    pageSizes: displayPageSizes,
    container: scrollContainer,
    containerRef: scrollContainerRef,
  })
  const tools = useTools()
  const labels = useLabels()

  usePinchZoom({
    container: scrollContainer,
    containerRef: scrollContainerRef,
    setScale: zoom.setScale,
    anchorAtPointer: zoom.anchorAtPointer,
    cancelStrokeRef: tools.cancelStrokeRef,
    isDraggingRef: tools.isDraggingRef,
  })

  const actions = useAnnotationActions()
  const { canUndo, canRedo } = useAnnotationState()
  const counts = useAnnotationCounts()

  const {
    assets: stampAssets,
    list: stampAssetList,
    addUploadedAsset,
  } = useStampAssets({ specimenAsset, stampAssets: stampAssetsProp })

  const viewerValue = useMemo(
    () => ({
      pdfDoc,
      pageSizes,
      pageRotations,
      status,
      error,
      scale: zoom.scale,
      setScrollContainer,
      stampAssets,
    }),
    [pdfDoc, pageSizes, pageRotations, status, error, zoom.scale, stampAssets, setScrollContainer]
  )

  /** Turn one page, or every page, by a quarter turn. */
  const rotatePages = useCallback(
    (delta, scope = 'page') => {
      setPageRotations((current) => {
        const next = { ...current }
        const targets =
          scope === 'all' ? Array.from({ length: pageCount }, (_, i) => i) : [activePageRef.current]
        for (const index of targets) {
          next[index] = normalizeRotation((next[index] ?? 0) + delta)
        }
        return next
      })
    },
    [pageCount, activePageRef]
  )

  /* ----------------------------- host callbacks ---------------------------- */

  const onSpecimenChangeRef = useLatestRef(onSpecimenChange)
  const onAnnotationsChangeRef = useLatestRef(onAnnotationsChange)

  useEffect(() => {
    // Kept for compatibility: reports image stamps only.
    onSpecimenChangeRef.current?.(counts.image > 0)
    // The replacement, so a host can enable Download for ink or text too — gating on
    // the specimen flag alone locked out anyone who had only drawn or typed.
    onAnnotationsChangeRef.current?.(counts)
  }, [counts, onSpecimenChangeRef, onAnnotationsChangeRef])

  /* -------------------------------- actions -------------------------------- */

  const addImageStamp = useCallback(
    async (assetId) => {
      if (!pdfDoc) return null
      if (!allowMultipleStamps && counts.image >= 1) return null
      if (allowMultipleStamps && maxStamps !== null && counts.image >= maxStamps) return null

      // Fall back to the only asset there is, which is the common single-signature case.
      const id = assetId ?? stampAssetList[0]?.id
      const asset = id ? stampAssets[id] : null
      if (!asset?.src) return null

      // Measure the image so the stamp is never stretched.
      let height = 60
      const image = new Image()
      image.src = asset.src
      await new Promise((resolve) => {
        image.onload = resolve
        image.onerror = resolve
      })
      if (image.width && image.height) {
        height = DEFAULT_STAMP_WIDTH * (image.height / image.width)
      }

      const annotation = createImageAnnotation({
        assetId: id,
        pageIndex: activePageRef.current,
        width: DEFAULT_STAMP_WIDTH,
        height,
      })
      actions.add(annotation)
      tools.setActiveId(annotation.id)
      return annotation.id
    },
    [
      pdfDoc,
      allowMultipleStamps,
      maxStamps,
      counts.image,
      stampAssets,
      stampAssetList,
      actions,
      activePageRef,
      tools,
    ]
  )

  /** Pick an image from disk and place it immediately. */
  const uploadStamp = useCallback(
    async (file) => {
      const assetId = await addUploadedAsset(file)
      if (assetId) await addImageStamp(assetId)
    },
    [addUploadedAsset, addImageStamp]
  )

  const addTextStamp = useCallback(
    ({ text = '', fontSize = 16, color = '#000000', fontFamily = 'Helvetica' } = {}) => {
      const annotation = createTextAnnotation({
        pageIndex: activePageRef.current,
        text,
        fontSize,
        color,
        fontFamily,
      })
      actions.add(annotation)
      // Selecting it lets the box focus itself, so the user can type straight away.
      tools.setActiveId(annotation.id)
      return annotation.id
    },
    [actions, activePageRef, tools]
  )

  /* ------------------------- duplicate / copy / paste ----------------------- */

  const clipboardRef = useRef(null)

  const duplicateAnnotation = useCallback(
    (id) => {
      const target = id ?? tools.activeIdRef.current
      if (!target) return false
      actions.duplicate(target)
      return true
    },
    [actions, tools]
  )

  const copyActive = useCallback(() => {
    const id = tools.activeIdRef.current
    if (!id) return false
    const annotation = actions.getSnapshot().byId[id]
    if (!annotation) return false
    clipboardRef.current = annotation
    return true
  }, [actions, tools])

  const pasteClipboard = useCallback(() => {
    const source = clipboardRef.current
    if (!source) return false

    // Pasted onto whatever page the user is looking at now, offset a little so it
    // does not hide the original when pasting onto the same page.
    const offset = 16
    const copy = {
      ...source,
      id: undefined,
      pageIndex: activePageRef.current,
      x: source.x + offset,
      y: source.y + offset,
    }
    if (Array.isArray(source.points)) {
      copy.points = source.points.map((p) => ({ x: p.x + offset, y: p.y + offset }))
    }

    const annotation = { ...copy, id: createId(source.type) }
    actions.add(annotation)
    tools.setActiveId(annotation.id)
    return true
  }, [actions, activePageRef, tools])

  const deleteActive = useCallback(() => {
    const id = tools.activeIdRef.current
    if (!id) return false
    actions.remove(id)
    tools.setActiveId(null)
    return true
  }, [actions, tools])

  useKeyboardShortcuts({
    onZoomIn: () => zoom.setScale((s) => s * 1.1),
    onZoomOut: () => zoom.setScale((s) => s * 0.9),
    onZoomReset: () => zoom.setZoomMode('auto'),
    onUndo: actions.undo,
    onRedo: actions.redo,
    onDelete: deleteActive,
    onDuplicate: duplicateAnnotation,
    onCopy: copyActive,
    onPaste: pasteClipboard,
    onEscape: () => tools.setActiveId(null),
  })

  /* ------------------------------ imperative API ---------------------------- */

  useImperativeHandle(
    viewerRef,
    () => ({
      addTextStamp,
      addImageStamp,
      undo: actions.undo,
      redo: actions.redo,
      getAnnotations: () => selectAll(actions.getSnapshot()),
      getFlattenedPDF: async () => {
        if (!sourceBytes) throw new Error('No document loaded')
        // Reuses the bytes fetched at load time, so export works for a File or an
        // ArrayBuffer source and does not depend on the URL still being reachable.
        return exportFlattenedPdf(sourceBytes, selectAll(actions.getSnapshot()), stampAssets, {
          pageRotations,
          rotateExportedPages,
        })
      },
    }),
    [
      addTextStamp,
      addImageStamp,
      actions,
      sourceBytes,
      stampAssets,
      pageRotations,
      rotateExportedPages,
    ]
  )

  return (
    <ViewerProvider value={viewerValue}>
      {/* `rpvs-viewer` is the stable, unhashed hook consumers theme through. */}
      <div className={`rpvs-viewer ${styles.shell}`}>
        <Toolbar
          scale={zoom.scale}
          setScale={zoom.setScale}
          zoomMode={zoom.zoomMode}
          setZoomMode={zoom.setZoomMode}
          stampAssets={stampAssetList}
          allowStampUpload={allowStampUpload}
          onAddStamp={addImageStamp}
          onUploadStamp={uploadStamp}
          onAddText={() => addTextStamp({})}
          onDownload={onDownload}
          canDownload={canDownload}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={actions.undo}
          onRedo={actions.redo}
          pageCount={pageCount}
          activePageIndex={activePageIndex}
          onGoToPage={scrollToPage}
          showThumbnails={showThumbnails}
          onToggleThumbnails={() => setShowThumbnails((open) => !open)}
          onRotatePages={rotatePages}
          customToolbarActions={customToolbarActions}
        />

        <div className={styles.body}>
          {status === 'ready' && showThumbnails && (
            <ThumbnailSidebar activePageIndex={activePageIndex} onGoToPage={scrollToPage} />
          )}

          {status === 'error' && (
            <ErrorState
              error={error}
              onRetry={reload}
              label={labels.loadFailed}
              retryLabel={labels.retry}
            />
          )}
          {status === 'loading' && <LoadingState label={labels.loading} />}
          {status === 'idle' && <EmptyState label={labels.noDocument} />}
          {status === 'ready' && (
            <Document registerPage={registerPage} renderWindow={renderWindow} />
          )}
        </div>
      </div>
    </ViewerProvider>
  )
}
