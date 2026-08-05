import { useCallback, useState } from 'react'

/** Breathing room kept between a popover and the edge it would otherwise touch. */
const EDGE_GAP = 8

/**
 * Flip a popover to the other side of its button when it would run off the edge.
 *
 * Popovers hang from a toolbar button and default to extending rightwards. The tools sit
 * at the right-hand end of the bar, so on a narrow viewer the draw settings panel ran
 * past the edge and was clipped — the colour swatch and the ends of both sliders were
 * simply not there.
 *
 * Measured rather than guessed, so a panel that changes size needs no width constant
 * kept in step. Bounded by `.rpvs-viewer` rather than the window, because that is what
 * clips it: a viewer in a sidebar can have plenty of window to its right and none of
 * its own.
 *
 * The measurement is a **ref callback, not an effect**. It runs when the popover mounts,
 * during commit and before paint, so the flip is never visible — and it keeps the
 * "measure the DOM, then adjust" out of an effect, which React now warns about.
 *
 * @returns {[(element: HTMLElement | null) => void, 'start' | 'end']} ref callback, side
 */
export function usePopoverAlign() {
  const [align, setAlign] = useState('start')

  const measure = useCallback((element) => {
    if (!element) return

    // The positioned ancestor is the button group the popover hangs from; flipping pins
    // the popover's right edge to that element's right edge.
    const anchor = element.offsetParent
    if (!anchor) return

    const container = element.closest('.rpvs-viewer') ?? document.documentElement
    const bounds = container.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    const { width } = element.getBoundingClientRect()

    /*
     * Both candidate positions are derived from the anchor and the popover's width, so
     * the result does not depend on which side it is currently rendered at. Without
     * that, a popover flipped once would measure its flipped self on the next open and
     * never flip back.
     */
    const startOverflows = anchorRect.left + width > bounds.right - EDGE_GAP
    const endFits = anchorRect.right - width >= bounds.left + EDGE_GAP

    setAlign(startOverflows && endFits ? 'end' : 'start')
  }, [])

  return [measure, align]
}

/** Maps the hook's result onto the class names in controls.module.css. */
export const alignClass = (align) => (align === 'end' ? 'alignEnd' : 'alignStart')
