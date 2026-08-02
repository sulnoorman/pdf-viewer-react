import { describe, it, expect } from 'vitest'
import {
  withHistory,
  createHistoryState,
  canUndo,
  canRedo,
  undo,
  redo,
  beginTransaction,
  commitTransaction,
  cancelTransaction,
  clearHistory,
} from './withHistory.js'
import {
  annotationReducer,
  initialAnnotationState,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
  createImageAnnotation,
  createInkAnnotation,
  createTextAnnotation,
} from './annotationReducer.js'

/** Minimal counter reducer for the pure history mechanics. */
const counter = (state = { n: 0 }, action) =>
  action.type === 'inc' ? { n: state.n + (action.by ?? 1) } : state

const run = (reducer, state, actions) => actions.reduce(reducer, state)

describe('history mechanics', () => {
  const reducer = withHistory(counter)
  const start = createHistoryState({ n: 0 })

  it('starts with nothing to undo or redo', () => {
    expect(canUndo(start)).toBe(false)
    expect(canRedo(start)).toBe(false)
  })

  it('records each change and steps back through them', () => {
    const state = run(reducer, start, [{ type: 'inc' }, { type: 'inc' }, { type: 'inc' }])
    expect(state.present).toEqual({ n: 3 })

    const once = reducer(state, undo())
    expect(once.present).toEqual({ n: 2 })
    const twice = reducer(once, undo())
    expect(twice.present).toEqual({ n: 1 })
  })

  it('redoes what was undone', () => {
    const state = run(reducer, start, [{ type: 'inc' }, { type: 'inc' }, undo()])
    expect(state.present).toEqual({ n: 1 })
    expect(reducer(state, redo()).present).toEqual({ n: 2 })
  })

  it('discards the redo branch once a new change lands', () => {
    const state = run(reducer, start, [{ type: 'inc' }, { type: 'inc' }, undo()])
    expect(canRedo(state)).toBe(true)

    const branched = reducer(state, { type: 'inc', by: 10 })
    expect(branched.present).toEqual({ n: 11 })
    expect(canRedo(branched)).toBe(false)
  })

  it('ignores undo/redo when there is nowhere to go', () => {
    expect(reducer(start, undo())).toBe(start)
    expect(reducer(start, redo())).toBe(start)
  })

  it('does not record actions the inner reducer ignored', () => {
    const state = reducer(start, { type: 'unknown-action' })
    expect(state).toBe(start)
    expect(canUndo(state)).toBe(false)
  })

  it('drops the oldest entries at the cap', () => {
    const capped = withHistory(counter, { limit: 3 })
    let state = createHistoryState({ n: 0 })
    for (let i = 0; i < 10; i += 1) state = capped(state, { type: 'inc' })

    expect(state.present).toEqual({ n: 10 })
    expect(state.past).toHaveLength(3)
    // Only the last 3 steps remain reachable.
    state = capped(capped(capped(state, undo()), undo()), undo())
    expect(state.present).toEqual({ n: 7 })
    expect(canUndo(state)).toBe(false)
  })

  it('clears the stacks without touching the present', () => {
    const state = run(reducer, start, [{ type: 'inc' }, { type: 'inc' }, undo()])
    const cleared = reducer(state, clearHistory())
    expect(cleared.present).toEqual(state.present)
    expect(canUndo(cleared)).toBe(false)
    expect(canRedo(cleared)).toBe(false)
  })
})

describe('transactions', () => {
  const reducer = withHistory(counter)
  const start = createHistoryState({ n: 0 })

  it('collapses a burst of changes into one undo step', () => {
    // The drag case: dozens of pointermove updates must cost one Ctrl+Z, not dozens.
    const state = run(reducer, start, [
      beginTransaction(),
      { type: 'inc' },
      { type: 'inc' },
      { type: 'inc' },
      commitTransaction(),
    ])

    expect(state.present).toEqual({ n: 3 })
    expect(state.past).toHaveLength(1)
    expect(reducer(state, undo()).present).toEqual({ n: 0 })
  })

  it('records nothing when a gesture ends where it began', () => {
    const state = run(reducer, start, [beginTransaction(), commitTransaction()])
    expect(canUndo(state)).toBe(false)
  })

  it('restores the pre-gesture state on cancel', () => {
    const state = run(reducer, start, [
      { type: 'inc' },
      beginTransaction(),
      { type: 'inc', by: 100 },
      cancelTransaction(),
    ])
    expect(state.present).toEqual({ n: 1 })
    expect(state.past).toHaveLength(1)
  })

  it('tolerates nesting and only commits at depth zero', () => {
    const state = run(reducer, start, [
      beginTransaction(),
      { type: 'inc' },
      beginTransaction(),
      { type: 'inc' },
      commitTransaction(),
      { type: 'inc' },
      commitTransaction(),
    ])
    expect(state.present).toEqual({ n: 3 })
    expect(state.past).toHaveLength(1)
  })

  it('refuses undo/redo mid-gesture', () => {
    const mid = run(reducer, start, [{ type: 'inc' }, beginTransaction(), { type: 'inc' }])
    expect(reducer(mid, undo())).toBe(mid)
    expect(reducer(mid, redo())).toBe(mid)
  })

  it('ignores a stray commit or cancel', () => {
    expect(reducer(start, commitTransaction())).toBe(start)
    expect(reducer(start, cancelTransaction())).toBe(start)
  })
})

