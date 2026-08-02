import { StandardFonts } from 'pdf-lib'

/**
 * Font handling for the export pipeline.
 *
 * `fontFamily` was stored on every text annotation and applied to the on-screen
 * textarea, but export called `drawText` without a `font`, so pdf-lib silently used
 * Helvetica for everything. A document typed in Courier came out in Helvetica.
 *
 * Only the 14 PDF standard fonts are supported. They need no embedding and are
 * guaranteed to render in every reader. Custom font embedding would mean shipping or
 * fetching font files, which is a much larger feature — see docs/LIMITATIONS.md.
 */

/**
 * The families offered in the UI. Values are CSS font stacks so the textarea and the
 * exported PDF agree about which typeface is being shown.
 */
export const SUPPORTED_FONTS = Object.freeze([
  { label: 'Helvetica', value: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
  { label: 'Times', value: 'Times', css: '"Times New Roman", Times, serif' },
  { label: 'Courier', value: 'Courier', css: '"Courier New", Courier, monospace' },
])

const FAMILY_TO_STANDARD = {
  helvetica: StandardFonts.Helvetica,
  arial: StandardFonts.Helvetica,
  'sans-serif': StandardFonts.Helvetica,
  times: StandardFonts.TimesRoman,
  'times new roman': StandardFonts.TimesRoman,
  timesroman: StandardFonts.TimesRoman,
  serif: StandardFonts.TimesRoman,
  courier: StandardFonts.Courier,
  'courier new': StandardFonts.Courier,
  monospace: StandardFonts.Courier,
}

/**
 * Resolve a CSS-ish family string to a pdf-lib standard font name.
 *
 * Accepts a full CSS stack ("Helvetica, Arial, sans-serif") and takes the first
 * entry it recognises, so a value that came straight from a `font-family` declaration
 * still resolves.
 *
 * @param {string} [fontFamily]
 * @returns {string} a StandardFonts value; Helvetica when nothing matches
 */
export function resolveStandardFont(fontFamily) {
  if (typeof fontFamily !== 'string' || !fontFamily.trim()) return StandardFonts.Helvetica

  for (const part of fontFamily.split(',')) {
    const key = part
      .trim()
      .replace(/^["']|["']$/g, '')
      .toLowerCase()
    if (FAMILY_TO_STANDARD[key]) return FAMILY_TO_STANDARD[key]
  }

  return StandardFonts.Helvetica
}

/**
 * The SUPPORTED_FONTS entry a stored family resolves to.
 *
 * Needed because StandardFonts values are not the same strings as the UI values
 * (`Times` maps to `Times-Roman`), so a select bound directly to the StandardFonts
 * name would never match one of its own options.
 */
export function resolveFontOption(fontFamily) {
  const standard = resolveStandardFont(fontFamily)
  return (
    SUPPORTED_FONTS.find((f) => resolveStandardFont(f.value) === standard) ?? SUPPORTED_FONTS[0]
  )
}

/** The UI value (a SUPPORTED_FONTS `value`) for a stored family. */
export function resolveFontValue(fontFamily) {
  return resolveFontOption(fontFamily).value
}

/** The CSS stack matching a stored family, for the on-screen textarea. */
export function resolveCssFontStack(fontFamily) {
  return resolveFontOption(fontFamily).css
}

/**
 * Break text to fit a box width, honouring explicit newlines.
 *
 * pdf-lib's drawText does not wrap: it splits on "\n" and nothing else, so a long
 * line ran straight off the page even though the textarea had wrapped it on screen.
 *
 * A single word wider than the box is emitted on its own line rather than being cut,
 * matching what the textarea does.
 *
 * @param {string} text
 * @param {{widthOfTextAtSize: (t: string, size: number) => number}} font
 * @param {number} fontSize
 * @param {number} maxWidth available width in PDF points; <= 0 disables wrapping
 * @returns {string[]} lines
 */
export function wrapText(text, font, fontSize, maxWidth) {
  const source = typeof text === 'string' ? text : ''
  const paragraphs = source.split('\n')
  if (!(maxWidth > 0)) return paragraphs

  const lines = []

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('')
      continue
    }

    let current = ''
    for (const word of paragraph.split(/(\s+)/)) {
      if (word === '') continue

      const candidate = current + word
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || current === '') {
        current = candidate
        continue
      }

      lines.push(current.trimEnd())
      // Leading whitespace at the start of a wrapped line reads as an indent.
      current = /^\s+$/.test(word) ? '' : word
    }

    lines.push(current.trimEnd())
  }

  return lines
}
