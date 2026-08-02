import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'

/**
 * Pages of the shared test fixture.
 *
 * The mix is deliberate — it is the minimum needed to catch the two classes of
 * silent wrongness this project has historically had:
 *   - page 1: plain A4, the happy path
 *   - page 2: A4 with /Rotate 90, which export used to place annotations wrongly
 *   - page 3: a different page size, which zoom-fit used to ignore (it only ever
 *             measured page 1)
 */
export const FIXTURE_PAGES = [
  { width: 595.28, height: 841.89, rotate: 0, label: 'Page 1 - A4 portrait, no rotation' },
  { width: 595.28, height: 841.89, rotate: 90, label: 'Page 2 - A4 with /Rotate 90' },
  { width: 400, height: 300, rotate: 0, label: 'Page 3 - 400x300 landscape' },
]

/**
 * Builds the fixture PDF in memory. No file I/O, so unit tests can call it directly.
 *
 * Each page carries an origin marker at the top-left of its *displayed* orientation
 * plus a centre crosshair, giving golden export tests fixed reference points.
 *
 * @returns {Promise<Uint8Array>} the serialized PDF
 */
export async function createFixturePdf() {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle('react-pdf-viewer-stamping test fixture')
  pdfDoc.setProducer('scripts/make-fixture.mjs')
  // Fixed dates keep the output byte-stable across runs.
  pdfDoc.setCreationDate(new Date(0))
  pdfDoc.setModificationDate(new Date(0))

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (const spec of FIXTURE_PAGES) {
    const page = pdfDoc.addPage([spec.width, spec.height])
    if (spec.rotate) page.setRotation(degrees(spec.rotate))

    // Border around the MediaBox.
    page.drawRectangle({
      x: 4,
      y: 4,
      width: spec.width - 8,
      height: spec.height - 8,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    })

    // Origin marker: a filled square at the bottom-left of *unrotated* user space.
    page.drawRectangle({ x: 0, y: 0, width: 24, height: 24, color: rgb(0.9, 0.2, 0.2) })

    // Centre crosshair.
    const cx = spec.width / 2
    const cy = spec.height / 2
    page.drawLine({
      start: { x: cx - 20, y: cy },
      end: { x: cx + 20, y: cy },
      color: rgb(0.2, 0.4, 0.9),
      thickness: 1,
    })
    page.drawLine({
      start: { x: cx, y: cy - 20 },
      end: { x: cx, y: cy + 20 },
      color: rgb(0.2, 0.4, 0.9),
      thickness: 1,
    })

    page.drawText(spec.label, {
      x: 36,
      y: spec.height - 48,
      size: 12,
      font,
      color: rgb(0.1, 0.1, 0.1),
    })
  }

  return pdfDoc.save()
}
