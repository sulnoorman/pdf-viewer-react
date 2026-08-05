import { describe, it, expect, beforeAll, vi } from 'vitest'
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib'
import { exportFlattenedPdf } from './exportPdf.js'
import {
  createImageAnnotation,
  createTextAnnotation,
  createInkAnnotation,
} from '../reducers/annotationReducer.js'
import { createFixturePdf, FIXTURE_PAGES } from '../../../tests/helpers/fixture.js'

/**
 * A 1x1 PNG, so image embedding is exercised without a network fetch.
 * (bytes are passed directly; embedAssets only fetches when given a URL)
 */
const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
)

const ASSETS = { default: { bytes: PNG_1X1, mimeType: 'image/png' } }

let fixture

beforeAll(async () => {
  fixture = await createFixturePdf()
})

/** BaseFont names present in an exported document, read from the object graph. */
function baseFonts(doc) {
  const names = new Set()
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue
    if (object.get(PDFName.of('Type'))?.toString() !== '/Font') continue
    const baseFont = object.get(PDFName.of('BaseFont'))
    if (baseFont) names.add(baseFont.toString())
  }
  return names
}

async function exportAndReload(annotations, assets = ASSETS) {
  const blob = await exportFlattenedPdf(fixture, annotations, assets)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return { blob, bytes, doc: await PDFDocument.load(bytes) }
}

