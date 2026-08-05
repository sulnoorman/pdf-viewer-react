import { describe, it, expect } from 'vitest'
import { deriveViewerState, sameCounts } from './viewerState.js'

/** The registry shape `useStampAssets` produces. */
const ASSETS = {
  specimen: { id: 'specimen', kind: 'specimen', src: '/sign.png' },
  seal: { id: 'seal', kind: 'stamp', src: '/seal.png' },
  'asset-upload': { id: 'asset-upload', kind: 'stamp', src: 'blob:x' },
}

const image = (assetId) => ({ id: `i-${assetId}`, type: 'image', assetId })
const text = (id = 't1') => ({ id, type: 'text', text: 'hi' })
const ink = (id = 'k1') => ({ id, type: 'ink', points: [] })

describe('deriveViewerState', () => {
  it('reports nothing on an untouched document', () => {
    const state = deriveViewerState({ annotations: [], assets: ASSETS })
    expect(state.hasSpecimen).toBe(false)
    expect(state.hasAnnotation).toBe(false)
    expect(state.counts).toEqual({ specimen: 0, stamp: 0, image: 0, text: 0, ink: 0, total: 0 })
  })

  it('sets hasSpecimen only for a stamp from a specimen asset', () => {
    const state = deriveViewerState({ annotations: [image('specimen')], assets: ASSETS })
    expect(state.hasSpecimen).toBe(true)
    expect(state.counts.specimen).toBe(1)
    expect(state.counts.stamp).toBe(0)
  })

  it('leaves hasSpecimen false for an ordinary stamp', () => {
    /*
     * The whole point of the split. Placing the company seal must not satisfy a
     * "document must be signed" gate — under the old counts.image rule it did.
     */
    const state = deriveViewerState({ annotations: [image('seal')], assets: ASSETS })
    expect(state.hasSpecimen).toBe(false)
    expect(state.counts.image).toBe(1)
    expect(state.counts.stamp).toBe(1)
  })

  it('leaves hasSpecimen false for an image the user uploaded', () => {
    // Otherwise any PNG at all would count as a signature.
    const state = deriveViewerState({ annotations: [image('asset-upload')], assets: ASSETS })
    expect(state.hasSpecimen).toBe(false)
    expect(state.counts.stamp).toBe(1)
  })

  it('treats an unknown assetId as a plain stamp', () => {
    // Lenient in the safe direction: never report "signed" on an asset we cannot see.
    const state = deriveViewerState({ annotations: [image('gone')], assets: ASSETS })
    expect(state.hasSpecimen).toBe(false)
    expect(state.counts.stamp).toBe(1)
  })

  it('sets hasAnnotation for ink and for text, but never for an image', () => {
    const assets = ASSETS
    expect(deriveViewerState({ annotations: [ink()], assets }).hasAnnotation).toBe(true)
    expect(deriveViewerState({ annotations: [text()], assets }).hasAnnotation).toBe(true)
    expect(deriveViewerState({ annotations: [image('specimen')], assets }).hasAnnotation).toBe(false)
  })

  it('reports the two flags independently', () => {
    // The requirement the split exists for: some flows need only a specimen, others
    // only a hand-written mark, and either may be present without the other.
    const onlyMark = deriveViewerState({ annotations: [ink()], assets: ASSETS })
    expect([onlyMark.hasSpecimen, onlyMark.hasAnnotation]).toEqual([false, true])

    const onlySign = deriveViewerState({ annotations: [image('specimen')], assets: ASSETS })
    expect([onlySign.hasSpecimen, onlySign.hasAnnotation]).toEqual([true, false])

    const both = deriveViewerState({ annotations: [image('specimen'), ink()], assets: ASSETS })
    expect([both.hasSpecimen, both.hasAnnotation]).toEqual([true, true])
  })

  it('splits every image into exactly one of specimen or stamp', () => {
    const state = deriveViewerState({
      annotations: [image('specimen'), image('seal'), image('asset-upload'), text(), ink()],
      assets: ASSETS,
    })
    expect(state.counts.specimen + state.counts.stamp).toBe(state.counts.image)
    expect(state.counts).toEqual({ specimen: 1, stamp: 2, image: 3, text: 1, ink: 1, total: 5 })
  })

  it('ignores annotations of an unknown type instead of inflating total', () => {
    const state = deriveViewerState({ annotations: [{ type: 'mystery' }, null], assets: ASSETS })
    expect(state.counts.total).toBe(0)
  })

  it('works with no arguments at all', () => {
    expect(deriveViewerState().counts.total).toBe(0)
  })
})

describe('sameCounts', () => {
  it('compares by value, so a fresh object with equal numbers matches', () => {
    // This is what stops onAnnotationsChange firing on every drag: the counts object
    // is rebuilt on each edit, but the numbers in it rarely change.
    expect(sameCounts({ image: 1, total: 1 }, { image: 1, total: 1 })).toBe(true)
  })

  it('spots a changed number', () => {
    expect(sameCounts({ image: 1, total: 1 }, { image: 2, total: 2 })).toBe(false)
  })

  it('treats the initial null as different, so the first fire still happens', () => {
    expect(sameCounts(null, { total: 0 })).toBe(false)
  })

  it('spots a differing set of keys', () => {
    expect(sameCounts({ total: 0 }, { total: 0, ink: 0 })).toBe(false)
  })
})
