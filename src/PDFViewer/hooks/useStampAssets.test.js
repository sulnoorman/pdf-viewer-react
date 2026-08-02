import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStampAssets } from './useStampAssets.js'

let created = []
let revoked = []

beforeEach(() => {
  created = []
  revoked = []
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((file) => {
      const url = `blob:mock/${created.length}-${file?.name ?? 'blob'}`
      created.push(url)
      return url
    }),
    revokeObjectURL: vi.fn((url) => revoked.push(url)),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const makeFile = (name = 'signature.png') =>
  new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })

describe('useStampAssets', () => {
  it('is empty when nothing is configured', () => {
    const { result } = renderHook(() => useStampAssets({}))
    expect(result.current.list).toEqual([])
    expect(result.current.assets).toEqual({})
  })

  it('keeps the legacy single specimenAsset working', () => {
    // The original API. Existing integrations must not have to change.
    const { result } = renderHook(() => useStampAssets({ specimenAsset: '/sign.png' }))
    expect(result.current.assets.default.src).toBe('/sign.png')
    expect(result.current.list).toHaveLength(1)
  })

  it('accepts an object map of assets', () => {
    const { result } = renderHook(() =>
      useStampAssets({ stampAssets: { seal: '/seal.png', sign: '/sign.png' } })
    )
    expect(result.current.list.map((a) => a.id).sort()).toEqual(['seal', 'sign'])
    expect(result.current.assets.seal.src).toBe('/seal.png')
  })

  it('accepts an array of descriptors with labels', () => {
    const { result } = renderHook(() =>
      useStampAssets({
        stampAssets: [{ id: 'seal', label: 'Company seal', src: '/seal.png' }],
      })
    )
    expect(result.current.list[0]).toMatchObject({ id: 'seal', label: 'Company seal' })
  })

  it('skips malformed entries rather than producing a broken stamp', () => {
    const { result } = renderHook(() =>
      useStampAssets({
        stampAssets: [{ id: 'ok', src: '/ok.png' }, { id: 'no-src' }, { src: '/no-id.png' }, null],
      })
    )
    expect(result.current.list.map((a) => a.id)).toEqual(['ok'])
  })

  it('lets an explicit "default" entry win over specimenAsset', () => {
    const { result } = renderHook(() =>
      useStampAssets({
        specimenAsset: '/legacy.png',
        stampAssets: { default: '/modern.png' },
      })
    )
    expect(result.current.assets.default.src).toBe('/modern.png')
  })

  describe('upload', () => {
    it('registers the file and returns its new id', async () => {
      const { result } = renderHook(() => useStampAssets({}))

      let id
      await act(async () => {
        id = await result.current.addUploadedAsset(makeFile())
      })

      expect(id).toBeTruthy()
      expect(result.current.list.map((a) => a.id)).toContain(id)
      expect(result.current.assets[id].label).toBe('signature.png')
    })

    it('keeps the bytes, so export never re-reads a blob URL', async () => {
      // A blob URL can be released by the browser before export runs; the bytes are
      // handed straight to pdf-lib instead.
      const { result } = renderHook(() => useStampAssets({}))

      let id
      await act(async () => {
        id = await result.current.addUploadedAsset(makeFile())
      })

      const asset = result.current.assets[id]
      expect(asset.bytes.byteLength).toBe(3)
      expect(asset.mimeType).toBe('image/png')
      expect(asset.src).toMatch(/^blob:/)
    })

    it('gives every upload a distinct id, even with the same filename', async () => {
      const { result } = renderHook(() => useStampAssets({}))

      let first
      let second
      await act(async () => {
        first = await result.current.addUploadedAsset(makeFile('same.png'))
        second = await result.current.addUploadedAsset(makeFile('same.png'))
      })

      expect(first).not.toBe(second)
      expect(result.current.list).toHaveLength(2)
    })

    it('ignores a missing file', async () => {
      const { result } = renderHook(() => useStampAssets({}))
      let id
      await act(async () => {
        id = await result.current.addUploadedAsset(null)
      })
      expect(id).toBeNull()
      expect(result.current.list).toEqual([])
    })

    it('coexists with host-provided assets', async () => {
      const { result } = renderHook(() => useStampAssets({ specimenAsset: '/sign.png' }))

      await act(async () => {
        await result.current.addUploadedAsset(makeFile())
      })

      expect(result.current.list).toHaveLength(2)
      expect(result.current.assets.default.src).toBe('/sign.png')
    })

    it('revokes every object URL on unmount', async () => {
      // Leaking these keeps the full image alive for the lifetime of the tab.
      const { result, unmount } = renderHook(() => useStampAssets({}))

      await act(async () => {
        await result.current.addUploadedAsset(makeFile('a.png'))
        await result.current.addUploadedAsset(makeFile('b.png'))
      })

      expect(created).toHaveLength(2)
      unmount()
      expect(revoked.sort()).toEqual(created.sort())
    })
  })
})
