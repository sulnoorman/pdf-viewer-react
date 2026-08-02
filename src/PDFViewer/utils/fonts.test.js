import { describe, it, expect, beforeAll } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import {
  resolveStandardFont,
  resolveCssFontStack,
  resolveFontValue,
  wrapText,
  SUPPORTED_FONTS,
} from './fonts.js'

describe('resolveStandardFont', () => {
  it('maps the supported families', () => {
    expect(resolveStandardFont('Helvetica')).toBe(StandardFonts.Helvetica)
    expect(resolveStandardFont('Times')).toBe(StandardFonts.TimesRoman)
    expect(resolveStandardFont('Courier')).toBe(StandardFonts.Courier)
  })

  it('is case insensitive', () => {
    expect(resolveStandardFont('COURIER')).toBe(StandardFonts.Courier)
    expect(resolveStandardFont('times new roman')).toBe(StandardFonts.TimesRoman)
  })

  it('reads the first recognised entry of a CSS stack', () => {
    // This is what the textarea's font-family actually looks like.
    expect(resolveStandardFont('"Courier New", Courier, monospace')).toBe(StandardFonts.Courier)
    expect(resolveStandardFont('Helvetica, Arial, sans-serif')).toBe(StandardFonts.Helvetica)
    expect(resolveStandardFont('Comic Sans MS, monospace')).toBe(StandardFonts.Courier)
  })

  it('maps generic families', () => {
    expect(resolveStandardFont('serif')).toBe(StandardFonts.TimesRoman)
    expect(resolveStandardFont('monospace')).toBe(StandardFonts.Courier)
    expect(resolveStandardFont('sans-serif')).toBe(StandardFonts.Helvetica)
  })

  it('falls back to Helvetica for anything unknown or missing', () => {
    expect(resolveStandardFont('Wingdings')).toBe(StandardFonts.Helvetica)
    expect(resolveStandardFont('')).toBe(StandardFonts.Helvetica)
    expect(resolveStandardFont(undefined)).toBe(StandardFonts.Helvetica)
    expect(resolveStandardFont(null)).toBe(StandardFonts.Helvetica)
    expect(resolveStandardFont(123)).toBe(StandardFonts.Helvetica)
  })
})

describe('resolveCssFontStack', () => {
  it('round-trips every supported font', () => {
    for (const font of SUPPORTED_FONTS) {
      // What the textarea renders must resolve to the same PDF font on export.
      expect(resolveStandardFont(resolveCssFontStack(font.value))).toBe(
        resolveStandardFont(font.value)
      )
    }
  })

  it('falls back to the first supported stack', () => {
    expect(resolveCssFontStack('Wingdings')).toBe(SUPPORTED_FONTS[0].css)
  })
})

describe('resolveFontValue', () => {
  it('returns a value that exists in the option list', () => {
    // A select bound to the StandardFonts name would never match its own options,
    // because StandardFonts.TimesRoman is the string "Times-Roman", not "Times".
    const values = SUPPORTED_FONTS.map((f) => f.value)
    for (const input of ['Helvetica', 'Times', 'Courier', 'Wingdings', undefined]) {
      expect(values).toContain(resolveFontValue(input))
    }
  })

  it('round-trips each supported option', () => {
    for (const font of SUPPORTED_FONTS) {
      expect(resolveFontValue(font.value)).toBe(font.value)
      expect(resolveFontValue(font.css)).toBe(font.value)
    }
  })

  it('maps a CSS stack back to its option', () => {
    expect(resolveFontValue('"Courier New", Courier, monospace')).toBe('Courier')
    expect(resolveFontValue('"Times New Roman", Times, serif')).toBe('Times')
  })
})

describe('wrapText', () => {
  let helvetica

  beforeAll(async () => {
    const doc = await PDFDocument.create()
    helvetica = await doc.embedFont(StandardFonts.Helvetica)
  })

  const widthOf = (line, size = 12) => helvetica.widthOfTextAtSize(line, size)

  it('returns a single line when it fits', () => {
    expect(wrapText('hello world', helvetica, 12, 500)).toEqual(['hello world'])
  })

  it('honours explicit newlines', () => {
    expect(wrapText('one\ntwo\nthree', helvetica, 12, 500)).toEqual(['one', 'two', 'three'])
  })

  it('preserves blank lines', () => {
    expect(wrapText('a\n\nb', helvetica, 12, 500)).toEqual(['a', '', 'b'])
  })

  it('wraps a long line so every line fits the box', () => {
    // The regression: drawText never wrapped, so long text ran off the page even
    // though the textarea had wrapped it on screen.
    const text = 'The quick brown fox jumps over the lazy dog again and again and again'
    const maxWidth = 120
    const lines = wrapText(text, helvetica, 12, maxWidth)

    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) {
      expect(widthOf(line)).toBeLessThanOrEqual(maxWidth)
    }
  })

  it('does not lose or duplicate any word', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda'
    const lines = wrapText(text, helvetica, 12, 90)
    expect(lines.join(' ').split(/\s+/).filter(Boolean)).toEqual(text.split(' '))
  })

  it('gives an over-wide single word its own line rather than truncating it', () => {
    const lines = wrapText('short Supercalifragilisticexpialidocious end', helvetica, 12, 60)
    expect(lines).toContain('Supercalifragilisticexpialidocious')
  })

  it('does not indent wrapped lines with leftover whitespace', () => {
    const lines = wrapText('aaaa bbbb cccc dddd eeee ffff', helvetica, 12, 50)
    for (const line of lines) {
      expect(line).toBe(line.trim())
    }
  })

  it('skips wrapping when no usable width is given', () => {
    const long = 'a '.repeat(200).trim()
    expect(wrapText(long, helvetica, 12, 0)).toEqual([long])
    expect(wrapText(long, helvetica, 12, -5)).toEqual([long])
  })

  it('handles empty and non-string input', () => {
    expect(wrapText('', helvetica, 12, 100)).toEqual([''])
    expect(wrapText(undefined, helvetica, 12, 100)).toEqual([''])
  })
})
