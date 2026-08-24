import { overlapArea } from './coords.js'

/**
 * Which page an annotation was dropped on.
 *
 * This logic existed twice, copied verbatim between Stamp.jsx and TextStamp.jsx — and
 * the copy inside TextStamp was unreachable, because that component also set
 * `bounds="parent"`. The result was an inconsistency nobody intended: an image stamp
 * could be dragged onto another page, an identical-looking text box could not.
 *
 * Resolution rule: the page overlapping the dragged box the most wins. Comparing
 * overlap area rather than, say, the pointer position means a stamp straddling a page
 * boundary lands where it visually belongs.
 *
 * When the box overlaps nothing at all — dropped in the gutter between two pages, or out
 * in the empty margin beside them when zoomed out — the nearest page by centre distance
 * wins. Returning null there used to leave the caller keeping the annotation on the page
 * it started from, which is wrong the moment a drag has travelled past a page: the stamp
 * jumped back several pages. Every drop now names a page, so `containRect` always has
 * bounds to work with and an annotation can never be left outside the document.
 *
 * @param {DOMRect} rect the dragged element's screen box
 * @param {Document|HTMLElement} [root] search scope, for tests
 * @returns {{pageIndex: number, pageRect: DOMRect}|null} null only when no page is rendered
 */
export function resolveDropTarget(rect, root = document) {
  const pages = Array.from(root.querySelectorAll('.pdf-page-container'))

  let best = null
  let bestArea = 0
  let nearest = null
  let nearestDistance = Infinity

  const centre = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 }

  for (const page of pages) {
    const pageRect = page.getBoundingClientRect()
    const pageIndex = Number.parseInt(page.dataset.pageIndex, 10)
    const area = overlapArea(rect, pageRect)

    if (area > bestArea) {
      bestArea = area
      best = { pageIndex, pageRect }
    }

    // Squared distance: the comparison is all that matters, so skip the square root.
    const dx = centre.x - (pageRect.left + pageRect.right) / 2
    const dy = centre.y - (pageRect.top + pageRect.bottom) / 2
    const distance = dx * dx + dy * dy
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = { pageIndex, pageRect }
    }
  }

  // Overlap first, always: that is the rule that puts a box straddling two pages on the
  // one it mostly covers. Distance only settles the case where there is no overlap to
  // compare, where it would otherwise be a coin toss.
  return best ?? nearest
}
