import { describe, it, expect } from 'vitest'
import { DEFAULT_LABELS, mergeLabels, formatLabel } from './labels.js'

describe('DEFAULT_LABELS', () => {
  it('is frozen, so a host cannot mutate the defaults for everyone', () => {
    expect(Object.isFrozen(DEFAULT_LABELS)).toBe(true)
  })

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries(DEFAULT_LABELS)) {
      expect(value, `label "${key}" is empty`).toBeTruthy()
    }
  })
})

describe('mergeLabels', () => {
  it('returns the defaults when nothing is supplied', () => {
    expect(mergeLabels()).toBe(DEFAULT_LABELS)
    expect(mergeLabels(null)).toBe(DEFAULT_LABELS)
    expect(mergeLabels('nope')).toBe(DEFAULT_LABELS)
  })

  it('overrides only the keys given', () => {
    const merged = mergeLabels({ download: 'Unduh', addStamp: 'Tambah Stempel' })
    expect(merged.download).toBe('Unduh')
    expect(merged.addStamp).toBe('Tambah Stempel')
    // Everything else stays English.
    expect(merged.undo).toBe(DEFAULT_LABELS.undo)
  })

  it('does not mutate the defaults', () => {
    const before = DEFAULT_LABELS.download
    mergeLabels({ download: 'Unduh' })
    expect(DEFAULT_LABELS.download).toBe(before)
  })

  it('ignores unknown keys instead of passing them through', () => {
    // A typo should not silently add a string nothing reads, leaving the real button
    // in English with no clue why.
    const merged = mergeLabels({ donwload: 'Unduh' })
    expect(merged).not.toHaveProperty('donwload')
    expect(merged.download).toBe(DEFAULT_LABELS.download)
  })

  it('ignores non-string values', () => {
    const merged = mergeLabels({ download: 42, undo: null, redo: { text: 'x' } })
    expect(merged.download).toBe(DEFAULT_LABELS.download)
    expect(merged.undo).toBe(DEFAULT_LABELS.undo)
    expect(merged.redo).toBe(DEFAULT_LABELS.redo)
  })

  it('supports a full translation', () => {
    const indonesian = Object.fromEntries(
      Object.keys(DEFAULT_LABELS).map((key) => [key, `id:${key}`])
    )
    const merged = mergeLabels(indonesian)
    for (const key of Object.keys(DEFAULT_LABELS)) {
      expect(merged[key]).toBe(`id:${key}`)
    }
  })
})

describe('formatLabel', () => {
  it('fills placeholders', () => {
    expect(formatLabel('Go to page {page}', { page: 7 })).toBe('Go to page 7')
    expect(formatLabel('Halaman {page} dari {total}', { page: 2, total: 9 })).toBe(
      'Halaman 2 dari 9'
    )
  })

  it('leaves unknown placeholders alone rather than printing undefined', () => {
    expect(formatLabel('Go to page {missing}', { page: 1 })).toBe('Go to page {missing}')
  })

  it('handles templates with no placeholders', () => {
    expect(formatLabel('Download', { page: 1 })).toBe('Download')
  })

  it('copes with a non-string template', () => {
    expect(formatLabel(undefined, {})).toBe('')
    expect(formatLabel(null, {})).toBe('')
  })
})
