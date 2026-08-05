import { describe, it, expect, vi } from 'vitest'
import { renderHook, render, act, screen } from '@testing-library/react'
import { useState } from 'react'
import { usePdfViewer, VIEWER_METHODS } from './usePdfViewer.js'
import { useViewerState } from './useViewerState.js'

describe('usePdfViewer', () => {
  it('keeps the same identity across re-renders', () => {
    /*
     * The property the whole pattern rests on. The handle is passed as a prop to
     * <PDFViewer>; a new object each render would re-render the viewer — and its
     * document — on every keystroke in the host.
     */
    const { result, rerender } = renderHook(() => usePdfViewer())
    const first = result.current
    rerender()
    rerender()
    expect(result.current).toBe(first)
  })

  it('exposes every declared method', () => {
    const { result } = renderHook(() => usePdfViewer())
    for (const name of VIEWER_METHODS) {
      expect(typeof result.current[name]).toBe('function')
    }
  })

  it('makes a method call before mount a no-op instead of a crash', () => {
    // A host wiring up its own toolbar has no reliable moment to know the viewer is
    // ready, so an early click must be harmless.
    const { result } = renderHook(() => usePdfViewer())
    expect(() => result.current.undo()).not.toThrow()
    expect(result.current.getAnnotations()).toBeUndefined()
  })

  it('forwards arguments and the return value once attached', () => {
    const { result } = renderHook(() => usePdfViewer())
    const goToPage = vi.fn(() => 'ok')
    result.current.__attach({ goToPage })

    expect(result.current.goToPage(4)).toBe('ok')
    expect(goToPage).toHaveBeenCalledWith(4)
  })

  it('goes quiet again after the viewer detaches', () => {
    const { result } = renderHook(() => usePdfViewer())
    const undo = vi.fn()
    const detach = result.current.__attach({ undo })

    result.current.undo()
    detach()
    result.current.undo()
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('ignores a stale detach after a second viewer has attached', () => {
    // Under StrictMode the effect runs, cleans up and runs again; the cleanup from
    // the first run must not disconnect the second.
    const { result } = renderHook(() => usePdfViewer())
    const first = { undo: vi.fn() }
    const second = { undo: vi.fn() }

    const detachFirst = result.current.__attach(first)
    result.current.__attach(second)
    detachFirst()

    result.current.undo()
    expect(second.undo).toHaveBeenCalledTimes(1)
  })

  it('tolerates an implementation that is missing a method', () => {
    const { result } = renderHook(() => usePdfViewer())
    result.current.__attach({})
    expect(() => result.current.rotatePages(90)).not.toThrow()
  })
})

describe('useViewerState', () => {
  it('returns the initial state before a viewer has mounted', () => {
    // A host reads hasSpecimen on its first render, which happens before <PDFViewer>
    // has attached anything.
    const { result } = renderHook(() => {
      const viewer = usePdfViewer()
      return useViewerState(viewer)
    })
    expect(result.current.hasSpecimen).toBe(false)
    expect(result.current.status).toBe('idle')
  })

  it('re-renders the host when the selected value changes', () => {
    const { result } = renderHook(() => {
      const viewer = usePdfViewer()
      return { viewer, hasAnnotation: useViewerState(viewer, (s) => s.hasAnnotation) }
    })

    expect(result.current.hasAnnotation).toBe(false)
    act(() => {
      result.current.viewer.__store.setState({ hasAnnotation: true })
    })
    expect(result.current.hasAnnotation).toBe(true)
  })

  it('does not re-render the host when an unselected value changes', () => {
    /*
     * The reason to pass a selector. Without one, a host gating a Submit button would
     * re-render on every tick of `scale` during a pinch.
     */
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      const viewer = usePdfViewer()
      useViewerState(viewer, (s) => s.hasAnnotation)
      return viewer
    })

    const before = renders
    act(() => {
      result.current.__store.setState({ scale: 2.5 })
    })
    expect(renders).toBe(before)
  })

  it('survives an inline selector, which is a new function every render', () => {
    // The ordinary way to call it. A changing getSnapshot must not loop.
    const { result, rerender } = renderHook(() => {
      const viewer = usePdfViewer()
      return useViewerState(viewer, (s) => s.pageCount)
    })
    rerender()
    expect(result.current).toBe(0)
  })

  it('reaches a host component that is a sibling of the viewer', () => {
    /*
     * The end-to-end shape of the feature: state read outside <PDFViewer>, with no
     * onChange callback and no mirrored useState in between.
     */
    function Host() {
      const viewer = usePdfViewer()
      const hasAnnotation = useViewerState(viewer, (s) => s.hasAnnotation)
      const [attached, setAttached] = useState(false)

      if (!attached) {
        // Stands in for <PDFViewer viewer={viewer} /> mounting.
        queueMicrotask(() => setAttached(true))
      }

      return (
        <>
          <button disabled={!hasAnnotation}>Submit</button>
          <button onClick={() => viewer.__store.setState({ hasAnnotation: true })}>mark</button>
        </>
      )
    }

    render(<Host />)
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()

    act(() => {
      screen.getByRole('button', { name: 'mark' }).click()
    })
    expect(submit).not.toBeDisabled()
  })

  it('does not throw when handed no viewer at all', () => {
    const { result } = renderHook(() => useViewerState(null, (s) => s.total))
    expect(result.current).toBeUndefined()
  })
})
