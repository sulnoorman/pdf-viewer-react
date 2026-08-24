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
  annotationsToState,
  replaceAllAnnotations,
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

  it('defaults an image stamp to an ordinary registry key', () => {
    // Once the specimen's own reserved id, now just a key. It must stay ordinary:
    // deriveViewerState reads the asset's `kind`, so a stamp on an unregistered id
    // can never be mistaken for a signature.
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

  describe('with page bounds', () => {
    const PAGE = { width: 600, height: 800 }

    /** A text box of a known size at a given spot. */
    const seed = (x, y) =>
      annotationReducer(
        initialAnnotationState,
        addAnnotation(createTextAnnotation({ id: 'a', x, y, width: 100, height: 40, text: 'hi' }))
      )

    it('offsets normally with room to spare', () => {
      const state = annotationReducer(seed(10, 20), duplicateAnnotation('a', 12, PAGE))
      expect(state.byId[state.order[1]]).toMatchObject({ x: 22, y: 32 })
    })

    it('holds the copy inside when the original hugs the far corner', () => {
      // Without this the copy of a stamp tucked into the bottom-right corner lands off
      // the page, where the export draws it partly or wholly off the sheet.
      const state = annotationReducer(seed(500, 760), duplicateAnnotation('a', 12, PAGE))
      expect(state.byId[state.order[1]]).toMatchObject({ x: 500, y: 760 })
    })

    it('still offsets on the axis that has room', () => {
      // Flush against the bottom but with space to the right: the copy should slide
      // right and stay put vertically, not refuse to move at all.
      const state = annotationReducer(seed(100, 760), duplicateAnnotation('a', 12, PAGE))
      expect(state.byId[state.order[1]]).toMatchObject({ x: 112, y: 760 })
    })

    it('leaves ink alone, which has no rect to clamp', () => {
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
      const state = annotationReducer(seeded, duplicateAnnotation('i', 5, PAGE))
      expect(state.byId[state.order[1]].points).toEqual([
        { x: 5, y: 5 },
        { x: 15, y: 15 },
      ])
    })
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

  it('leaves total out of the per-type buckets it sums', () => {
    /*
     * `total` used to be incremented outside the type check, and the check itself was
     * `type in counts` — which is true for 'total'. Either flaw alone let a host
     * gating Submit on `total > 0` unlock on something that was never drawn.
     */
    const state = {
      byId: { a: { id: 'a', type: 'total' }, b: { id: 'b', type: 'mystery' } },
      order: ['a', 'b', 'ghost'],
    }
    expect(selectCounts(state)).toEqual({ image: 0, text: 0, ink: 0, total: 0 })
  })

  it('keeps total equal to the sum of the buckets', () => {
    const { image, text, ink, total } = selectCounts(seeded)
    expect(image + text + ink).toBe(total)
  })
})

describe('unknown actions', () => {
  it('leave state untouched by reference', () => {
    expect(annotationReducer(initialAnnotationState, { type: 'nope' })).toBe(initialAnnotationState)
  })
})

describe('annotationsToState', () => {
  it('round-trips with selectAll, preserving paint order', () => {
    // The contract that makes drafts work: what getAnnotations() hands out has to be
    // acceptable straight back, order intact, because order is the z-order.
    const list = [
      createImageAnnotation({ id: 'a', pageIndex: 0 }),
      createTextAnnotation({ id: 'b', pageIndex: 3, text: 'hi' }),
      createImageAnnotation({ id: 'c', pageIndex: 1 }),
    ]
    const state = annotationsToState(list)

    expect(state.order).toEqual(['a', 'b', 'c'])
    expect(selectAll(state)).toEqual(list)
  })

  it('empties the store for anything that is not an array', () => {
    for (const input of [undefined, null, 'nope', 42, {}]) {
      expect(annotationsToState(input)).toBe(initialAnnotationState)
    }
  })

  it('drops malformed entries instead of throwing', () => {
    /*
     * The list arrives from a host — localStorage, an API, a serialisation round trip. One
     * bad row must cost that annotation, not the whole viewer.
     *
     * `pageIndex` is the field worth being strict about: a missing or non-integer one would
     * otherwise put the annotation on page 1 of a document it does not belong to.
     */
    const state = annotationsToState([
      null,
      'not an object',
      { id: 'no-page' },
      { id: 'bad-page', pageIndex: 'first' },
      { id: 'fractional', pageIndex: 1.5 },
      { id: 'negative', pageIndex: -1 },
      { pageIndex: 0 }, // no id
      { id: '', pageIndex: 0 }, // empty id
      createImageAnnotation({ id: 'good', pageIndex: 2 }),
    ])

    expect(state.order).toEqual(['good'])
  })

  it('keeps the first of two entries sharing an id', () => {
    // A duplicate would make `order` and `byId` disagree about how many there are, and the
    // second copy would be unreachable but still counted.
    const state = annotationsToState([
      createImageAnnotation({ id: 'dup', pageIndex: 0, width: 10 }),
      createImageAnnotation({ id: 'dup', pageIndex: 1, width: 99 }),
    ])

    expect(state.order).toEqual(['dup'])
    expect(state.byId.dup.width).toBe(10)
  })
})

describe('REPLACE_ALL', () => {
  it('swaps the whole store', () => {
    const seeded = annotationReducer(
      initialAnnotationState,
      addAnnotation(createTextAnnotation({ id: 'old', text: 'gone' }))
    )
    const next = annotationsToState([createImageAnnotation({ id: 'new', pageIndex: 0 })])

    const state = annotationReducer(seeded, replaceAllAnnotations(next))
    expect(state.order).toEqual(['new'])
    expect(state.byId.old).toBeUndefined()
  })

  it('empties the store when given nothing', () => {
    const seeded = annotationReducer(
      initialAnnotationState,
      addAnnotation(createTextAnnotation({ id: 'old' }))
    )
    expect(annotationReducer(seeded, replaceAllAnnotations())).toBe(initialAnnotationState)
  })
})
