import { rgb } from 'pdf-lib'

/**
 * Colour parsing for the pdf-lib export path.
 *
 * The old implementation defaulted invalid input to BLUE — a surprising choice that
 * silently turned a typo'd colour into a blue annotation in the exported file. Black
 * is the least surprising fallback for ink and text. Three-digit hex (#f00) is also
 * accepted now; previously it parsed as garbage rather than being rejected.
 */

const FALLBACK = Object.freeze({ r: 0, g: 0, b: 0 })

/**
 * Parse a hex colour into normalised 0..1 channels.
 *
 * @param {string} hex e.g. '#1a2b3c' or '#abc'
 * @returns {{r:number,g:number,b:number}} channels in 0..1, black if unparseable
 */
export function parseHex(hex) {
  if (typeof hex !== 'string') return FALLBACK

  const value = hex.trim().replace(/^#/, '')

  let full
  if (/^[0-9a-f]{3}$/i.test(value)) {
    full = value
      .split('')
      .map((c) => c + c)
      .join('')
  } else if (/^[0-9a-f]{6}$/i.test(value)) {
    full = value
  } else {
    return FALLBACK
  }

  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  }
}

/**
 * Parse a hex colour into a pdf-lib RGB value.
 *
 * @param {string} hex
 * @returns {import('pdf-lib').RGB}
 */
export function hexToRgb(hex) {
  const { r, g, b } = parseHex(hex)
  return rgb(r, g, b)
}
