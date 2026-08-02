import { describe, it, expect } from 'vitest'
import { parseHex, hexToRgb } from './color.js'

describe('parseHex', () => {
  it('parses six-digit hex', () => {
    expect(parseHex('#ffffff')).toEqual({ r: 1, g: 1, b: 1 })
    expect(parseHex('#000000')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('parses three-digit shorthand', () => {
    // Previously this fell through to the invalid branch.
    expect(parseHex('#f00')).toEqual(parseHex('#ff0000'))
    expect(parseHex('#abc')).toEqual(parseHex('#aabbcc'))
  })

  it('accepts uppercase and a missing hash', () => {
    expect(parseHex('#FF0000')).toEqual(parseHex('#ff0000'))
    expect(parseHex('ff0000')).toEqual(parseHex('#ff0000'))
  })

  it('trims surrounding whitespace', () => {
    expect(parseHex('  #00ff00  ')).toEqual(parseHex('#00ff00'))
  })

  it('falls back to BLACK, not blue, for unparseable input', () => {
    // The old hexToRgb returned rgb(0.145, 0.388, 0.921) — a typo silently produced
    // a blue annotation in the exported PDF.
    const black = { r: 0, g: 0, b: 0 }
    expect(parseHex('')).toEqual(black)
    expect(parseHex('#12')).toEqual(black)
    expect(parseHex('#12345')).toEqual(black)
    expect(parseHex('#gggggg')).toEqual(black)
    expect(parseHex('rebeccapurple')).toEqual(black)
    expect(parseHex(null)).toEqual(black)
    expect(parseHex(undefined)).toEqual(black)
    expect(parseHex(0xff0000)).toEqual(black)
  })

  it('normalises channels into 0..1', () => {
    const { r, g, b } = parseHex('#804020')
    expect(r).toBeCloseTo(128 / 255, 9)
    expect(g).toBeCloseTo(64 / 255, 9)
    expect(b).toBeCloseTo(32 / 255, 9)
  })
})

describe('hexToRgb', () => {
  it('produces a pdf-lib RGB value', () => {
    const color = hexToRgb('#336699')
    expect(color.type).toBe('RGB')
    expect(color.red).toBeCloseTo(0x33 / 255, 9)
    expect(color.green).toBeCloseTo(0x66 / 255, 9)
    expect(color.blue).toBeCloseTo(0x99 / 255, 9)
  })

  it('returns black for invalid input', () => {
    const color = hexToRgb('not a colour')
    expect(color.red).toBe(0)
    expect(color.green).toBe(0)
    expect(color.blue).toBe(0)
  })
})
