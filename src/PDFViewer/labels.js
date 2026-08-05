/**
 * Every user-visible string in the viewer.
 *
 * Two reasons this exists as one object rather than literals in the components:
 *
 * 1. **Localisation without forking.** A host that needs Indonesian labels can pass
 *    `config.labels` instead of editing library source — which would otherwise mean
 *    maintaining a fork that breaks on every upgrade.
 * 2. **Consistency.** The strings had drifted: some tooltips were still Indonesian
 *    from an earlier iteration while the rest were English, and the same action was
 *    worded differently in two places.
 *
 * Defaults are English. Overrides are merged shallowly, so a host supplies only the
 * keys it cares about:
 *
 *   config={{ labels: { addStamp: 'Tambah Stempel', download: 'Unduh' } }}
 *
 * This is deliberately not full i18n — no locale detection, no pluralisation. Those
 * can be layered on later without breaking this, because a richer system would still
 * produce the same flat map of resolved strings.
 */

export const DEFAULT_LABELS = Object.freeze({
  /* Navigation */
  toggleThumbnails: 'Toggle page thumbnails',
  thumbnailSidebar: 'Page thumbnails',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  pageNumber: 'Page number',
  goToPage: 'Go to page {page}',

  /* Zoom */
  zoomIn: 'Zoom in (Ctrl +)',
  zoomOut: 'Zoom out (Ctrl -)',
  zoomLevel: 'Zoom level',
  zoomAutomatic: 'Automatic Zoom',
  zoomActualSize: 'Actual Size',
  zoomPageFit: 'Page Fit',
  zoomPageWidth: 'Page Width',

  /* Page rotation */
  rotateLeft: 'Rotate left (hold Shift for every page)',
  rotateRight: 'Rotate right (hold Shift for every page)',

  /* History */
  undo: 'Undo (Ctrl+Z)',
  redo: 'Redo (Ctrl+Y)',

  /* Drawing */
  draw: 'Freehand draw',
  drawSettings: 'Drawing settings',
  colour: 'Colour',
  thickness: 'Thickness',
  opacity: 'Opacity',
  strokeThickness: 'Stroke thickness',
  strokeOpacity: 'Stroke opacity',

  /* Stamps and text */
  addStamp: 'Add stamp',
  chooseStamp: 'Choose stamp image',
  noStampConfigured: 'No stamp image configured',
  addImage: 'Add your own image',
  chooseImage: 'Choose an image you added',
  uploadImage: 'Upload another image…',
  addText: 'Add a text box',
  textPlaceholder: 'Type here…',
  fontSize: 'Font size',
  font: 'Font',
  textColour: 'Text colour',

  /* Annotation actions */
  duplicate: 'Duplicate (Ctrl+D)',
  delete: 'Delete (Del)',

  /* Document state */
  download: 'Download',
  loading: 'Loading document…',
  loadFailed: 'This document could not be opened.',
  retry: 'Try again',
  noDocument: 'No document loaded.',
})

/**
 * Merge host overrides over the defaults.
 *
 * Unknown keys are dropped rather than passed through: a typo like `donwload` should
 * not silently add a string nothing reads, leaving the real button in English with no
 * clue why.
 *
 * @param {Record<string, string>} [overrides]
 * @returns {Record<string, string>}
 */
export function mergeLabels(overrides) {
  if (!overrides || typeof overrides !== 'object') return DEFAULT_LABELS

  const merged = { ...DEFAULT_LABELS }
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'string' && key in DEFAULT_LABELS) merged[key] = value
  }
  return merged
}

/**
 * Fill `{placeholder}` slots in a label.
 *
 * Placeholders rather than callbacks keep the label map plain data, so it can come
 * from a JSON translation file unchanged.
 *
 * @param {string} template
 * @param {Record<string, string|number>} values
 */
export function formatLabel(template, values) {
  if (typeof template !== 'string') return ''
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match
  )
}
