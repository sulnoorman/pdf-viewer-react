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
 * @param {DOMRect} rect the dragged element's screen box
 * @param {Document|HTMLElement} [root] search scope, for tests
 * @returns {{pageIndex: number, pageRect: DOMRect}|null} null when dropped off all pages
 */
export function resolveDropTarget(rect, root = document) {
  const pages = Array.from(root.querySelectorAll('.pdf-page-container'))

  let best = null
  let bestArea = 0

  for (const page of pages) {
    const pageRect = page.getBoundingClientRect()
    const area = overlapArea(rect, pageRect)
    if (area > bestArea) {
      bestArea = area
      best = { pageIndex: Number.parseInt(page.dataset.pageIndex, 10), pageRect }
    }
  }

  return best
}
