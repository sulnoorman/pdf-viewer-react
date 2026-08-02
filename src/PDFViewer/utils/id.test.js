import { describe, it, expect, vi, afterEach } from 'vitest'
import { createId, __resetIdCounter } from './id.js'

afterEach(() => {
  vi.restoreAllMocks()
  __resetIdCounter()
})

describe('createId', () => {
  it('prefixes the id with the annotation type', () => {
    expect(createId('image')).toMatch(/^image-/)
    expect(createId('text')).toMatch(/^text-/)
    expect(createId('ink')).toMatch(/^ink-/)
  })

  it('defaults the prefix', () => {
    expect(createId()).toMatch(/^ann-/)
  })

  it('never collides in bulk', () => {
    const ids = Array.from({ length: 5000 }, () => createId('ink'))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('stays unique within a single millisecond without crypto.randomUUID', () => {
    // This is the exact regression: `${prefix}-${Date.now()}` produced duplicate ids
    // for annotations created in the same tick, e.g. paste-multiple.
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const original = globalThis.crypto?.randomUUID
    if (original) vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(undefined)

    // Force the counter branch by removing randomUUID entirely.
    const cryptoRef = globalThis.crypto
    const spy = vi.spyOn(globalThis, 'crypto', 'get').mockReturnValue({
      ...cryptoRef,
      randomUUID: undefined,
    })

    const ids = Array.from({ length: 100 }, () => createId('text'))
    expect(new Set(ids).size).toBe(100)

    spy.mockRestore()
  })
})
