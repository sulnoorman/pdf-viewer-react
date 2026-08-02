/**
 * Extracts the only parts of pdf.js's stylesheet this library actually uses.
 *
 * `pdfjs-dist/web/pdf_viewer.css` is 160 kB, and importing it shipped a 233 kB
 * stylesheet — 81% of which styles pdf.js's own viewer chrome: XFA forms, its
 * annotation editor, presentation mode, dialogs, comment popups. We render only two
 * of its layers, so only those rules are needed.
 *
 * The result is written to a checked-in file rather than copied by hand, because a
 * hand-copy silently goes stale the next time pdfjs-dist changes its layer markup.
 * `pdfjsLayers.test.js` re-runs this extraction against the installed version and
 * fails if the committed file has drifted, so a pdfjs upgrade surfaces loudly.
 *
 *   bun run css:extract
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const SOURCE = 'node_modules/pdfjs-dist/web/pdf_viewer.css'
export const TARGET = 'src/PDFViewer/styles/pdfjs-layers.generated.css'

/** Selectors whose rules we keep. Everything else belongs to pdf.js's own UI. */
const KEEP = /(^|[\s,>+~])(:root|\.textLayer|\.annotationLayer)/

/**
 * Containers this library never renders.
 *
 * A rule like `.page:has(.annotationEditorLayer) .annotationLayer .editorAnnotation`
 * mentions a layer we do use, so KEEP matches it — but it also requires an ancestor
 * we never create, so it can never apply. Without this second filter those rules ride
 * along as dead weight.
 */
const DROP =
  /\.annotationEditorLayer|\.xfaLayer|\.pdfViewer|\.pdfPresentationMode|\.page:has|\.editToolbar/

const HEADER = `/*
 * GENERATED FILE — do not edit.
 *
 * Produced by scripts/extract-pdfjs-css.mjs from pdfjs-dist/web/pdf_viewer.css,
 * keeping only the .textLayer and .annotationLayer rules this library renders.
 * Regenerate with:  bun run css:extract
 */
`

/**
 * Split a stylesheet into top-level blocks and keep the ones we need.
 * A brace counter is enough here: the source has no strings containing braces.
 */
export function extractLayerCss(css) {
  const blocks = []
  let depth = 0
  let blockStart = 0

  for (let i = 0; i < css.length; i += 1) {
    const char = css[i]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        blocks.push(css.slice(blockStart, i + 1).trim())
        blockStart = i + 1
      }
    }
  }

  const kept = blocks.filter((block) => {
    const selector = block.slice(0, block.indexOf('{'))
    return KEEP.test(selector) && !DROP.test(selector)
  })

  return `${HEADER}\n${stripBundlerRelativeAssets(kept.join('\n\n'))}\n`
}

/**
 * Remove declarations pointing at `images/…`, which pdf.js resolves relative to its own
 * `web/` folder.
 *
 * Those files are not shipped with this package, so every consumer's build printed
 * "images/cursor-editorInk.svg didn't resolve at build time" — five warnings for icons
 * belonging to pdf.js's annotation editor, which this library never renders.
 *
 * Only variable definitions are affected. The one place that reads them,
 * `.textLayer.highlighting`, is pdf.js's highlight-editing mode and is never activated
 * here; even if it were, an undefined cursor variable falls back to the default cursor.
 */
function stripBundlerRelativeAssets(css) {
  return css
    .split('\n')
    .filter((line) => !line.includes('url(images/'))
    .join('\n')
}

export async function generate() {
  const css = await readFile(resolve(root, SOURCE), 'utf8')
  return extractLayerCss(css)
}

// Only write when run directly, so the test can import the generator.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const output = await generate()
  const target = resolve(root, TARGET)
  await writeFile(target, output)

  const source = await readFile(resolve(root, SOURCE), 'utf8')
  console.log(
    `Wrote ${TARGET}: ${(output.length / 1024).toFixed(1)} kB ` +
      `(from ${(source.length / 1024).toFixed(1)} kB, ` +
      `${Math.round((1 - output.length / source.length) * 100)}% dropped)`
  )
}
