/**
 * Type declarations for @armsolusi/pdf-viewer.
 *
 * Hand-written rather than generated: the library is authored in JSX, and a generator
 * would produce `any` for most of the config surface — which is precisely the part a
 * consumer needs help with.
 */

import type { ComponentType, ReactNode, Ref } from 'react'

/* ------------------------------------------------------------------ *
 * Annotations
 * ------------------------------------------------------------------ */

export declare const ANNOTATION_TYPES: {
  readonly IMAGE: 'image'
  readonly TEXT: 'text'
  readonly INK: 'ink'
}

export type AnnotationType = 'image' | 'text' | 'ink'

/** A point in view space: PDF points, top-left origin, y down, no zoom applied. */
export interface Point {
  x: number
  y: number
}

interface AnnotationBase {
  id: string
  type: AnnotationType
  /** Zero-based page the annotation belongs to. */
  pageIndex: number
  /** View-space position of the unrotated box, in PDF points. */
  x: number
  y: number
  width: number
  height: number
  /** Degrees clockwise, about the box centre. */
  rotation: number
  /** 0..1 */
  opacity: number
}

export interface ImageAnnotation extends AnnotationBase {
  type: 'image'
  /** Key into the stamp asset registry. */
  assetId: string
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text'
  text: string
  fontSize: number
  /** Hex colour, e.g. '#1a2b3c'. */
  color: string
  /** One of the supported families; anything else falls back to Helvetica. */
  fontFamily: string
}

export interface InkAnnotation extends AnnotationBase {
  type: 'ink'
  /** Stroke points in view space. x/y/width/height are the derived bounding box. */
  points: Point[]
  color: string
  strokeWidth: number
}

export type Annotation = ImageAnnotation | TextAnnotation | InkAnnotation

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

export declare const DEFAULT_LABELS: Readonly<Record<string, string>>

/**
 * Every user-visible string. Supply only the keys you want to change; the rest fall
 * back to English. `goToPage` accepts a `{page}` placeholder.
 */
export interface ViewerLabels {
  toggleThumbnails?: string
  thumbnailSidebar?: string
  previousPage?: string
  nextPage?: string
  pageNumber?: string
  goToPage?: string
  zoomIn?: string
  zoomOut?: string
  zoomLevel?: string
  zoomAutomatic?: string
  zoomActualSize?: string
  zoomPageFit?: string
  zoomPageWidth?: string
  rotateLeft?: string
  rotateRight?: string
  undo?: string
  redo?: string
  draw?: string
  drawSettings?: string
  colour?: string
  thickness?: string
  opacity?: string
  strokeThickness?: string
  strokeOpacity?: string
  addStamp?: string
  chooseStamp?: string
  uploadImage?: string
  noStampConfigured?: string
  addText?: string
  textPlaceholder?: string
  fontSize?: string
  font?: string
  textColour?: string
  duplicate?: string
  delete?: string
  download?: string
  loading?: string
  loadFailed?: string
  retry?: string
  noDocument?: string
}

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */

/** An image available as a stamp. */
export interface StampAsset {
  id: string
  /** Shown in the stamp menu; defaults to the id. */
  label?: string
  src: string
  /**
   * What the image means. Defaults to `'stamp'`.
   *
   * Only `'specimen'` assets make `hasSpecimen` true, so mark your signature images
   * here if you register several of them instead of using `specimenAsset`.
   */
  kind?: 'specimen' | 'stamp'
}

export interface AnnotationCounts {
  /** Image stamps placed from an asset registered as a specimen. */
  specimen: number
  /** Image stamps from any other asset, including images the user uploaded. */
  stamp: number
  /** `specimen + stamp`. */
  image: number
  text: number
  ink: number
  total: number
}

/* ------------------------------------------------------------------ *
 * Toolbar
 * ------------------------------------------------------------------ */

/**
 * The configurable toolbar controls — the right-hand action row.
 *
 * `history` is a cluster; `undo` and `redo` place its halves individually. `divider` and
 * `spacer` may repeat.
 *
 * The navigation controls (`thumbnails`, `pageNav`, `zoom`, `rotate`) are deliberately
 * absent: they are always rendered and `displayActions` cannot place them.
 */
export type ToolbarActionId =
  | 'history'
  | 'undo'
  | 'redo'
  | 'draw'
  | 'addText'
  | 'stamp'
  | 'image'
  | 'download'
  | 'divider'
  | 'spacer'

/** The shipped order of the action row, for filtering rather than rewriting. */
export declare const DEFAULT_TOOLBAR_ACTIONS: readonly ToolbarActionId[]

export interface CustomToolbarAction {
  /** Required to reference the action from `displayActions`. */
  id: string
  /** Used as the accessible name, and as the button content when no icon is given. */
  label: string
  icon?: ReactNode
  tooltip?: string
  disabled?: boolean
  /** Renders the button in its pressed state. */
  active?: boolean
  onClick: () => void
}

