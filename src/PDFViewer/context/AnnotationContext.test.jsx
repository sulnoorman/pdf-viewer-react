import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import {
  AnnotationProvider,
  useAnnotationState,
  useAnnotationActions,
} from './AnnotationContext.jsx'
import {
  createTextAnnotation,
  createImageAnnotation,
  selectAll,
} from '../reducers/annotationReducer.js'

/**
 * A viewer standing in for the real one: it reports what the store holds on every render,
 * and hands the actions back so a test can drive them.
 *
 * Recording per render rather than per effect is what lets these tests distinguish "reset
 * during render" from "reset in an effect" — the difference between a clean document switch
 * and one that paints the previous document's annotations for a frame.
 */
function harness() {
  const renders = []
  let actions = null

  function Probe() {
    const { annotations, canUndo, canRedo } = useAnnotationState()
    actions = useAnnotationActions()
    renders.push({ ids: selectAll(annotations).map((a) => a.id), canUndo, canRedo })
    return null
  }

  return { renders, Probe, act: (fn) => act(() => fn(actions)), get actions() { return actions } }
}

function mount({ documentId, initialAnnotations } = {}) {
  const h = harness()
  const view = render(
    <AnnotationProvider documentId={documentId} initialAnnotations={initialAnnotations}>
      <h.Probe />
    </AnnotationProvider>
  )

  const rerender = (props = {}) =>
    view.rerender(
      <AnnotationProvider {...props}>
        <h.Probe />
      </AnnotationProvider>
    )

  return { ...h, rerender, latest: () => h.renders.at(-1) }
}

const text = (id) => createTextAnnotation({ id, pageIndex: 0, text: id })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('switching documents', () => {
  it('empties the store on the very render the id changes', () => {
    /*
     * The whole point of deriving the switch during render rather than correcting it in an
     * effect. Effects run after the paint, so an effect-only reset would draw the previous
     * attachment's annotations over the new document for one frame — the reported bug,
     * only briefer. Asserting on the render *record* is the only way to see that frame.
     */
    const h = mount({ documentId: 'a' })
    h.act((actions) => actions.add(text('one')))
    expect(h.latest().ids).toEqual(['one'])

    h.rerender({ documentId: 'b' })
    expect(h.latest().ids).toEqual([])
    // No render in between showed the old annotation under the new id.
    expect(h.renders.every((r) => r.ids.length === 0 || r.ids[0] === 'one')).toBe(true)
  })

  it('seeds the new document from initialAnnotations', () => {
    const h = mount({ documentId: 'a' })
    h.act((actions) => actions.add(text('from-a')))

    h.rerender({ documentId: 'b', initialAnnotations: [text('draft-1'), text('draft-2')] })
    expect(h.latest().ids).toEqual(['draft-1', 'draft-2'])
  })

  it('keeps annotations out of each other reach across a round trip', () => {
    // The host holds the map; this checks the library hands back exactly what it was given.
    const h = mount({ documentId: 'a' })
    h.act((actions) => actions.add(text('a-1')))
    const savedA = selectAll(h.actions.getSnapshot())

    h.rerender({ documentId: 'b' })
    h.act((actions) => actions.add(text('b-1')))
    expect(h.latest().ids).toEqual(['b-1'])

    h.rerender({ documentId: 'a', initialAnnotations: savedA })
    expect(h.latest().ids).toEqual(['a-1'])
  })

  it('does not let undo reach back across the switch', () => {
    /*
     * Without clearing history with the reset, the first Ctrl+Z after opening an attachment
     * would "undo" the restored draft and wipe every annotation in it — the worst possible
     * response to a keystroke a reviewer presses out of habit.
     */
    const h = mount({ documentId: 'a' })
    h.act((actions) => actions.add(text('one')))

    h.rerender({ documentId: 'b', initialAnnotations: [text('draft')] })
    expect(h.latest().canUndo).toBe(false)

    h.act((actions) => actions.undo())
    expect(h.latest().ids).toEqual(['draft'])
  })

  it('offers no undo or redo while the switch is settling', () => {
    // The history still belongs to the document that just left the screen.
    const h = mount({ documentId: 'a' })
    h.act((actions) => actions.add(text('one')))
    expect(h.latest().canUndo).toBe(true)

    h.rerender({ documentId: 'b' })
    expect(h.latest().canUndo).toBe(false)
    expect(h.latest().canRedo).toBe(false)
  })

  it('ignores a document id that changes only in the store, not on screen', () => {
    // Re-rendering with the same id must not disturb anything.
    const h = mount({ documentId: 'a' })
    h.act((actions) => actions.add(text('one')))

    h.rerender({ documentId: 'a', initialAnnotations: [text('ignored')] })
    expect(h.latest().ids).toEqual(['one'])
  })
})

