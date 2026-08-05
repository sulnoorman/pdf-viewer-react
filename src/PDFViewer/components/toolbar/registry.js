import {
  ThumbnailsToggle,
  PageNav,
  ZoomCluster,
  ZoomOutButton,
  ZoomSelect,
  ZoomInButton,
  RotateCluster,
  RotateLeftButton,
  RotateRightButton,
  HistoryCluster,
  UndoButton,
  RedoButton,
  DrawTool,
  AddTextButton,
  StampItem,
  DownloadButton,
} from './items.jsx'

/**
 * id -> { zone, Component }.
 *
 * `zone` records where a control lives. Only the `right` zone is configurable; see
 * `DEFAULT_TOOLBAR_ACTIONS` below.
 *
 * Cluster ids (`history`) sit alongside the individual controls they contain, so a host
 * that wants only Undo can say so without needing a new concept.
 *
 * Separate from items.jsx because a module exporting both components and plain values
 * loses React Fast Refresh.
 */
export const TOOLBAR_REGISTRY = Object.freeze({
  thumbnails: { zone: 'left', Component: ThumbnailsToggle },
  pageNav: { zone: 'left', Component: PageNav },

  zoom: { zone: 'center', Component: ZoomCluster },
  zoomOut: { zone: 'center', Component: ZoomOutButton },
  zoomSelect: { zone: 'center', Component: ZoomSelect },
  zoomIn: { zone: 'center', Component: ZoomInButton },
  rotate: { zone: 'center', Component: RotateCluster },
  rotateLeft: { zone: 'center', Component: RotateLeftButton },
  rotateRight: { zone: 'center', Component: RotateRightButton },

  history: { zone: 'right', Component: HistoryCluster },
  undo: { zone: 'right', Component: UndoButton },
  redo: { zone: 'right', Component: RedoButton },
  draw: { zone: 'right', Component: DrawTool },
  addText: { zone: 'right', Component: AddTextButton },
  stamp: { zone: 'right', Component: StampItem },
  download: { zone: 'right', Component: DownloadButton },
})

/*
 * Reading and navigating the document is not a host decision.
 *
 * The thumbnail toggle, page navigation, zoom and page rotation are how a user gets
 * around a PDF at all; a toolbar config that could remove them would leave a viewer
 * nobody can read. They are always present, in this order, and `displayActions` does
 * not reach them. A host that truly needs to rearrange them replaces the whole bar
 * with `config.renderToolbar`, or drops it with `toolbar: false`.
 */
export const FIXED_LEFT_ACTIONS = Object.freeze(['thumbnails', 'pageNav'])
export const FIXED_CENTER_ACTIONS = Object.freeze(['zoom', 'rotate'])

/**
 * The configurable part of the bar — the right-hand action row — as shipped, in order.
 *
 * Exported from the package so hiding one control does not mean writing the list out
 * by hand: `DEFAULT_TOOLBAR_ACTIONS.filter((id) => id !== 'addText')` keeps you in step
 * with controls added in later versions, which a hand-written list would not.
 */
export const DEFAULT_TOOLBAR_ACTIONS = Object.freeze([
  'history',
  'divider',
  'draw',
  'addText',
  'stamp',
  'download',
])