export interface ToolbarConfig {
  /**
   * Which actions appear in the right-hand row, and in what order.
   *
   * This configures **that row only**. The navigation controls — thumbnails, page
   * navigation, zoom and page rotation — are always rendered as shipped, because they
   * are how a user reads the document rather than acts on it. Use `renderToolbar` to
   * rearrange the whole bar.
   *
   * Omit it (or pass an empty array) and every action appears in its shipped order,
   * with each custom action after it. Provide one and **only** the ids named appear —
   * including custom actions, and including `download` even when `onDownload` is set.
   *
   * To hide one action, filter the exported default rather than writing the list by
   * hand, so a later version's new actions still reach your users:
   * `DEFAULT_TOOLBAR_ACTIONS.filter((id) => id !== 'addText')`
   */
  displayActions?: (ToolbarActionId | (string & {}))[]
  /**
   * Your own buttons, in the right-hand row. Reusing a built-in action id replaces that
   * control, which is how to swap Download for an Upload button of your own.
   */
  customToolbarActions?: CustomToolbarAction[]
}

export interface PDFViewerConfig {
  /**
   * Override the pdf.js worker URL.
   *
   * Optional: the package ships its own worker and your bundler emits it automatically,
   * so there is normally nothing to set. Pass this to use a copy you serve yourself.
   */
  workerSrc?: string
  /** A Worker you constructed yourself. Takes precedence over `workerSrc`. */
  workerPort?: Worker

  /**
   * Where pdf.js fetches its image decoders, as a directory URL.
   *
   * Optional: the package ships them and wires this up, so there is normally nothing to
   * set. Pass it to serve your own copies of `jbig2.wasm`, `openjpeg.wasm` and
   * `qcms_bg.wasm` — from a CDN, say.
   *
   * These decode CCITT, JBIG2 and JPEG 2000, which is to say scanner output. Point this
   * somewhere that does not have them and images do not go missing, they turn into solid
   * black rectangles: a stencil mask that cannot be decoded gets painted in full.
   *
   * A trailing slash is added if you leave it off.
   */
  wasmUrl?: string
  /**
   * Where pdf.js fetches the standard font data, as a directory URL.
   *
   * Optional, and shipped with the package like `wasmUrl`. Only documents that reference
   * one of the 14 standard fonts without embedding it fetch anything from here; without
   * it their metrics are substituted and the layout shifts.
   */
  standardFontDataUrl?: string

  /**
   * How many documents to keep parsed in memory. Defaults to 3; `0` switches it off.
   *
   * Only matters when one viewer shows several documents in turn — see `documentId`.
   * Returning to a document already visited is then instant: no re-fetch, no re-parse, no
   * loading state, and the scroll position comes back with it.
   *
   * The cost is memory, and only part of it is predictable. Each cached document holds the
   * file's pristine bytes — `documentCacheSize × file size`, a figure you can compute —
   * plus pdf.js's own structures on top, which depend on the document's content rather than
   * its byte count: a scanned document full of large images costs far more than a text one
   * of the same size. Measure with real files rather than trusting an estimate, and lower
   * this if your documents are large.
   */
  documentCacheSize?: number

  /**
   * The signature image, registered under the reserved asset id `'specimen'`.
   *
   * This is what `hasSpecimen` counts. A seal from `stampAssets` or an image the user
   * uploaded is an image annotation just the same, but neither satisfies it.
   */
  specimenAsset?: string
  /**
   * Several stamp images, as a map or a list. These are what the `stamp` control offers;
   * images the user adds themselves live behind the separate `image` control, which you
   * remove by dropping `'image'` from `toolbar.displayActions`.
   */
  stampAssets?: Record<string, string | StampAsset> | StampAsset[]
  /** Cap on image stamps; `false` allows exactly one. Defaults to true. */
  allowMultipleStamps?: boolean
  /** Maximum image stamps when `allowMultipleStamps` is true. */
  maxStamps?: number | null

  /** Override any user-visible string. */
  labels?: ViewerLabels

  /**
   * Whether rotating a page in the viewer also rotates it in the exported file.
   * Defaults to true, which suits a signing tool: someone who turns a sideways scan
   * to sign it expects the recipient to receive it the right way up.
   */
  rotateExportedPages?: boolean

  /**
   * Fired when the counts change — by value, so moving an existing stamp does not
   * fire it. Also fires once on mount.
   *
   * Prefer `usePdfViewer` + `useViewerState`, which need no mirrored state in your
   * component and give you `hasSpecimen` and `hasAnnotation` separately.
   */
  onAnnotationsChange?: (counts: AnnotationCounts) => void

