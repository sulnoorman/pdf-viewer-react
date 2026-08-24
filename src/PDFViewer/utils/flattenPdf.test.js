import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest'
import { PDFDocument, PDFName } from 'pdf-lib'
import { flattenPdf } from './flattenPdf.js'
import { createImageAnnotation, createTextAnnotation } from '../reducers/annotationReducer.js'
import { SPECIMEN_ASSET_ID } from '../hooks/useStampAssets.js'
import { createFixturePdf, FIXTURE_PAGES } from '../../../tests/helpers/fixture.js'

/** A 1x1 PNG as a data URL, so image embedding is exercised without a network fetch. */
const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PNG_DATA_URL = `data:image/png;base64,${PNG_1X1_BASE64}`

let fixture

beforeAll(async () => {
  fixture = await createFixturePdf()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const asDoc = async (blob) => PDFDocument.load(await blob.arrayBuffer())

/**
 * How many image XObjects a document carries, read from the object graph rather than from
 * one page's resource dict — pdf-lib may attach them anywhere in the tree.
 *
 * Counts are not the number of stamps: embedding a PNG with an alpha channel also writes
 * its transparency mask as a second image. So these tests ask whether images arrived, not
 * how many.
 */
function imageCount(doc) {
  let images = 0
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    const dict = object?.dict
    if (!dict) continue
    if (dict.get(PDFName.of('Subtype'))?.toString() === '/Image') images += 1
  }
  return images
}

describe('flattenPdf', () => {
  /*
   * Why this exists at all: `viewer.getFlattenedPDF()` can only export the document on
   * screen. A host holding several — a tab per attachment — has to produce every file with
   * its own annotations on Submit, and driving one viewer around all of them to collect the
   * output would mean loading and rendering each in turn for nothing.
   */

  it('accepts the same source shapes the component does', async () => {
    // A host passes whatever it already has, without converting anything.
    const sources = [
      fixture,
      fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength),
      new Blob([fixture], { type: 'application/pdf' }),
    ]

    for (const src of sources) {
      const doc = await asDoc(await flattenPdf({ src }))
      expect(doc.getPageCount()).toBe(FIXTURE_PAGES.length)
    }
  })

  it('produces a valid PDF with no annotations at all', async () => {
    // An attachment a reviewer never opened still has to come out of the loop.
    const doc = await asDoc(await flattenPdf({ src: fixture }))
    expect(doc.getPageCount()).toBe(FIXTURE_PAGES.length)
    // Untouched, so the page geometry is exactly the source's.
    expect(doc.getPage(2).getSize().width).toBeCloseTo(FIXTURE_PAGES[2].width, 2)
  })

  it('draws a text annotation onto the page it names', async () => {
    const before = (await asDoc(await flattenPdf({ src: fixture })))
      .getPage(0)
      .node.Contents()
      ?.toString()

    const blob = await flattenPdf({
      src: fixture,
      annotations: [
        createTextAnnotation({ pageIndex: 0, x: 50, y: 50, text: 'reviewed', fontSize: 14 }),
      ],
    })
    const after = (await asDoc(blob)).getPage(0).node.Contents()?.toString()

    expect(after).not.toBe(before)
  })

  it('embeds an image from the asset registry, in the host config shape', async () => {
    /*
     * A registry entry is identified by its `src` — the same rule the component applies,
     * because its menu renders an <img>. A data URL is therefore the way to supply image
     * data without a server, and it is what a host persisting an uploaded signature into a
     * draft would store.
     */
    const blob = await flattenPdf({
      src: fixture,
      annotations: [createImageAnnotation({ assetId: 'seal', pageIndex: 0, x: 20, y: 20 })],
      stampAssets: { seal: PNG_DATA_URL },
    })

    // The fixture carries no images of its own, so any that appear came from the stamp.
    expect(imageCount(await asDoc(blob))).toBeGreaterThan(0)
    expect(imageCount(await asDoc(await flattenPdf({ src: fixture })))).toBe(0)
  })

  it('recognises a PNG data URL, which carries no filename to go by', async () => {
    /*
     * pdf-lib has to be told PNG or JPEG and throws if told wrong. The format used to be
     * guessed from `mimeType` or a path ending in `.png`, and a data URL offers neither —
     * so it fell through to embedJpg and failed with "SOI not found in JPEG", naming
     * neither the asset nor the real problem. The bytes are asked first now.
     */
    const blob = await flattenPdf({
      src: fixture,
      // Deliberately no `mimeType`: the bytes alone must be enough.
      annotations: [createImageAnnotation({ assetId: 'sign', pageIndex: 0 })],
      stampAssets: { sign: { src: PNG_DATA_URL } },
    })

    expect(imageCount(await asDoc(blob))).toBeGreaterThan(0)
  })

  it('skips an annotation whose asset is unknown, without throwing', async () => {
    /*
     * Reachable and worth being gentle about: an image the user uploaded into the viewer
     * lives only in that viewer's memory, so a draft referencing it cannot be resolved from
     * out here. Losing that one stamp is right; failing the whole submit is not.
     */
    const blob = await flattenPdf({
      src: fixture,
      annotations: [
        createImageAnnotation({ assetId: 'uploaded-and-gone', pageIndex: 0 }),
        createTextAnnotation({ pageIndex: 1, text: 'kept' }),
      ],
      stampAssets: {},
    })

    expect((await asDoc(blob)).getPageCount()).toBe(FIXTURE_PAGES.length)
  })

  it('ignores an annotation pointing past the end of the document', async () => {
    // The case a mismatched draft creates: page 90 of a 116-page attachment, restored onto
    // one that only has three pages.
    const blob = await flattenPdf({
      src: fixture,
      annotations: [createTextAnnotation({ pageIndex: 90, text: 'nowhere' })],
    })

    expect((await asDoc(blob)).getPageCount()).toBe(FIXTURE_PAGES.length)
  })

  it('registers specimenAsset under its reserved id, as the component does', async () => {
    /*
     * The same normalisation helper the component uses, so a specimen exports from here
     * too — and `specimenAsset` keeps its documented shape, a URL rather than a record.
     * A data URL is used so the fetch is real without a network.
     */
    const blob = await flattenPdf({
      src: fixture,
      annotations: [createImageAnnotation({ assetId: SPECIMEN_ASSET_ID, pageIndex: 0 })],
      specimenAsset: PNG_DATA_URL,
    })

    expect(imageCount(await asDoc(blob))).toBeGreaterThan(0)
  })

  it('applies page rotation only when asked', async () => {
    const rotations = { 0: 90 }

    const rotated = await asDoc(await flattenPdf({ src: fixture, pageRotations: rotations }))
    expect(rotated.getPage(0).getRotation().angle).toBe(90)

    const plain = await asDoc(
      await flattenPdf({ src: fixture, pageRotations: rotations, rotateExportedPages: false })
    )
    expect(plain.getPage(0).getRotation().angle).toBe(FIXTURE_PAGES[0].rotate)
  })

  it('refuses to run without a source', async () => {
    // Far better than pdf-lib failing later on undefined bytes.
    await expect(flattenPdf({})).rejects.toThrow(/src/)
    await expect(flattenPdf()).rejects.toThrow(/src/)
  })
})
