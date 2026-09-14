import { describe, it, expect, vi, afterEach } from 'vitest'
import { BundledBinaryDataFactory } from './binaryData.js'
import { resolvedAssetUrls } from './workerUrl.js'

/** Stand in for the network, recording what was asked for. */
function serve(bytes = new Uint8Array([1, 2, 3])) {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      calls.push(url)
      return { ok: true, arrayBuffer: async () => bytes.buffer }
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BundledBinaryDataFactory', () => {
  it('resolves a file by name rather than by concatenating a directory', async () => {
    /*
     * The reason this class exists, and the bug it replaces.
     *
     * pdf.js builds every asset URL as `${wasmUrl}${filename}`. A bundler copies assets
     * into the application's output under hashed names — `pdf.worker.min-DEtVeC4l.js` —
     * so a base directory plus a bare `jbig2.wasm` names a file that is not there. The
     * previous approach handed pdf.js a directory and shipped twice: it worked in dev,
     * where the dev server serves node_modules directly, and 404'd in every production
     * build, where the server answered with index.html and the stencil mask went black.
     */
    const calls = serve()
    const factory = new BundledBinaryDataFactory({})

    const bytes = await factory.fetch({ kind: 'wasmUrl', filename: 'jbig2.wasm' })

    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(resolvedAssetUrls['jbig2.wasm'])
  })

  it('resolves a standard font the same way', async () => {
    const calls = serve()
    await new BundledBinaryDataFactory({}).fetch({
      kind: 'standardFontDataUrl',
      filename: 'FoxitSerif.pfb',
    })
    expect(calls[0]).toBe(resolvedAssetUrls['FoxitSerif.pfb'])
  })

  it('lets a host serving its own copies win', async () => {
    // Matches how config.workerSrc behaves: an explicit setting always beats the bundle.
    const calls = serve()
    const factory = new BundledBinaryDataFactory({ wasmUrl: 'https://cdn.example.com/wasm/' })

    await factory.fetch({ kind: 'wasmUrl', filename: 'jbig2.wasm' })

    expect(calls[0]).toBe('https://cdn.example.com/wasm/jbig2.wasm')
  })

  it('explains a CMap request rather than failing opaquely', async () => {
    /*
     * CMaps are not shipped — they are another 1.5 MB and only documents using predefined
     * CJK encodings need them. pdf.js reports the miss as "Unable to load CMap data",
     * which names neither the cause nor the fix.
     */
    serve()
    const factory = new BundledBinaryDataFactory({})

    await expect(
      factory.fetch({ kind: 'cMapUrl', filename: 'Adobe-Japan1-UCS2.bcmap' })
    ).rejects.toThrow(/CMaps are not shipped.*config\.cMapUrl/s)
  })

  it('says what to do when the bundler failed to emit an asset', async () => {
    // The symptom this whole class exists to prevent, should it ever return: a 404 on a
    // file that is definitely in the package.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found' }))
    )
    const factory = new BundledBinaryDataFactory({})

    await expect(factory.fetch({ kind: 'wasmUrl', filename: 'jbig2.wasm' })).rejects.toThrow(
      /did not emit it.*config\.wasmUrl/s
    )
  })

  it('knows every file pdf.js can ask for', () => {
    // A missing entry is a black rectangle or a substituted font, never an exception, so
    // the map is checked rather than trusted.
    for (const name of ['jbig2.wasm', 'openjpeg.wasm', 'qcms_bg.wasm']) {
      expect(resolvedAssetUrls[name]).toBeTruthy()
    }
    const fonts = Object.keys(resolvedAssetUrls).filter((n) => !n.endsWith('.wasm'))
    expect(fonts).toHaveLength(14)
  })
})