  /**
   * Every annotation, whenever any of them changes. This is the door for saving a draft.
   *
   * Distinct from `onAnnotationsChange`, which reports counts and does not fire when a
   * stamp merely moves — a move changes nothing to count but everything to save. Store
   * what arrives here keyed by `documentId` and hand it back through
   * `initialAnnotations` when the user returns to that document.
   *
   * The array is JSON-safe, so it can go straight to `localStorage` or an API. One
   * caveat: an image annotation records only its `assetId`, so it renders again only if
   * that asset is in `stampAssets` (or is `specimenAsset`) next time. Images the user
   * uploaded into the viewer live only in that viewer's memory and do not survive a
   * reload — persist those as a data URL under a stable id if drafts must keep them.
   */
  onAnnotationsSnapshot?: (
    annotations: Annotation[],
    context: { documentId: string | number | undefined }
  ) => void

  /**
   * Annotations to start this document with — what `getAnnotations()` returned earlier,
   * handed straight back.
   *
   * Read only when `documentId` changes, like `defaultValue` on an input rather than a
   * controlled prop. That is deliberate: hosts store what `onAnnotationsSnapshot` reports
   * and so change this on every edit, and reacting to that would never settle. To load
   * annotations at any other moment, call `viewer.setAnnotations()`.
   */
  initialAnnotations?: Annotation[]

  /** Fired when `hasSpecimen` changes. See `useViewerState` for the modern form. */
  onSpecimenChange?: (hasSpecimen: boolean) => void
  /** Called when the document fails to load. */
  onLoadError?: (error: Error) => void

  /**
   * Renders the Download button when provided. The library does not save the file
   * itself — call `getFlattenedPDF()` from here and do what you like with the Blob.
   */
  onDownload?: () => void
  /** Disables the Download button. Defaults to true. */
  canDownload?: boolean

  /** Which actions the toolbar shows, or `false` to drop the bar entirely. */
  toolbar?: ToolbarConfig | false
  /**
   * Replace the toolbar wholesale. `viewer` is a full handle — the same shape
   * `usePdfViewer()` returns — so the same component works inside or outside the viewer.
   */
  renderToolbar?: (context: {
    viewer: PdfViewerHandle
    state: ViewerState
    labels: Required<ViewerLabels>
  }) => ReactNode
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

/** Anything the bytes of a PDF can arrive as. */
export type PdfSource = string | ArrayBuffer | Uint8Array | Blob | File

export interface PDFViewerHandle {
  /** Add a text box on the page currently in view. Returns its id. */
  addTextStamp(options?: {
    text?: string
    fontSize?: number
    color?: string
    fontFamily?: string
  }): string
  /** Place a stamp image. Defaults to the first registered asset. */
  addImageStamp(assetId?: string): Promise<string | null>
  undo(): void
  redo(): void
  /** Current annotations, in paint order. */
  getAnnotations(): Annotation[]
  /** Replace every annotation. Clears undo history. */
  setAnnotations(annotations: Annotation[]): void
  /**
   * Flatten every annotation into a copy of the source PDF.
   *
   * Annotations become page content rather than PDF annotation objects, so they
   * cannot be moved or removed in a downstream reader. Original text stays
   * selectable and vector art stays vector.
   */
  getFlattenedPDF(): Promise<Blob>
}

export interface PDFViewerProps {
  src: PdfSource
  /**
   * Which document the annotations belong to.
   *
   * Pass it when one mounted viewer shows several documents in turn — a tab per attachment,
   * say. Changing it empties the annotation store and re-seeds it from
   * `config.initialAnnotations`, so annotations cannot follow the user from one document to
   * the next. Leave it out and nothing changes: a viewer showing one document needs it no
   * more than it ever did.
   *
   * Keep it stable for as long as the document is open. Going from `undefined` to an id is
   * treated as "the id is now known" and keeps whatever has been drawn, so a value arriving
   * from a fetch does not discard work.
   */
  documentId?: string | number
  config?: PDFViewerConfig
  /** Handle from `usePdfViewer()`. The recommended way to read state and drive it. */
  viewer?: PdfViewerHandle
  /** The older, smaller door onto the same API. */
  ref?: Ref<PDFViewerHandle>
}

export declare const PDFViewer: ComponentType<PDFViewerProps>

/* ------------------------------------------------------------------ *
 * Controller
 * ------------------------------------------------------------------ */

export type ViewerStatus = 'idle' | 'loading' | 'ready' | 'error'
export type ZoomMode = 'auto' | 'actual-size' | 'page-fit' | 'page-width' | 'custom'

/** Everything readable through `useViewerState`. */
export interface ViewerState {
  status: ViewerStatus
  error: Error | null
  pageCount: number
  activePageIndex: number
  scale: number
  zoomMode: ZoomMode
  /**
   * At least one stamp from a specimen asset — i.e. from `config.specimenAsset` or an
   * asset marked `kind: 'specimen'`. A seal or an uploaded image does not count.
   */
  hasSpecimen: boolean
  /** At least one mark the user made: ink or text. Image stamps do not count. */
  hasAnnotation: boolean
  counts: AnnotationCounts
  canUndo: boolean
  canRedo: boolean
  isDrawMode: boolean
  selectedId: string | null
  showThumbnails: boolean
}

/**
 * A stable handle onto a viewer.
 *
 * Every method is safe to call before the viewer has mounted — it is a no-op returning
 * `undefined` rather than a crash, so wiring up a toolbar needs no readiness check.
 */
export interface PdfViewerHandle {
  /** Current state. Prefer `useViewerState`, which re-renders when it changes. */
  getState(): ViewerState
  subscribe(listener: () => void): () => void

