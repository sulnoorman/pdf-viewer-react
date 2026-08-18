import { describe, it, expect } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const styles = resolve(import.meta.dirname)

/**
 * The viewer must be a single layer as far as the host page is concerned.
 *
 * This is guarded because the declaration that achieves it is one line, looks decorative,
 * and its absence is invisible: everything renders correctly until a consumer puts a
 * sticky navbar or a modal over the viewer, at which point a selected annotation paints
 * straight through it and no amount of z-index on their side helps.
 *
 * Same reasoning as the `?url` guard in utils/worker.test.js — a property whose only
 * evidence of working is a bug that does not happen.
 */
describe('stacking containment', () => {
  it('makes the viewer shell a stacking context', async () => {
    const css = await readFile(resolve(styles, 'PDFViewer.module.css'), 'utf8')
    const shell = css.slice(css.indexOf('.shell'), css.indexOf('.body'))
    expect(shell).toMatch(/isolation:\s*isolate/)
  })

  it('keeps every internal z-index at or below 50', async () => {
    /*
     * Not an arbitrary ceiling. The shell's stacking context contains these values, so
     * their absolute size does not matter to a host — but a much larger number is a sign
     * someone was fighting the symptom of a leak rather than relying on the containment,
     * and would break again the moment the isolation were removed.
     */
    const offenders = []
    for (const file of await collectStylesheets(styles)) {
      // The extracted pdf.js layer CSS is generated from pdfjs-dist; not ours to police.
      if (file.includes('pdfjs-layers.generated')) continue

      const css = await readFile(file, 'utf8')
      for (const [, value] of css.matchAll(/z-index:\s*(-?\d+)/g)) {
        if (Number(value) > 50) offenders.push(`${file}: z-index: ${value}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

async function collectStylesheets(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await collectStylesheets(full)))
    else if (entry.name.endsWith('.css')) files.push(full)
  }
  return files
}
