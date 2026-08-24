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
import { useAnnotationActions, useAnnotationState } from './context/AnnotationContext.jsx'
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
import { containRect } from './utils/transform.js'
import { deriveViewerState, sameCounts } from './utils/viewerState.js'
import { useStampAssets, ASSET_KINDS, ASSET_SOURCES } from './hooks/useStampAssets.js'
import { usePdfViewer } from './viewer/usePdfViewer.js'
import { createId } from './utils/id.js'
import { useLabels } from './context/LabelContext.jsx'

/** Image stamps start this wide; the height follows the image's aspect ratio. */
const DEFAULT_STAMP_WIDTH = 150

const warnedAssets = new Set()

/**
 * A stamp image that will not load is otherwise a silent blank: an empty thumbnail in the
 * menu and an empty box on the page, with nothing pointing at the URL.
 *
 * Not gated on a dev/prod flag — `import.meta.env.PROD` is substituted when *this package*
 * is built, not the consumer's app, so such a guard removes the warning before anyone can
 * see it. Warned once per asset, so it cannot flood a console.
 */
function warnAssetFailed(assetId, src) {
  if (warnedAssets.has(assetId)) return
  warnedAssets.add(assetId)
  console.warn(
    `[@armsolusi/pdf-viewer] The stamp image for "${assetId}" failed to load: ${src}\n` +
      'Check the URL resolves from the browser. A path beginning with "/" is resolved ' +
      'against the origin, ignoring your bundler\'s base — under a base such as ' +
      '"/my-app/", use `${import.meta.env.BASE_URL}my-image.png` instead of "/my-image.png".'
  )
}

/**
 * Everything below the providers.
 *
 * Split out from index.jsx because these hooks consume the very contexts index.jsx
 * mounts, and a component cannot read a provider it renders itself.
 */
