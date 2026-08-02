import { describe, it, expect } from 'vitest'
import {
  annotationReducer,
  initialAnnotationState,
  ANNOTATION_TYPES,
  ANNOTATION_ACTIONS,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
  duplicateAnnotation,
  createImageAnnotation,
  createTextAnnotation,
  createInkAnnotation,
  selectAll,
  selectByPage,
  selectCounts,
} from './annotationReducer.js'

const reduceAll = (actions, state = initialAnnotationState) =>
  actions.reduce(annotationReducer, state)

describe('factories', () => {
  it('gives every annotation the shared base fields', () => {
    for (const make of [createImageAnnotation, createTextAnnotation, createInkAnnotation]) {
      const a = make()
      expect(a).toMatchObject({ pageIndex: 0, rotation: 0, opacity: 1 })
      expect(a.id).toBeTruthy()
      expect(typeof a.x).toBe('number')
      expect(typeof a.y).toBe('number')
      expect(typeof a.width).toBe('number')
      expect(typeof a.height).toBe('number')
    }
  })

  it('tags each annotation with its type', () => {
    expect(createImageAnnotation().type).toBe(ANNOTATION_TYPES.IMAGE)
    expect(createTextAnnotation().type).toBe(ANNOTATION_TYPES.TEXT)
    expect(createInkAnnotation().type).toBe(ANNOTATION_TYPES.INK)
  })

  it('derives the ink bounding box from its points', () => {
    const ink = createInkAnnotation({
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 5 },
      ],
    })
    expect(ink).toMatchObject({ x: 10, y: 5, width: 30, height: 15 })
  })

  it('defaults an image stamp to the registry key used by the single-specimen config', () => {
    expect(createImageAnnotation().assetId).toBe('default')
  })
})

describe('ADD', () => {
  it('appends to byId and to the paint order', () => {
    const a = createImageAnnotation({ id: 'a' })
    const state = annotationReducer(initialAnnotationState, addAnnotation(a))
    expect(state.byId).toEqual({ a })
    expect(state.order).toEqual(['a'])
  })

  it('ignores a duplicate id rather than clobbering the original', () => {
    const first = createTextAnnotation({ id: 'a', text: 'first' })
    const second = createTextAnnotation({ id: 'a', text: 'second' })
    const state = reduceAll([addAnnotation(first), addAnnotation(second)])
    expect(state.byId.a.text).toBe('first')
    expect(state.order).toEqual(['a'])
  })

  it('does not mutate the previous state', () => {
    const before = annotationReducer(
      initialAnnotationState,
      addAnnotation(createImageAnnotation({ id: 'a' }))
    )
    const snapshot = JSON.parse(JSON.stringify(before))
    annotationReducer(before, addAnnotation(createImageAnnotation({ id: 'b' })))
    expect(before).toEqual(snapshot)
  })
})

describe('UPDATE', () => {
  const seeded = annotationReducer(
    initialAnnotationState,
    addAnnotation(createImageAnnotation({ id: 'a', x: 10, y: 10 }))
  )

  it('merges a patch', () => {
    const state = annotationReducer(seeded, updateAnnotation('a', { x: 99 }))
    expect(state.byId.a).toMatchObject({ x: 99, y: 10 })
  })

  it('returns the identical state object for an unknown id', () => {
    expect(annotationReducer(seeded, updateAnnotation('missing', { x: 1 }))).toBe(seeded)
  })

  it('returns the identical state object when the patch changes nothing', () => {
    // Identity matters: withHistory uses it to skip recording no-op undo steps.
    expect(annotationReducer(seeded, updateAnnotation('a', { x: 10 }))).toBe(seeded)
    expect(annotationReducer(seeded, updateAnnotation('a', {}))).toBe(seeded)
  })

  it('recomputes the ink bbox when points move', () => {
    const withInk = annotationReducer(
      initialAnnotationState,
      addAnnotation(createInkAnnotation({ id: 'i', points: [{ x: 0, y: 0 }] }))
    )
    const state = annotationReducer(
      withInk,
      updateAnnotation('i', {
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 60 },
        ],
      })
    )
    expect(state.byId.i).toMatchObject({ x: 0, y: 0, width: 30, height: 60 })
  })
})

