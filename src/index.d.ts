/**
 * Type declarations for react-pdf-viewer-stamping.
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
}

export interface AnnotationCounts {
  image: number
  text: number
  ink: number
  total: number
}

export interface CustomToolbarAction {
  id?: string
  /** Used as the accessible name, and as the button content when no icon is given. */
  label: string
  icon?: ReactNode
  tooltip?: string
  onClick: () => void
}

export interface PDFViewerConfig {
  /**
   * URL of `pdfjs-dist/build/pdf.worker.min.mjs`.
   *
   * Required in practice: the library does not bundle the worker, because how you
   * reference it depends on your bundler, and inlining it would add over a megabyte
   * to the package. See the README for per-bundler snippets.
   */
  workerSrc?: string
  /** A Worker you constructed yourself. Takes precedence over `workerSrc`. */
  workerPort?: Worker

  /** Single stamp image. Registered as the asset `default`. */
  specimenAsset?: string
  /** Several stamp images, as a map or a list. */
  stampAssets?: Record<string, string | StampAsset> | StampAsset[]
  /** Whether the user may add their own image from disk. Defaults to true. */
  allowStampUpload?: boolean
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

  /** Fired whenever the annotation counts change. */
  onAnnotationsChange?: (counts: AnnotationCounts) => void
  /** Legacy: fired with whether at least one IMAGE stamp exists. */
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

  customToolbarActions?: CustomToolbarAction[]
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
  config?: PDFViewerConfig
  ref?: Ref<PDFViewerHandle>
}

export declare const PDFViewer: ComponentType<PDFViewerProps>
