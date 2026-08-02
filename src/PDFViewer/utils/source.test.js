import { describe, it, expect, vi, afterEach } from 'vitest'
import { normalizePdfSource, copyBytes } from './source.js'

const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]) // "%PDF-"

afterEach(() => {
  vi.restoreAllMocks()
})

describe('normalizePdfSource', () => {
  it('rejects an empty source', async () => {
    await expect(normalizePdfSource(undefined)).rejects.toThrow(/No PDF source/)
    await expect(normalizePdfSource('')).rejects.toThrow(/No PDF source/)
    await expect(normalizePdfSource(null)).rejects.toThrow(/No PDF source/)
  })

  it('fetches a URL string', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => BYTES.buffer.slice(0),
      })
    )
    const result = await normalizePdfSource('/doc.pdf')
    expect(Array.from(result)).toEqual(Array.from(BYTES))
    expect(fetch).toHaveBeenCalledWith('/doc.pdf')
  })

  it('surfaces an HTTP failure with its status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    )
    await expect(normalizePdfSource('/missing.pdf')).rejects.toThrow(/404 Not Found/)
  })

  it('passes a Uint8Array straight through', async () => {
    await expect(normalizePdfSource(BYTES)).resolves.toBe(BYTES)
  })

  it('wraps an ArrayBuffer', async () => {
    const result = await normalizePdfSource(BYTES.buffer.slice(0))
    expect(result).toBeInstanceOf(Uint8Array)
    expect(Array.from(result)).toEqual(Array.from(BYTES))
  })

  it('reads a Blob', async () => {
    const blob = new Blob([BYTES], { type: 'application/pdf' })
    const result = await normalizePdfSource(blob)
    expect(Array.from(result)).toEqual(Array.from(BYTES))
  })

  it('reads a File, so a file picker can be wired straight in', async () => {
    const file = new File([BYTES], 'scan.pdf', { type: 'application/pdf' })
    const result = await normalizePdfSource(file)
    expect(Array.from(result)).toEqual(Array.from(BYTES))
  })

  it('handles a typed-array view over a larger buffer', async () => {
    const backing = new Uint8Array([0, 0, ...BYTES, 0])
    const view = backing.subarray(2, 2 + BYTES.length)
    const result = await normalizePdfSource(view)
    expect(Array.from(result)).toEqual(Array.from(BYTES))
  })

  it('rejects anything else with an actionable message', async () => {
    await expect(normalizePdfSource(42)).rejects.toThrow(/Unsupported PDF source/)
    await expect(normalizePdfSource({})).rejects.toThrow(/Unsupported PDF source/)
  })
})

describe('copyBytes', () => {
  it('returns an independent copy', () => {
    const copy = copyBytes(BYTES)
    expect(Array.from(copy)).toEqual(Array.from(BYTES))
    expect(copy).not.toBe(BYTES)
    copy[0] = 0
    expect(BYTES[0]).toBe(0x25)
  })

  it('leaves the original usable after the copy is detached', () => {
    // The regression: pdf.js detaches the buffer it is given. Sharing one buffer with
    // the exporter made export fail with "detached ArrayBuffer" much later.
    const copy = copyBytes(BYTES)
    structuredClone(copy.buffer, { transfer: [copy.buffer] })
    expect(BYTES.byteLength).toBe(5)
    expect(Array.from(BYTES)).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d])
  })
})
