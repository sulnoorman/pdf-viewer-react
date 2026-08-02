import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { generate, TARGET } from '../../../scripts/extract-pdfjs-css.mjs'

const root = resolve(import.meta.dirname, '../../..')

describe('extracted pdf.js layer CSS', () => {
  it('matches what the extractor produces from the installed pdfjs-dist', async () => {
    /**
     * The committed file is generated, not hand-written, precisely so it cannot go
     * stale in silence. If a pdfjs-dist upgrade changes the text or annotation layer
     * styling, this fails and the fix is `bun run css:extract` plus a visual check —
     * far better than the layers quietly rendering wrong.
     */
    const [committed, expected] = await Promise.all([
      readFile(resolve(root, TARGET), 'utf8'),
      generate(),
    ])
    expect(committed).toBe(expected)
  })

  it('keeps the layers this library renders', async () => {
    const css = await readFile(resolve(root, TARGET), 'utf8')
    expect(css).toContain('.textLayer')
    expect(css).toContain('.annotationLayer')
  })

  it('drops the pdf.js viewer chrome we do not render', async () => {
    // These are 81% of the original file: XFA forms, pdf.js's own annotation editor,
    // presentation mode, dialogs, comment popups.
    const css = await readFile(resolve(root, TARGET), 'utf8')
    for (const selector of ['.xfaLayer', '.annotationEditorLayer', '.pdfPresentationMode']) {
      expect(css).not.toContain(selector)
    }
  })

  it('references no assets the package does not ship', async () => {
    /**
     * pdf.js resolves `url(images/…)` against its own web/ folder. Leaving those in
     * made every consumer's build print "didn't resolve at build time" warnings for
     * icons belonging to pdf.js's annotation editor, which this library never renders.
     */
    const css = await readFile(resolve(root, TARGET), 'utf8')
    expect(css).not.toContain('url(images/')
  })

  it('stays far smaller than the full stylesheet', async () => {
    const [css, source] = await Promise.all([
      readFile(resolve(root, TARGET), 'utf8'),
      readFile(resolve(root, 'node_modules/pdfjs-dist/web/pdf_viewer.css'), 'utf8'),
    ])
    expect(css.length).toBeLessThan(source.length * 0.35)
  })
})
