import { describe, it, expect, vi } from 'vitest'
import { createViewerStore, INITIAL_VIEWER_STATE } from './createViewerStore.js'

describe('createViewerStore', () => {
  it('starts from the shared initial state', () => {
    expect(createViewerStore().getState()).toBe(INITIAL_VIEWER_STATE)
  })

  it('merges a patch and notifies subscribers', () => {
    const store = createViewerStore()
    const listener = vi.fn()
    store.subscribe(listener)

    expect(store.setState({ pageCount: 3 })).toBe(true)
    expect(store.getState().pageCount).toBe(3)
    // Untouched keys survive the merge.
    expect(store.getState().status).toBe('idle')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('replaces state rather than mutating it, so snapshots stay comparable', () => {
    // useSyncExternalStore compares snapshots by identity; mutating in place would
    // make every read look unchanged.
    const store = createViewerStore()
    const before = store.getState()
    store.setState({ pageCount: 1 })
    expect(store.getState()).not.toBe(before)
    expect(before.pageCount).toBe(0)
  })

  it('stays silent when every value in the patch is unchanged', () => {
    const store = createViewerStore()
    const listener = vi.fn()
    store.subscribe(listener)

    expect(store.setState({ status: 'idle', pageCount: 0 })).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('stays silent for an equal counts object built fresh', () => {
    /*
     * The reason the comparison looks inside plain objects. `counts` is rebuilt on
     * every annotation edit, so a by-reference check would notify every subscriber
     * each time a stamp moved a pixel — which is the cost the controller exists to
     * avoid.
     */
    const store = createViewerStore()
    store.setState({ counts: { image: 1, total: 1 } })

    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.setState({ counts: { image: 1, total: 1 } })).toBe(false)
    expect(listener).not.toHaveBeenCalled()

    expect(store.setState({ counts: { image: 2, total: 2 } })).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('notifies once for a patch that changes several keys', () => {
    const store = createViewerStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.setState({ status: 'ready', pageCount: 3, scale: 1.5 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops notifying after unsubscribe', () => {
    const store = createViewerStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.setState({ pageCount: 1 })
    unsubscribe()
    store.setState({ pageCount: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('survives a listener that unsubscribes while being notified', () => {
    // React unsubscribes during render/commit, so this happens in practice.
    const store = createViewerStore()
    const second = vi.fn()
    const unsubscribeFirst = store.subscribe(() => unsubscribeFirst())
    store.subscribe(second)

    expect(() => store.setState({ pageCount: 1 })).not.toThrow()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('ignores an empty or missing patch', () => {
    const store = createViewerStore()
    expect(store.setState()).toBe(false)
    expect(store.setState({})).toBe(false)
  })
})
