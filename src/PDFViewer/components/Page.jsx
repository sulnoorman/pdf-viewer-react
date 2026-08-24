import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ImageStamp } from './annotations/ImageStamp.jsx'
import { TextStamp } from './annotations/TextStamp.jsx'
import { InkLayer } from './annotations/InkLayer.jsx'
import { ANNOTATION_TYPES } from '../reducers/annotationReducer.js'
import { useViewer } from '../context/ViewerContext.jsx'
import { useTools } from '../context/ToolContext.jsx'
import { useAnnotationActions, usePageAnnotations } from '../context/AnnotationContext.jsx'
import { viewRectToScreen, displayPageSize } from '../utils/coords.js'
import { resolveDropTarget } from '../utils/pageHitTest.js'
import {
  rotatePoint,
  containRect,
  clampRectInto,
  shrinkRectInto,
} from '../utils/transform.js'
import styles from './Page.module.css'

/** How long to coast on a CSS transform before re-rasterising at the new scale. */
const RASTER_DEBOUNCE_MS = 300

export function Page({ pageNumber, registerPage, shouldRender = true }) {
  const pageIndex = pageNumber - 1
  const { pdfDoc, pageSizes, pageRotations, scale, stampAssets } = useViewer()
  const {
    isDrawMode,
    inkColor,
    inkThickness,
    inkOpacity,
    activeId,
    setActiveId,
    cancelStrokeRef,
    isDraggingRef,
  } = useTools()
  const actions = useAnnotationActions()
  const annotations = usePageAnnotations(pageIndex)

  const canvasRef = useRef(null)
  const textLayerRef = useRef(null)
  const annotationLayerRef = useRef(null)
  const containerRef = useRef(null)

  // Rasterising on every zoom tick is far too slow, so the canvas lags behind and a
  // CSS transform bridges the gap. `canvasScale` is what is actually on screen.
  const [debouncedScale, setDebouncedScale] = useState(scale)
  const [canvasScale, setCanvasScale] = useState(scale)

  // Known up front from the document load, so the page reserves the right space
  // before anything has been rasterised.
  const baseSize = pageSizes[pageIndex] ?? { width: 0, height: 0 }
  const pageCount = pageSizes.length

  useEffect(() => {
    if (scale === debouncedScale) return
    const timer = setTimeout(() => setDebouncedScale(scale), RASTER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [scale, debouncedScale])

  useEffect(() => {
    if (!pdfDoc || !shouldRender) return
    let renderTask = null
    let cancelled = false

    const render = async () => {
      const page = await pdfDoc.getPage(pageNumber)
      if (cancelled || !canvasRef.current) return

      const viewport = page.getViewport({ scale: debouncedScale })
      const outputScale = window.devicePixelRatio || 1
      const targetWidth = Math.floor(viewport.width * outputScale)
      const targetHeight = Math.floor(viewport.height * outputScale)

      // Render offscreen and blit, so the visible canvas is never blank mid-render.
      const offscreen = document.createElement('canvas')
      offscreen.width = targetWidth
      offscreen.height = targetHeight

      renderTask = page.render({
        canvasContext: offscreen.getContext('2d', { alpha: false }),
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
        viewport,
      })

      try {
        await renderTask.promise
        if (cancelled || !canvasRef.current) return

        const canvas = canvasRef.current
        canvas.width = targetWidth
        canvas.height = targetHeight
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        canvas.getContext('2d', { alpha: false }).drawImage(offscreen, 0, 0)
        setCanvasScale(debouncedScale)

        const textContent = await page.getTextContent()
        if (cancelled || !textLayerRef.current) return
        textLayerRef.current.innerHTML = ''
        await new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerRef.current,
          viewport,
        }).render()

        const pdfAnnotations = await page.getAnnotations()
        if (cancelled || !annotationLayerRef.current || pdfAnnotations.length === 0) return
        annotationLayerRef.current.innerHTML = ''

        // Links and form widgets are rendered but inert; there is no navigation yet.
        const linkService = {
          getDestinationHash: () => '',
          getAnchorUrl: () => '',
          navigateTo: () => {},
          setDocument: () => {},
          executeNamedAction: () => {},
          cachePageRef: () => {},
          isPageVisible: () => true,
          isPageCached: () => true,
          page: pageNumber,
        }
        const layerViewport = viewport.clone({ dontFlip: true })
        await new pdfjsLib.AnnotationLayer({
          page,
          viewport: layerViewport,
          div: annotationLayerRef.current,
          annotations: pdfAnnotations,
          linkService,
          downloadManager: null,
          renderInteractiveForms: true,
        }).render({
          annotations: pdfAnnotations,
          div: annotationLayerRef.current,
          page,
          viewport: layerViewport,
          linkService,
          renderInteractiveForms: true,
        })
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('[@armsolusi/pdf-viewer] Page render failed:', err)
        }
      }
    }

    render()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pdfDoc, pageNumber, debouncedScale, shouldRender])

  /**
   * A finished move/resize/rotate. TransformBox reports screen pixels; the store holds
   * view space, so this is the single place that divides by scale.
   *
   * It also resolves which page the object ended up over, so an annotation dragged
   * past a page boundary lands on the page it visually belongs to. The whole gesture
   * arrives as one update, hence one undo step — no transaction needed.
   *
   * And it is where the object is brought back inside its page. A gesture is left
   * completely free while the pointer is down — that is what lets a stamp be carried
   * smoothly onto the next page — so the boundary is enforced once, here, on release.
   * `containRect` moves the shortest distance that fits, and returns the rect untouched
   * when it already did, so a drop in open page area does not nudge anything.
   */
  const commitTransform = useCallback(
    (id, rect, rotation, node) => {
      const width = rect.width / scale
      const height = rect.height / scale
      const patch = { rotation, width, height }

      const dropped = node ? resolveDropTarget(node.getBoundingClientRect()) : null

      if (dropped && dropped.pageIndex !== pageIndex) {
        /*
          Landed on a different page, which may be rotated differently from this one.
          The conversion goes through the box CENTRE rather than its top-left: a
          rotated element's bounding rect is its rotated bbox, whose top-left is not
          the box corner — but its centre always is the box centre.
        */
        const nodeRect = node.getBoundingClientRect()
        const targetRotation = pageRotations[dropped.pageIndex] ?? 0
        const targetBase = pageSizes[dropped.pageIndex] ?? { width: 0, height: 0 }

        const fromContainerCentre = {
          x:
            nodeRect.left + nodeRect.width / 2 - (dropped.pageRect.left + dropped.pageRect.width / 2),
          y:
            nodeRect.top + nodeRect.height / 2 - (dropped.pageRect.top + dropped.pageRect.height / 2),
        }

        // The target page's content wrapper is centred in its container and turned by
        // its own rotation, so undoing that rotation lands us in its base view space.
        const inWrapper = rotatePoint(fromContainerCentre, -targetRotation)
        const centre = {
          x: inWrapper.x / scale + targetBase.width / 2,
          y: inWrapper.y / scale + targetBase.height / 2,
        }

        // Bounded by the page it landed on, not the one it came from — those can be
        // different sizes, and a stamp dropped near the edge of a smaller page has to
        // answer to that page's edge.
        const contained = containRect(
          { x: centre.x - width / 2, y: centre.y - height / 2, width, height },
          rotation,
          targetBase
        )

        patch.pageIndex = dropped.pageIndex
        patch.x = contained.x
        patch.y = contained.y
      } else {
        // Same page: the rect is already in this page's base view space, because
        // TransformBox positions inside the rotated wrapper.
        const contained = containRect(
          { x: rect.x / scale, y: rect.y / scale, width, height },
          rotation,
          pageSizes[pageIndex]
        )
        patch.x = contained.x
        patch.y = contained.y
      }

      actions.update(id, patch)
    },
    [actions, scale, pageIndex, pageRotations, pageSizes]
  )

  /**
   * The edges a gesture on this page may not cross, in the same screen pixels
   * `TransformBox` works in — `.rotator` is `baseSize * scale`, so no conversion.
   *
   * Left and right bind on every page: a stamp may never hang off the side, and there is
   * nothing out there to move it to. Top and bottom are `null` in the middle of the
   * document, which is what keeps dragging a stamp onto the next page working; only the
   * very first page has a top and only the very last has a bottom, because those are the
   * edges of the document itself.
   */
  const gestureLimits = useMemo(() => {
    if (!baseSize.width || !baseSize.height) return null
    return {
      left: 0,
      right: baseSize.width * scale,
      top: pageIndex === 0 ? 0 : null,
      bottom: pageIndex === pageCount - 1 ? baseSize.height * scale : null,
    }
  }, [baseSize.width, baseSize.height, scale, pageIndex, pageCount])

  /** Holds a live gesture inside `gestureLimits`. See TransformBox's `constrainDraft`. */
  const constrainDraft = useCallback(
    (rect, rotation, kind, { handle, lockAspectRatio } = {}) => {
      if (!gestureLimits) return rect
      return kind === 'resize'
        ? shrinkRectInto({ rect, rotation, handle, limits: gestureLimits, lockAspectRatio })
        : clampRectInto(rect, rotation, gestureLimits)
    },
    [gestureLimits]
  )

  const editAnnotation = useCallback((id, patch) => actions.update(id, patch), [actions])
  // The page size goes with it, so a copy of a stamp in the corner is nudged back inside
  // rather than offset off the sheet.
  const duplicateAnnotation = useCallback(
    (id) => actions.duplicate(id, undefined, pageSizes[pageIndex]),
    [actions, pageSizes, pageIndex]
  )
  const commitInk = useCallback((annotation) => actions.add(annotation), [actions])

  const removeAnnotation = useCallback(
    (id) => {
      actions.remove(id)
      setActiveId(null)
    },
    [actions, setActiveId]
  )

  const { strokes, objects } = useMemo(
    () => ({
      strokes: annotations.filter((a) => a.type === ANNOTATION_TYPES.INK),
      objects: annotations.filter((a) => a.type !== ANNOTATION_TYPES.INK),
    }),
    [annotations]
  )

  const cssScale = canvasScale > 0 ? scale / canvasScale : 1

  // Extra turn applied by the viewer's rotate buttons, on top of the page's own
  // /Rotate. It affects display only and never reaches the exported file.
  const userRotation = pageRotations[pageIndex] ?? 0
  const displaySize = displayPageSize(baseSize, userRotation)

  /** Set the local ref and hand the element to Document's IntersectionObserver. */
  const attachContainer = useCallback(
    (element) => {
      containerRef.current = element
      registerPage?.(pageIndex, element)
    },
    [registerPage, pageIndex]
  )

  return (
    <div
      ref={attachContainer}
      className={`pdf-page-container ${styles.page}`}
      data-page-index={pageIndex}
      style={{
        width: displaySize.width ? displaySize.width * scale : 'auto',
        height: displaySize.height ? displaySize.height * scale : 'auto',
      }}
      // Every annotation stops mousedown on itself, so anything reaching the page
      // container is a click on empty page area. Matching only the canvas and the
      // container by identity missed clicks landing on the text or annotation layer,
      // which cover the canvas.
      onMouseDown={() => setActiveId(null)}
    >
      {/*
        Outside the render window the container keeps its full size — so the scrollbar
        stays honest and cross-page drag hit-testing still finds this page — but
        nothing is rasterised. Annotations live in the central store, so a page that
        was never scrolled into view still exports correctly.
      */}
      {!shouldRender ? (
        <div className={styles.placeholder}>
          {pageNumber}
        </div>
      ) : (
        /*
          Viewer rotation is applied once, to a wrapper holding the whole page —
          canvas, text layer, PDF annotation layer, ink and stamps alike.

          The alternative was to leave the wrapper upright and remap every annotation
          into rotated coordinates, which would mean a conversion at each of the four
          boundaries the coordinate system already crosses. Rotating the container
          keeps every child in plain base view space: the ink layer's getScreenCTM()
          picks up the CSS rotation for free, and stamps only need to know the frame
          angle so pointer deltas can be un-rotated.

          The wrapper is centred in the container, so a quarter turn lines up exactly.
        */
        <div
          className={styles.rotator}
          style={{
            width: baseSize.width * scale,
            height: baseSize.height * scale,
            left: (displaySize.width * scale - baseSize.width * scale) / 2,
            top: (displaySize.height * scale - baseSize.height * scale) / 2,
            transform: userRotation ? `rotate(${userRotation}deg)` : undefined,
          }}
        >
          <div
            className={styles.raster}
            style={{
              transform: `scale(${cssScale})`,
              width: baseSize.width * canvasScale,
              height: baseSize.height * canvasScale,
            }}
          >
            <canvas ref={canvasRef} className={styles.canvas} />
            <div
              ref={textLayerRef}
              className={`textLayer ${styles.layer}`}
              style={{
                '--scale-factor': canvasScale,
                '--total-scale-factor': canvasScale,
              }}
            />
            <div
              ref={annotationLayerRef}
              className={`annotationLayer ${styles.layer}`}
              style={{
                '--scale-factor': canvasScale,
                '--total-scale-factor': canvasScale,
              }}
            />

            <InkLayer
              pageIndex={pageIndex}
              pageWidth={baseSize.width}
              pageHeight={baseSize.height}
              strokes={strokes}
              isDrawMode={isDrawMode}
              inkColor={inkColor}
              inkThickness={inkThickness}
              inkOpacity={inkOpacity}
              activeId={activeId}
              onSelect={setActiveId}
              onCommit={commitInk}
              onDelete={removeAnnotation}
              cancelStrokeRef={cancelStrokeRef}
            />
          </div>

          {objects.map((annotation) =>
            annotation.type === ANNOTATION_TYPES.TEXT ? (
              <TextStamp
                key={annotation.id}
                annotation={annotation}
                screenRect={viewRectToScreen(annotation, scale)}
                frameRotation={userRotation}
                scale={scale}
                isActive={activeId === annotation.id}
                // A box created empty was just asked for, so focus it and let the
                // user type; one that already has text was probably just clicked.
                autoFocus={activeId === annotation.id && annotation.text === ''}
                onSelect={setActiveId}
                onCommit={commitTransform}
                onEdit={editAnnotation}
                onDuplicate={duplicateAnnotation}
                onDelete={removeAnnotation}
                onGestureStart={actions.beginGesture}
                onGestureEnd={actions.endGesture}
                constrainDraft={constrainDraft}
                isDraggingRef={isDraggingRef}
              />
            ) : (
              <ImageStamp
                key={annotation.id}
                annotation={annotation}
                screenRect={viewRectToScreen(annotation, scale)}
                frameRotation={userRotation}
                src={stampAssets[annotation.assetId]?.src}
                isActive={activeId === annotation.id}
                onSelect={setActiveId}
                onCommit={commitTransform}
                onEdit={editAnnotation}
                onDuplicate={duplicateAnnotation}
                onDelete={removeAnnotation}
                constrainDraft={constrainDraft}
                isDraggingRef={isDraggingRef}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
