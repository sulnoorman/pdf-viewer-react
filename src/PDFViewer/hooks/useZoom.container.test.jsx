import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useZoom } from './useZoom.js'

/**
 * Regression guard for a bug that only appeared once the viewer gained a loading
 * state.
 *
 * The scroll container is not in the DOM until the document is ready — before that
 * the viewer renders a skeleton and <Document> is unmounted. When the container came
 * in through a plain ref, the wheel listener saw `null` on first render and never
 * retried, because mutating a ref does not re-run an effect. Trackpad pinch, which
 * browsers report as ctrl+wheel, then fell straight through to the browser's own zoom
 * instead of zooming the document.
 *
 * The fix is to pass the element as state so the effect re-runs when it appears; these
 * tests fail if that ever regresses to a ref-only dependency.
 */
function makeContainer() {
  const element = document.createElement('div')
  element.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
  })
  Object.defineProperty(element, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(element, 'clientHeight', { value: 600, configurable: true })
  return element
}

function wheelEvent({ ctrlKey = true, deltaY = -100 } = {}) {
  const event = new Event('wheel', { bubbles: true, cancelable: true })
  Object.assign(event, { ctrlKey, metaKey: false, deltaY, deltaMode: 0, clientX: 400, clientY: 300 })
  return event
}

const PAGE_SIZES = [{ width: 595, height: 842 }]

describe('useZoom container binding', () => {
  let container
  let containerRef

  beforeEach(() => {
    container = makeContainer()
    containerRef = { current: null }
  })

  it('binds the wheel listener once the container appears after mount', () => {
    const addSpy = vi.spyOn(container, 'addEventListener')

    // First render: the document is still loading, so there is no container yet.
    const view = renderHook(
      ({ el }) => useZoom({ pageSizes: PAGE_SIZES, container: el, containerRef }),
      { initialProps: { el: null } }
    )
    expect(addSpy).not.toHaveBeenCalled()

    // Document becomes ready and <Document> mounts.
    containerRef.current = container
    view.rerender({ el: container })

    expect(addSpy).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false })
  })

  it('zooms the document on ctrl+wheel instead of letting the browser zoom', () => {
    containerRef.current = container
    const view = renderHook(
      ({ el }) => useZoom({ pageSizes: PAGE_SIZES, container: el, containerRef }),
      { initialProps: { el: container } }
    )

    const before = view.result.current.scale
    const event = wheelEvent({ deltaY: -100 })

    act(() => {
      container.dispatchEvent(event)
    })

    // preventDefault is what stops the browser applying its own page zoom.
    expect(event.defaultPrevented).toBe(true)
    expect(view.result.current.scale).toBeGreaterThan(before)
  })

  it('leaves a plain wheel alone so normal scrolling still works', () => {
    containerRef.current = container
    const view = renderHook(
      ({ el }) => useZoom({ pageSizes: PAGE_SIZES, container: el, containerRef }),
      { initialProps: { el: container } }
    )

    const before = view.result.current.scale
    const event = wheelEvent({ ctrlKey: false, deltaY: -100 })

    act(() => {
      container.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(false)
    expect(view.result.current.scale).toBe(before)
  })

  it('zooms out for a positive delta', () => {
    containerRef.current = container
    const view = renderHook(
      ({ el }) => useZoom({ pageSizes: PAGE_SIZES, container: el, containerRef }),
      { initialProps: { el: container } }
    )

    const before = view.result.current.scale
    act(() => {
      container.dispatchEvent(wheelEvent({ deltaY: 100 }))
    })
    expect(view.result.current.scale).toBeLessThan(before)
  })

  it('unbinds when the container goes away', () => {
    const removeSpy = vi.spyOn(container, 'removeEventListener')
    containerRef.current = container

    const view = renderHook(
      ({ el }) => useZoom({ pageSizes: PAGE_SIZES, container: el, containerRef }),
      { initialProps: { el: container } }
    )

    view.rerender({ el: null })
    expect(removeSpy).toHaveBeenCalledWith('wheel', expect.any(Function))
  })
})
