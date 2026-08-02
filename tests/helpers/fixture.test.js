import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { createFixturePdf, FIXTURE_PAGES } from './fixture.js'

describe('test fixture PDF', () => {
  it('produces a loadable PDF with the expected page geometry', async () => {
    const bytes = await createFixturePdf()
    expect(bytes.byteLength).toBeGreaterThan(0)

    const doc = await PDFDocument.load(bytes)
    const pages = doc.getPages()
    expect(pages).toHaveLength(FIXTURE_PAGES.length)

    pages.forEach((page, i) => {
      const spec = FIXTURE_PAGES[i]
      const { width, height } = page.getSize()
      // getSize() reports the unrotated MediaBox — the very thing export used to
      // conflate with the displayed size on /Rotate pages.
      expect(width).toBeCloseTo(spec.width, 2)
      expect(height).toBeCloseTo(spec.height, 2)
      expect(page.getRotation().angle).toBe(spec.rotate)
    })
  })

  it('covers the cases that regression-test rotation and mixed page sizes', () => {
    expect(FIXTURE_PAGES.some((p) => p.rotate === 90)).toBe(true)
    const distinctSizes = new Set(FIXTURE_PAGES.map((p) => `${p.width}x${p.height}`))
    expect(distinctSizes.size).toBeGreaterThan(1)
  })

  it('is byte-stable across runs so golden tests do not flake', async () => {
    const [a, b] = await Promise.all([createFixturePdf(), createFixturePdf()])
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})