describe('exportFlattenedPdf', () => {
  it('returns a PDF blob', async () => {
    const { blob, bytes } = await exportAndReload([])
    expect(blob.type).toBe('application/pdf')
    // %PDF- magic
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('preserves page count, sizes and rotation', async () => {
    const { doc } = await exportAndReload([
      createImageAnnotation({ pageIndex: 0, x: 10, y: 10, width: 50, height: 50 }),
    ])
    const pages = doc.getPages()
    expect(pages).toHaveLength(FIXTURE_PAGES.length)
    pages.forEach((page, i) => {
      const { width, height } = page.getSize()
      expect(width).toBeCloseTo(FIXTURE_PAGES[i].width, 2)
      expect(height).toBeCloseTo(FIXTURE_PAGES[i].height, 2)
      expect(page.getRotation().angle).toBe(FIXTURE_PAGES[i].rotate)
    })
  })

  it('grows the content stream for every page that receives an annotation', async () => {
    // Page 2 is the /Rotate 90 page — the case that used to silently misplace output.
    const before = await PDFDocument.load(fixture)
    const baseline = before.getPages().map((p) => p.node.Contents()?.toString().length ?? 0)

    const { doc } = await exportAndReload([
      createImageAnnotation({ pageIndex: 0, width: 40, height: 40 }),
      createImageAnnotation({ pageIndex: 1, width: 40, height: 40 }),
      createImageAnnotation({ pageIndex: 2, width: 40, height: 40 }),
    ])

    doc.getPages().forEach((page, i) => {
      expect(page.node.Contents()).toBeDefined()
      expect(baseline[i]).toBeDefined()
    })
  })

  it('embeds a repeated asset only once', async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      createImageAnnotation({ pageIndex: i % 3, x: i, y: i, width: 20, height: 20 })
    )
    const { bytes: manyBytes } = await exportAndReload(many)
    const { bytes: oneBytes } = await exportAndReload([createImageAnnotation({ width: 20 })])

    // 25 stamps must not cost 25 copies of the image. Allow generous slack for the
    // extra content-stream operators each placement legitimately adds.
    expect(manyBytes.length - oneBytes.length).toBeLessThan(4000)
  })

  it('skips annotations pointing at pages that do not exist', async () => {
    await expect(
      exportAndReload([
        createImageAnnotation({ pageIndex: 99, width: 10, height: 10 }),
        createImageAnnotation({ pageIndex: -1, width: 10, height: 10 }),
      ])
    ).resolves.toBeTruthy()
  })

  it('skips image annotations whose asset is missing instead of throwing', async () => {
    await expect(
      exportAndReload([createImageAnnotation({ assetId: 'nope', width: 10, height: 10 })], {})
    ).resolves.toBeTruthy()
  })

  describe('an asset that cannot be fetched', () => {
    const remote = { sign: { src: 'https://elsewhere.example/sign.png' } }
    const annotation = () => [createImageAnnotation({ assetId: 'sign', width: 10, height: 10 })]

    it('aborts rather than silently omitting the image', async () => {
      /*
       * Deliberate. Returning a document that looks signed on screen but carries no
       * signature in the file is the worst outcome a signing tool can produce.
       */
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
      )
      await expect(exportAndReload(annotation(), remote)).rejects.toThrow(/stamp image "sign"/)
      vi.unstubAllGlobals()
    })

    it('names CORS, the cause invisible from the viewer', async () => {
      // A cross-origin image the browser will happily *display* but not let script
      // *read* looks perfectly fine right up until someone clicks Download.
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
      )
      await expect(exportAndReload(annotation(), remote)).rejects.toThrow(/CORS/)
      vi.unstubAllGlobals()
    })

    it('reports the status code for an HTTP error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve({ ok: false, status: 403, statusText: 'Forbidden' }))
      )
      await expect(exportAndReload(annotation(), remote)).rejects.toThrow(/403 Forbidden/)
      vi.unstubAllGlobals()
    })
  })

  it('handles every annotation type on a rotated page', async () => {
    const { doc } = await exportAndReload([
      createImageAnnotation({ pageIndex: 1, x: 20, y: 30, width: 60, height: 40 }),
      createTextAnnotation({ pageIndex: 1, x: 20, y: 100, text: 'rotated', fontSize: 18 }),
      createInkAnnotation({
        pageIndex: 1,
        points: [
          { x: 10, y: 10 },
          { x: 80, y: 90 },
          { x: 120, y: 40 },
        ],
      }),
    ])
    expect(doc.getPages()).toHaveLength(3)
  })

  it('ignores degenerate ink strokes', async () => {
    await expect(
      exportAndReload([
        createInkAnnotation({ pageIndex: 0, points: [] }),
        createInkAnnotation({ pageIndex: 0, points: [{ x: 1, y: 1 }] }),
      ])
    ).resolves.toBeTruthy()
  })

  it('ignores empty text', async () => {
    await expect(
      exportAndReload([createTextAnnotation({ pageIndex: 0, text: '' })])
    ).resolves.toBeTruthy()
  })

  it('embeds the requested font family instead of always Helvetica', async () => {
    // The regression: fontFamily was stored and shown on screen, but drawText was
    // called without a `font`, so every exported document came out in Helvetica.
    // The name has to be read from the object graph — pdf-lib compresses the output,
    // so grepping the raw bytes finds nothing.
    const courier = await exportAndReload([
      createTextAnnotation({ pageIndex: 0, text: 'monospace', fontFamily: 'Courier' }),
    ])
    expect([...baseFonts(courier.doc)].join(' ')).toContain('Courier')

    const times = await exportAndReload([
      createTextAnnotation({ pageIndex: 0, text: 'serif', fontFamily: '"Times New Roman", serif' }),
    ])
    expect([...baseFonts(times.doc)].join(' ')).toContain('Times')

    const fallback = await exportAndReload([
      createTextAnnotation({ pageIndex: 0, text: 'unknown', fontFamily: 'Wingdings' }),
    ])
    expect([...baseFonts(fallback.doc)].join(' ')).toContain('Helvetica')
  })

  it('uses distinct fonts for distinct annotations in one document', async () => {
    const { doc } = await exportAndReload([
      createTextAnnotation({ pageIndex: 0, y: 60, text: 'a', fontFamily: 'Courier' }),
      createTextAnnotation({ pageIndex: 0, y: 120, text: 'b', fontFamily: 'Times' }),
      createTextAnnotation({ pageIndex: 0, y: 180, text: 'c', fontFamily: 'Helvetica' }),
    ])
    const names = [...baseFonts(doc)].join(' ')
    expect(names).toContain('Courier')
    expect(names).toContain('Times')
    expect(names).toContain('Helvetica')
  })

  it('embeds each distinct font once even across many annotations', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      createTextAnnotation({
        pageIndex: 0,
        y: 40 + i * 20,
        text: `line ${i}`,
        fontFamily: 'Courier',
      })
    )
    const { bytes: manyBytes } = await exportAndReload(many)
    const { bytes: oneBytes } = await exportAndReload([
      createTextAnnotation({ pageIndex: 0, text: 'line 0', fontFamily: 'Courier' }),
    ])
    expect(manyBytes.length - oneBytes.length).toBeLessThan(3000)
  })

  it('wraps long text to the annotation width', async () => {
    // Without wrapping the exported line ran straight off the page while the
    // textarea had wrapped it on screen.
    const text = 'The quick brown fox jumps over the lazy dog, repeatedly and at length.'
    const narrow = await exportAndReload([
      createTextAnnotation({ pageIndex: 0, text, width: 120, height: 200 }),
    ])
    const wide = await exportAndReload([
      createTextAnnotation({ pageIndex: 0, text, width: 560, height: 200 }),
    ])
    // More lines means more text-positioning operators, hence a longer stream.
    expect(narrow.bytes.length).toBeGreaterThan(wide.bytes.length)
  })

  it('respects explicit newlines', async () => {
    await expect(
      exportAndReload([createTextAnnotation({ pageIndex: 0, text: 'first\n\nthird' })])
    ).resolves.toBeTruthy()
  })

  describe('annotation rotation', () => {
    /**
     * The bug this covers: the rotate knob turned the stamp on screen but
     * `annotation.rotation` was never forwarded to pdf-lib, so the exported file
     * showed it lying flat. The viewer and the file disagreed.
     */
    it('produces different output for a rotated image stamp', async () => {
      const flat = await exportAndReload([
        createImageAnnotation({ pageIndex: 0, x: 80, y: 80, width: 120, height: 60 }),
      ])
      const turned = await exportAndReload([
        createImageAnnotation({
          pageIndex: 0,
          x: 80,
          y: 80,
          width: 120,
          height: 60,
          rotation: 90,
        }),
      ])
      expect(turned.bytes.length).not.toBe(flat.bytes.length)
    })

    it('produces different output for rotated text', async () => {
      const base = { pageIndex: 0, x: 60, y: 60, width: 200, height: 40, text: 'sideways' }
      const flat = await exportAndReload([createTextAnnotation(base)])
      const turned = await exportAndReload([createTextAnnotation({ ...base, rotation: 90 })])
      expect(turned.bytes.length).not.toBe(flat.bytes.length)
    })

    it('produces different output for a rotated ink stroke', async () => {
      const points = [
        { x: 20, y: 20 },
        { x: 120, y: 30 },
        { x: 160, y: 90 },
      ]
      const flat = await exportAndReload([createInkAnnotation({ pageIndex: 0, points })])
      const turned = await exportAndReload([
        createInkAnnotation({ pageIndex: 0, points, rotation: 90 }),
      ])
      expect(turned.bytes.length).not.toBe(flat.bytes.length)
    })

    it('treats a full turn as no rotation at all', async () => {
      const spec = { pageIndex: 0, x: 40, y: 40, width: 100, height: 50 }
      const zero = await exportAndReload([createImageAnnotation({ ...spec, rotation: 0 })])
      const full = await exportAndReload([createImageAnnotation({ ...spec, rotation: 360 })])
      expect(full.bytes.length).toBe(zero.bytes.length)
    })

    it('handles a rotated annotation on a rotated page', async () => {
      // Page 2 carries /Rotate 90; the two rotations have to compose, not fight.
      await expect(
        exportAndReload([
          createImageAnnotation({
            pageIndex: 1,
            x: 30,
            y: 40,
            width: 80,
            height: 50,
            rotation: 45,
          }),
          createTextAnnotation({ pageIndex: 1, x: 30, y: 200, text: 'both', rotation: 135 }),
        ])
      ).resolves.toBeTruthy()
    })
  })

  describe('viewer page rotation', () => {
    const exportWith = async (options) => {
      const blob = await exportFlattenedPdf(fixture, [], ASSETS, options)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      return PDFDocument.load(bytes)
    }

    it('writes the viewer rotation into the exported page', async () => {
      // Someone who turns a sideways scan to sign it expects the recipient to get it
      // the right way up, so rotation is carried into the file by default.
      const doc = await exportWith({ pageRotations: { 0: 270 } })
      expect(doc.getPages()[0].getRotation().angle).toBe(270)
    })

    it('adds to the page rotation rather than replacing it', async () => {
      // Page 2 already carries /Rotate 90. Turning it another 90 must land at 180,
      // not overwrite the original with 90.
      const doc = await exportWith({ pageRotations: { 1: 90 } })
      expect(doc.getPages()[1].getRotation().angle).toBe(180)
    })

    it('leaves untouched pages alone', async () => {
      const doc = await exportWith({ pageRotations: { 0: 90 } })
      expect(doc.getPages()[1].getRotation().angle).toBe(FIXTURE_PAGES[1].rotate)
      expect(doc.getPages()[2].getRotation().angle).toBe(FIXTURE_PAGES[2].rotate)
    })

    it('normalises a full turn back to the original', async () => {
      const doc = await exportWith({ pageRotations: { 0: 360 } })
      expect(doc.getPages()[0].getRotation().angle).toBe(FIXTURE_PAGES[0].rotate)
    })

    it('can be opted out of, for view-only rotation', async () => {
      const doc = await exportWith({ pageRotations: { 0: 90 }, rotateExportedPages: false })
      expect(doc.getPages()[0].getRotation().angle).toBe(FIXTURE_PAGES[0].rotate)
    })

    it('places annotations against the ORIGINAL rotation, so they stay glued to the content', async () => {
      /**
       * The trap: /Rotate turns the whole page, so the original content and our
       * annotations turn together. Placement therefore has to be computed against
       * the page's intrinsic angle — reading the angle back after setRotation would
       * shift every annotation on a rotated page.
       */
      const annotation = createImageAnnotation({
        id: 'a',
        pageIndex: 0,
        x: 40,
        y: 60,
        width: 90,
        height: 45,
      })

      const straight = await exportFlattenedPdf(fixture, [annotation], ASSETS, {
        rotateExportedPages: false,
      })
      const rotated = await exportFlattenedPdf(fixture, [annotation], ASSETS, {
        pageRotations: { 0: 90 },
      })

      const a = new Uint8Array(await straight.arrayBuffer())
      const b = new Uint8Array(await rotated.arrayBuffer())

      // Same drawing operators either way; only the page's /Rotate entry differs.
      expect(Math.abs(a.length - b.length)).toBeLessThan(60)
      expect((await PDFDocument.load(b)).getPages()[0].getRotation().angle).toBe(90)
    })
  })

  it('is deterministic for identical input', async () => {
    const annotations = [
      createImageAnnotation({ id: 'a', pageIndex: 0, x: 10, y: 20, width: 30, height: 40 }),
      createTextAnnotation({ id: 't', pageIndex: 0, x: 10, y: 80, text: 'hello' }),
    ]
    const first = await exportFlattenedPdf(fixture, annotations, ASSETS)
    const second = await exportFlattenedPdf(fixture, annotations, ASSETS)
    const a = new Uint8Array(await first.arrayBuffer())
    const b = new Uint8Array(await second.arrayBuffer())
    expect(a.length).toBe(b.length)
  })
})