describe('DELETE', () => {
  const seeded = reduceAll([
    addAnnotation(createImageAnnotation({ id: 'a' })),
    addAnnotation(createTextAnnotation({ id: 'b' })),
  ])

  it('removes from both byId and order', () => {
    const state = annotationReducer(seeded, deleteAnnotation('a'))
    expect(state.byId).not.toHaveProperty('a')
    expect(state.order).toEqual(['b'])
  })

  it('is a no-op for an unknown id', () => {
    expect(annotationReducer(seeded, deleteAnnotation('zzz'))).toBe(seeded)
  })

  it('deletes many at once', () => {
    const state = annotationReducer(seeded, {
      type: ANNOTATION_ACTIONS.DELETE_MANY,
      ids: ['a', 'b'],
    })
    expect(state.order).toEqual([])
    expect(state.byId).toEqual({})
  })
})

describe('DUPLICATE', () => {
  it('offsets the copy and gives it a fresh id', () => {
    const seeded = annotationReducer(
      initialAnnotationState,
      addAnnotation(createTextAnnotation({ id: 'a', x: 10, y: 20, text: 'hi' }))
    )
    const state = annotationReducer(seeded, duplicateAnnotation('a', 12))
    const copyId = state.order[1]

    expect(copyId).not.toBe('a')
    expect(state.byId[copyId]).toMatchObject({ x: 22, y: 32, text: 'hi' })
  })

  it('translates ink points, not just the bbox', () => {
    // A copied stroke whose points were left alone would render exactly on top of
    // the original and look like nothing happened.
    const seeded = annotationReducer(
      initialAnnotationState,
      addAnnotation(
        createInkAnnotation({
          id: 'i',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
          ],
        })
      )
    )
    const state = annotationReducer(seeded, duplicateAnnotation('i', 5))
    const copy = state.byId[state.order[1]]

    expect(copy.points).toEqual([
      { x: 5, y: 5 },
      { x: 15, y: 15 },
    ])
    expect(copy).toMatchObject({ x: 5, y: 5, width: 10, height: 10 })
  })
})

describe('z-order', () => {
  const seeded = reduceAll([
    addAnnotation(createImageAnnotation({ id: 'a' })),
    addAnnotation(createImageAnnotation({ id: 'b' })),
    addAnnotation(createImageAnnotation({ id: 'c' })),
  ])

  it('brings to front', () => {
    const state = annotationReducer(seeded, { type: ANNOTATION_ACTIONS.BRING_TO_FRONT, id: 'a' })
    expect(state.order).toEqual(['b', 'c', 'a'])
  })

  it('sends to back', () => {
    const state = annotationReducer(seeded, { type: ANNOTATION_ACTIONS.SEND_TO_BACK, id: 'c' })
    expect(state.order).toEqual(['c', 'a', 'b'])
  })

  it('is a no-op when already at the target end', () => {
    expect(annotationReducer(seeded, { type: ANNOTATION_ACTIONS.BRING_TO_FRONT, id: 'c' })).toBe(
      seeded
    )
    expect(annotationReducer(seeded, { type: ANNOTATION_ACTIONS.SEND_TO_BACK, id: 'a' })).toBe(
      seeded
    )
  })
})

describe('selectors', () => {
  const seeded = reduceAll([
    addAnnotation(createImageAnnotation({ id: 'a', pageIndex: 0 })),
    addAnnotation(createInkAnnotation({ id: 'i', pageIndex: 1 })),
    addAnnotation(createTextAnnotation({ id: 't', pageIndex: 0 })),
  ])

  it('returns everything in paint order', () => {
    expect(selectAll(seeded).map((a) => a.id)).toEqual(['a', 'i', 't'])
  })

  it('filters by page, preserving paint order', () => {
    expect(selectByPage(seeded, 0).map((a) => a.id)).toEqual(['a', 't'])
    expect(selectByPage(seeded, 1).map((a) => a.id)).toEqual(['i'])
    expect(selectByPage(seeded, 9)).toEqual([])
  })

  it('counts by type', () => {
    // This is what replaces onSpecimenChange's image-only count, which locked users
    // who had only drawn or typed out of exporting.
    expect(selectCounts(seeded)).toEqual({ image: 1, text: 1, ink: 1, total: 3 })
  })
})

describe('unknown actions', () => {
  it('leave state untouched by reference', () => {
    expect(annotationReducer(initialAnnotationState, { type: 'nope' })).toBe(initialAnnotationState)
  })
})