  /** Retry loading the document. */
  reload(): void

  getFlattenedPDF(): Promise<Blob>
  getAnnotations(): Annotation[]
  /**
   * Replace every annotation — restoring a draft that arrived after the viewer mounted,
   * which `config.initialAnnotations` cannot do because it is read only on a document
   * change. Clears undo history, so one Ctrl+Z cannot discard what was just loaded.
   */
  setAnnotations(annotations: Annotation[]): void

  addTextStamp(options?: {
    text?: string
    fontSize?: number
    color?: string
    fontFamily?: string
  }): string
  /** Place a stamp image. Defaults to the specimen, then the first registered asset. */
  addImageStamp(assetId?: string): Promise<string | null>
  /** Register an image from disk and place it immediately. */
  uploadStamp(file: File): Promise<void>
  duplicateSelected(id?: string): boolean
  deleteSelected(): boolean

  undo(): void
  redo(): void

  zoomIn(): void
  zoomOut(): void
  setScale(scale: number | ((current: number) => number)): void
  setZoomMode(mode: ZoomMode): void

  goToPage(pageIndex: number): void
  /** Turn the current page, or every page, by a multiple of 90°. */
  rotatePages(delta: number, scope?: 'page' | 'all'): void

  setDrawMode(enabled: boolean): void
  setInk(settings: { color?: string; thickness?: number; opacity?: number }): void

  toggleThumbnails(): void
}

/**
 * Create a viewer handle, then pass it as `<PDFViewer viewer={...} />`.
 *
 * The identity never changes, so it will not re-render the viewer and is safe in a
 * dependency array.
 */
export declare function usePdfViewer(): PdfViewerHandle

/**
 * Read viewer state from anywhere in the host — no onChange callback, no mirrored
 * `useState`.
 *
 * Pass a selector to re-render only when the value you actually read changes, and
 * return a primitive or a stable reference from it: a selector that builds a fresh
 * object is never equal to the last, so it re-renders on every change.
 */
export declare function useViewerState(viewer: PdfViewerHandle | null): ViewerState
export declare function useViewerState<T>(
  viewer: PdfViewerHandle | null,
  selector: (state: ViewerState) => T
): T

/* ------------------------------------------------------------------ *
 * Export without a viewer
 * ------------------------------------------------------------------ */

export interface FlattenPdfOptions {
  /** Whatever you would pass to `<PDFViewer src>`. */
  src: PdfSource
  /** As returned by `getAnnotations()`. Omitted or empty gives back the source unchanged. */
  annotations?: Annotation[]
  /**
   * The same registry the component takes. An image annotation records only its `assetId`,
   * so its asset has to be here for the image to appear — one that is missing is skipped
   * rather than failing the export.
   *
   * An entry is identified by its `src`, which may be a data URL.
   */
  stampAssets?: Record<string, string | StampAsset> | StampAsset[]
  /** As passed to `config.specimenAsset`. */
  specimenAsset?: string
  /** Extra rotation per page index, as the viewer's rotate buttons would apply. */
  pageRotations?: Record<number, number>
  /** Defaults to true, matching the component. */
  rotateExportedPages?: boolean
}

/**
 * Flatten annotations into a PDF without a mounted viewer.
 *
 * `viewer.getFlattenedPDF()` can only export the document on screen, which is the wrong
 * shape for a host holding several — a review workflow with a tab per attachment, where
 * Submit has to produce every file with its own annotations. This is the same export
 * pipeline with the component left out, so that becomes a loop:
 *
 * ```ts
 * const files = await Promise.all(
 *   attachments.map(async (file) => ({
 *     id: file.id,
 *     blob: await flattenPdf({ src: file.url, annotations: draft[file.id] ?? [], stampAssets }),
 *   }))
 * )
 * ```
 *
 * Attachments the reviewer never opened come through too, with no annotations.
 */
export declare function flattenPdf(options: FlattenPdfOptions): Promise<Blob>