describe('universal undo across annotation types', () => {
  const reducer = withHistory(annotationReducer)
  const start = createHistoryState(initialAnnotationState)

  it('undoes a stamp move without touching an unrelated ink stroke', () => {
    // This is the exact bug the rewrite exists to kill: with the old ink-only history,
    // pressing Ctrl+Z after moving a stamp deleted a pen stroke instead.
    const state = run(reducer, start, [
      addAnnotation(createInkAnnotation({ id: 'ink1', points: [{ x: 0, y: 0 }] })),
      addAnnotation(createImageAnnotation({ id: 'img1', x: 10, y: 10 })),
      updateAnnotation('img1', { x: 200, y: 300 }),
    ])

    expect(state.present.byId.img1).toMatchObject({ x: 200, y: 300 })

    const undone = reducer(state, undo())
    expect(undone.present.byId.img1).toMatchObject({ x: 10, y: 10 })
    expect(undone.present.byId.ink1).toBeDefined()
    expect(undone.present.order).toEqual(['ink1', 'img1'])
  })

  it('undoes creation of any annotation type', () => {
    let state = run(reducer, start, [
      addAnnotation(createImageAnnotation({ id: 'a' })),
      addAnnotation(createTextAnnotation({ id: 'b' })),
      addAnnotation(createInkAnnotation({ id: 'c' })),
    ])
    expect(state.present.order).toEqual(['a', 'b', 'c'])

    state = reducer(state, undo())
    expect(state.present.order).toEqual(['a', 'b'])
    state = reducer(state, undo())
    expect(state.present.order).toEqual(['a'])
    state = reducer(state, undo())
    expect(state.present.order).toEqual([])
    expect(canUndo(state)).toBe(false)
  })

  it('undoes a delete', () => {
    const state = run(reducer, start, [
      addAnnotation(createTextAnnotation({ id: 't', text: 'keep me' })),
      deleteAnnotation('t'),
    ])
    expect(state.present.byId.t).toBeUndefined()

    const restored = reducer(state, undo())
    expect(restored.present.byId.t).toMatchObject({ text: 'keep me' })
  })

  it('shares untouched annotations between snapshots', () => {
    // Why snapshot history is affordable: a stroke holding thousands of points is
    // referenced, never copied, by every later snapshot.
    const points = Array.from({ length: 2000 }, (_, i) => ({ x: i, y: i }))
    let state = reducer(start, addAnnotation(createInkAnnotation({ id: 'big', points })))
    const strokeRef = state.present.byId.big

    state = reducer(state, addAnnotation(createImageAnnotation({ id: 'img' })))
    state = reducer(state, updateAnnotation('img', { x: 42 }))

    expect(state.present.byId.big).toBe(strokeRef)
    for (const snapshot of state.past) {
      if (snapshot.byId.big) expect(snapshot.byId.big).toBe(strokeRef)
    }
  })

  it('groups a simulated drag into a single undo step', () => {
    let state = reducer(start, addAnnotation(createImageAnnotation({ id: 'img', x: 0, y: 0 })))
    state = reducer(state, beginTransaction())
    for (let i = 1; i <= 40; i += 1) {
      state = reducer(state, updateAnnotation('img', { x: i, y: i }))
    }
    state = reducer(state, commitTransaction())

    expect(state.present.byId.img).toMatchObject({ x: 40, y: 40 })
    const undone = reducer(state, undo())
    expect(undone.present.byId.img).toMatchObject({ x: 0, y: 0 })
  })
})