describe('a document id that is not yet known', () => {
  it('adopts a late id without discarding work', () => {
    /*
     * `documentId={file?.id}` is ordinary host code, and it starts undefined while the
     * metadata is still being fetched. Treating `undefined -> id` as a document switch
     * would delete annotations the user watched themselves draw.
     */
    const h = mount({})
    h.act((actions) => actions.add(text('drawn-early')))

    h.rerender({ documentId: 'arrived' })
    expect(h.latest().ids).toEqual(['drawn-early'])
  })

  it('still switches properly once a real id is in place', () => {
    // Forgiving the first change must not leave the store permanently unable to switch.
    const h = mount({})
    h.rerender({ documentId: 'a' })
    h.act((actions) => actions.add(text('a-1')))

    h.rerender({ documentId: 'b' })
    expect(h.latest().ids).toEqual([])
  })

  it('keeps the annotations and warns once when an id disappears', () => {
    // Going from an id back to undefined is a host bug; throwing away a reviewer's work
    // over it would be the worst available reading.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const h = mount({ documentId: 'a' })
    h.act((actions) => actions.add(text('keep-me')))
    h.rerender({ documentId: undefined })

    expect(h.latest().ids).toEqual(['keep-me'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/documentId/)
  })
})

describe('without a documentId at all', () => {
  /*
   * The guard for every application already using this library. None of them pass
   * `documentId`, so every one of these must behave exactly as it did before the prop
   * existed.
   */
  it('never resets, however many times it re-renders', () => {
    const h = mount({})
    h.act((actions) => actions.add(text('one')))
    h.act((actions) => actions.add(text('two')))

    h.rerender({})
    h.rerender({})
    expect(h.latest().ids).toEqual(['one', 'two'])
  })

  it('leaves undo and redo working normally', () => {
    const h = mount({})
    h.act((actions) => actions.add(text('one')))
    h.act((actions) => actions.add(text('two')))
    expect(h.latest().canUndo).toBe(true)

    h.act((actions) => actions.undo())
    expect(h.latest().ids).toEqual(['one'])
    h.act((actions) => actions.redo())
    expect(h.latest().ids).toEqual(['one', 'two'])
  })

  it('ignores initialAnnotations, since there is no switch to seed', () => {
    const h = mount({ initialAnnotations: [text('seed')] })
    expect(h.latest().ids).toEqual([])
  })
})

describe('replaceAll', () => {
  it('installs a list and clears the history with it', () => {
    const h = mount({ documentId: 'a' })
    h.act((actions) => actions.add(text('original')))

    h.act((actions) => actions.replaceAll([text('restored')]))
    expect(h.latest().ids).toEqual(['restored'])
    expect(h.latest().canUndo).toBe(false)

    // The draft must survive the reflex Ctrl+Z.
    h.act((actions) => actions.undo())
    expect(h.latest().ids).toEqual(['restored'])
  })

  it('does not make the store forget which document it holds', () => {
    /*
     * If `replaceAll` dropped the identity, the store would claim to hold no document and
     * the next render would be spent putting that right — and, worse, a later genuine
     * switch would be read as a late-arriving id and forgiven.
     */
    const h = mount({ documentId: 'a' })
    h.act((actions) => actions.replaceAll([text('restored')]))

    h.rerender({ documentId: 'b' })
    expect(h.latest().ids).toEqual([])
  })

  it('accepts an empty list', () => {
    const h = mount({ documentId: 'a' })
    h.act((actions) => actions.add(text('one')))
    h.act((actions) => actions.replaceAll([]))
    expect(h.latest().ids).toEqual([])
  })

  it('drops malformed entries rather than failing to render', () => {
    // A saved draft is host data; one bad row costs that annotation, not the viewer.
    const h = mount({ documentId: 'a' })
    h.act((actions) =>
      actions.replaceAll([null, { id: 'no-page' }, createImageAnnotation({ id: 'ok', pageIndex: 1 })])
    )
    expect(h.latest().ids).toEqual(['ok'])
  })
})