export function PDFViewerInner({ src, config = {}, viewerRef, viewer }) {
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
    /**
     * `{ displayActions, customToolbarActions }`, or `false` to drop the bar entirely
     * for a host that builds its own outside the viewer and drives it through the
     * `viewer` handle.
     */
    toolbar,
    /** Replace the bar wholesale: `({ viewer, state, labels }) => ReactNode`. */
    renderToolbar,
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
  const { annotations, canUndo, canRedo } = useAnnotationState()

  const {
    assets: stampAssets,
    list: stampAssetList,
    addUploadedAsset,
  } = useStampAssets({ specimenAsset, stampAssets: stampAssetsProp })

  /*
   * Derived from the annotations AND the asset registry, because the two questions a
   * host asks cannot be answered by either alone: a seal and a signature are both
   * image annotations, and only the registry knows which is which.
   */
  const { hasSpecimen, hasAnnotation, counts } = useMemo(
    () => deriveViewerState({ annotations: selectAll(annotations), assets: stampAssets }),
    [annotations, stampAssets]
  )

  /**
   * Which asset the Add Stamp button places when the caller does not name one.
   *
   * The specimen wins. It used to be `stampAssetList[0]`, and the specimen was
   * appended last, so configuring `stampAssets` as well as `specimenAsset` quietly
   * made the button stamp the wrong image.
   */
  const defaultAssetId = useMemo(() => {
    const specimen = stampAssetList.find((asset) => asset.kind === ASSET_KINDS.SPECIMEN)
    return (specimen ?? stampAssetList[0])?.id
  }, [stampAssetList])

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

  /*
   * Both callbacks are edge-triggered.
   *
   * `counts` is recomputed whenever any annotation changes, so firing on every change
   * re-notified the host on each pointer-up of a drag with numbers that had not moved.
   * A host that calls setState from these — which is the documented use — was
   * re-rendering its tree for nothing. The refs start at a value no state can equal,
   * so both still fire once on mount and the host begins in the right state.
   */
  const lastSpecimenRef = useRef(null)
  const lastCountsRef = useRef(null)

  useEffect(() => {
    if (lastSpecimenRef.current !== hasSpecimen) {
      lastSpecimenRef.current = hasSpecimen
      // Now genuinely "is there a specimen?" rather than "is there any image?".
      onSpecimenChangeRef.current?.(hasSpecimen)
    }
    if (!sameCounts(lastCountsRef.current, counts)) {
      lastCountsRef.current = counts
      onAnnotationsChangeRef.current?.(counts)
    }
  }, [hasSpecimen, counts, onSpecimenChangeRef, onAnnotationsChangeRef])

  /* -------------------------------- actions -------------------------------- */

  const addImageStamp = useCallback(
    async (assetId) => {
      if (!pdfDoc) return null
      if (!allowMultipleStamps && counts.image >= 1) return null
      if (allowMultipleStamps && maxStamps !== null && counts.image >= maxStamps) return null

      const id = assetId ?? defaultAssetId
      const asset = id ? stampAssets[id] : null
      if (!asset?.src) return null

      // Measure the image so the stamp is never stretched.
      let height = 60
      const image = new Image()
      image.src = asset.src
      const loaded = await new Promise((resolve) => {
        image.onload = () => resolve(true)
        image.onerror = () => resolve(false)
      })

      // Placed anyway — a broken image is visible in the page, whereas refusing to place
      // one looks like the button is dead. But say so: the URL is the host's, and the
      // usual cause is a root-relative path under a bundler `base`, which resolves
      // against the origin instead of the deployed sub-path.
      if (!loaded) warnAssetFailed(id, asset.src)

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
      defaultAssetId,
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
      /*
       * Bounded, or duplicating a stamp already tucked into a corner offsets the copy
       * straight off the page. The toolbar's own duplicate button goes through Page.jsx,
       * which passes these too; this is the Ctrl+D and `duplicateSelected()` door.
       *
       * The bounds come from the annotation's OWN page, not the page on screen — the copy
       * stays where its original was, and those can be different sizes.
       */
      const source = actions.getSnapshot().byId[target]
      actions.duplicate(target, undefined, source ? pageSizes[source.pageIndex] : undefined)
      return true
    },
    [actions, tools, pageSizes]
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
    const pageIndex = activePageRef.current
    const offset = 16

    /*
     * The offset is trimmed to whatever room the destination page has.
     *
     * This path needed it most: it keeps the source coordinates but swaps the page, so
     * copying from a large page and pasting onto a smaller one could land the copy well
     * outside — and unlike a drag, there is no gesture afterwards to correct it.
     *
     * Ink is left alone: a stroke is a list of absolute points with no rect to clamp.
     */
    let dx = offset
    let dy = offset
    if (!Array.isArray(source.points)) {
      const contained = containRect(
        { x: source.x + offset, y: source.y + offset, width: source.width, height: source.height },
        source.rotation ?? 0,
        pageSizes[pageIndex]
      )
      dx = contained.x - source.x
      dy = contained.y - source.y
    }

    const copy = {
      ...source,
      id: undefined,
      pageIndex,
      x: source.x + dx,
      y: source.y + dy,
    }
    if (Array.isArray(source.points)) {
      copy.points = source.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
    }

    const annotation = { ...copy, id: createId(source.type) }
    actions.add(annotation)
    tools.setActiveId(annotation.id)
    return true
  }, [actions, activePageRef, tools, pageSizes])

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

  /**
   * One implementation, two doors.
   *
   * `ref` exposes a subset for compatibility and `viewer` exposes all of it; both are
   * built from this object so the two can never drift into behaving differently.
   */
  const api = useMemo(
    () => ({
      reload,

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

      addTextStamp,
      addImageStamp,
      uploadStamp,
      duplicateSelected: duplicateAnnotation,
      deleteSelected: deleteActive,

      undo: actions.undo,
      redo: actions.redo,

      zoomIn: () => zoom.setScale((s) => s * 1.1),
      zoomOut: () => zoom.setScale((s) => s * 0.9),
      setScale: zoom.setScale,
      setZoomMode: zoom.setZoomMode,

      goToPage: scrollToPage,
      rotatePages,

      setDrawMode: tools.setIsDrawMode,
      setInk: ({ color, thickness, opacity } = {}) => {
        if (color !== undefined) tools.setInkColor(color)
        if (thickness !== undefined) tools.setInkThickness(thickness)
        if (opacity !== undefined) tools.setInkOpacity(opacity)
      },

      toggleThumbnails: () => setShowThumbnails((open) => !open),
    }),
    [
      reload,
      actions,
      sourceBytes,
      stampAssets,
      pageRotations,
      rotateExportedPages,
      addTextStamp,
      addImageStamp,
      uploadStamp,
      duplicateAnnotation,
      deleteActive,
      zoom,
      scrollToPage,
      rotatePages,
      tools,
    ]
  )

  useImperativeHandle(
    viewerRef,
    () => ({
      addTextStamp: api.addTextStamp,
      addImageStamp: api.addImageStamp,
      undo: api.undo,
      redo: api.redo,
      getAnnotations: api.getAnnotations,
      getFlattenedPDF: api.getFlattenedPDF,
    }),
    [api]
  )

  /* -------------------------- controller (usePdfViewer) --------------------- */

  /*
   * A handle always exists, even when the host did not create one.
   *
   * It costs a Set and an object, and it means `renderToolbar` can always be handed a
   * full handle — so a custom toolbar is written the same way whether it is rendered
   * inside the viewer or outside it next to `usePdfViewer()`.
   */
  const ownViewer = usePdfViewer()
  const activeViewer = viewer ?? ownViewer

  // Attaching in an effect, not during render, is what makes calling a handle method
  // before mount a no-op instead of reaching a half-built viewer.
  useEffect(() => activeViewer.__attach(api), [activeViewer, api])

  /** The snapshot the store publishes — and what `renderToolbar` receives as `state`. */
  const viewerState = useMemo(
    () => ({
      status,
      error,
      pageCount,
      activePageIndex,
      scale: zoom.scale,
      zoomMode: zoom.zoomMode,
      hasSpecimen,
      hasAnnotation,
      counts,
      canUndo,
      canRedo,
      isDrawMode: tools.isDrawMode,
      selectedId: tools.activeId,
      showThumbnails,
    }),
    [
      status,
      error,
      pageCount,
      activePageIndex,
      zoom.scale,
      zoom.zoomMode,
      hasSpecimen,
      hasAnnotation,
      counts,
      canUndo,
      canRedo,
      tools.isDrawMode,
      tools.activeId,
      showThumbnails,
    ]
  )

  useEffect(() => {
    activeViewer.__store.setState(viewerState)
  }, [activeViewer, viewerState])

  /* -------------------------------- toolbar --------------------------------- */

  /**
   * Everything a toolbar item can need, in one object.
   *
   * Passing a context rather than props is what let the Toolbar signature drop from 22
   * parameters to two: a new control reads what it needs from here instead of adding
   * another link in the chain.
   */
  /*
   * Two lists, because they are two controls.
   *
   * The stamp menu offers what the host configured; the image menu offers what the user
   * brought in. Merged, the upload entry had to live behind the stamp caret, which meant
   * every viewer showed a dropdown even with a single specimen in it.
   */
  const configuredAssets = useMemo(
    () => stampAssetList.filter((asset) => asset.source !== ASSET_SOURCES.UPLOAD),
    [stampAssetList]
  )
  const uploadedAssets = useMemo(
    () => stampAssetList.filter((asset) => asset.source === ASSET_SOURCES.UPLOAD),
    [stampAssetList]
  )

  const toolbarCtx = useMemo(
    () => ({
      ...viewerState,
      api,
      configuredAssets,
      uploadedAssets,
      onDownload,
      canDownload,
    }),
    [viewerState, api, configuredAssets, uploadedAssets, onDownload, canDownload]
  )

  return (
    <ViewerProvider value={viewerValue}>
      {/* `rpvs-viewer` is the stable, unhashed hook consumers theme through. */}
      <div className={`rpvs-viewer ${styles.shell}`}>
        {renderToolbar
          ? renderToolbar({ viewer: activeViewer, state: viewerState, labels })
          : toolbar !== false && <Toolbar toolbar={toolbar} ctx={toolbarCtx} />}

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
