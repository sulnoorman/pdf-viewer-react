import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as pdfjsLib from 'pdfjs-dist'
import {
  configureWorker,
  describeWorkerFailure,
  correctOptimizedDepUrl,
  resolveAssetUrls,
} from './worker.js'

describe('configureWorker', () => {
  let warn

  beforeEach(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    pdfjsLib.GlobalWorkerOptions.workerPort = null
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('applies an explicit workerSrc', () => {
    configureWorker({ workerSrc: '/worker.mjs' })
    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('/worker.mjs')
    expect(warn).not.toHaveBeenCalled()
  })

  it('prefers a workerPort over a workerSrc', () => {
    const port = new Worker('/worker.mjs')
    configureWorker({ workerSrc: '/worker.mjs', workerPort: port })
    expect(pdfjsLib.GlobalWorkerOptions.workerPort).toBe(port)
    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('')
  })

  it('leaves an already-configured global worker alone', () => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/preset.mjs'
    configureWorker({})
    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('/preset.mjs')
    expect(warn).not.toHaveBeenCalled()
  })

  it('is idempotent across repeated renders', () => {
    configureWorker({ workerSrc: '/worker.mjs' })
    configureWorker({ workerSrc: '/worker.mjs' })
    configureWorker({ workerSrc: '/worker.mjs' })
    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('/worker.mjs')
  })

  it('falls back to the worker bundled in the package', () => {
    // The whole point of shipping one: a host that configures nothing still gets a
    // working viewer, rather than a document that silently never loads.
    configureWorker({})
    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toMatch(/pdf.worker.min.js$/)
    expect(warn).not.toHaveBeenCalled()
  })

  it('lets an explicit workerSrc win over the bundled one', () => {
    // Self-hosting the worker, or pointing at a CDN, must still be possible.
    configureWorker({ workerSrc: '/mine.mjs' })
    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('/mine.mjs')
  })
})

describe('describeWorkerFailure', () => {
  it('names both real causes, not just one', () => {
    /*
     * pdf.js says only "Setting up fake worker failed: error loading dynamically imported
     * module: …". This message used to blame Vite's dep optimizer alone, and sent a team
     * looking there while the actual cause was nginx serving the worker as
     * application/octet-stream — a file that downloaded perfectly every time.
     */
    const message = describeWorkerFailure(
      new Error('Setting up fake worker failed: "error loading dynamically imported module".')
    )
    expect(message).toContain('404')
    expect(message).toContain('optimizeDeps')
    expect(message).toContain('Content-Type')
    expect(message).toContain('workerSrc')
  })

  it('leaves unrelated load errors exactly as they were', () => {
    // A 404 on the document itself must still read as a 404, not as a worker problem.
    const original = 'Failed to fetch PDF (404 Not Found)'
    expect(describeWorkerFailure(new Error(original))).toBe(original)
  })

  it('survives a thrown value that is not an Error', () => {
    expect(describeWorkerFailure(undefined)).toBe('')
  })
})

describe('the bundled worker URL', () => {
  it('is resolved relative to the module, not to a bare pdfjs-dist specifier', async () => {
    /*
     * This is what makes zero-config work on both Vite and webpack 5.
     *
     * `new URL('pdfjs-dist/build/…', import.meta.url)` — a bare specifier — is resolved
     * by webpack but NOT by Vite; `?url` imports are Vite-only. A path relative to one of
     * our own modules is the only form both understand, which is why the worker ships
     * inside this package instead of being read out of pdfjs-dist at runtime.
     */
    const code = await readWorkerUrlCode()
    expect(code).toContain("new URL('./pdf.worker.min.js', import.meta.url)")
    expect(code).not.toContain('pdfjs-dist')
  })

  it('names every asset file, never a directory', async () => {
    /*
     * The guard for a bug that shipped twice and only ever failed in production.
     *
     * A bundler emits a **file** it sees referenced here, copying it into the application's
     * build output. A **directory** gives it nothing to emit, so nothing is copied and the
     * URL points at a folder that was never created. `new URL('./wasm/', import.meta.url)`
     * therefore worked in dev — where the dev server serves node_modules directly — and
     * failed in every production build, where pdf.js asked for the wasm and the server
     * answered with index.html.
     */
    const code = await readWorkerUrlCode()

    for (const url of code.match(/new URL\('([^']+)'/g) ?? []) {
      expect(url).not.toMatch(/\/'$/)
    }

    // The three decoders, by name. Fonts are asserted wholesale below.
    expect(code).toContain("new URL('./wasm/jbig2.wasm', import.meta.url)")
    expect(code).toContain("new URL('./wasm/openjpeg.wasm', import.meta.url)")
    expect(code).toContain("new URL('./wasm/qcms_bg.wasm', import.meta.url)")
  })

  it('names every file pdfjs-dist actually ships, so none is silently dropped', async () => {
    /*
     * Reads the installed pdfjs-dist rather than a list copied into the test: an upgrade
     * that adds a font or renames a decoder must fail here, not in a user's document.
     */
    const code = await readWorkerUrlCode()
    const pdfjs = resolve(import.meta.dirname, '../../../node_modules/pdfjs-dist')

    const shipped = [
      ...(await readdir(resolve(pdfjs, 'wasm')))
        .filter((f) => f.endsWith('.wasm') && f !== 'quickjs-eval.wasm')
        .map((f) => `./wasm/${f}`),
      ...(await readdir(resolve(pdfjs, 'standard_fonts')))
        .filter((f) => !f.startsWith('LICENSE'))
        .map((f) => `./standard_fonts/${f}`),
    ]

    for (const path of shipped) {
      expect(code).toContain(`new URL('${path}', import.meta.url)`)
    }
  })

  it('holds no logic of its own, being the one untested module', async () => {
    /*
     * It is external to the bundle and cannot be unit-tested, so anything it got wrong
     * would only surface in a consumer's app. Every line is one export of one URL
     * expression — no branches, no conditionals, nothing that could behave differently
     * there than here. Correcting these URLs belongs in worker.js, which is tested.
     */
    const code = await readWorkerUrlCode()
    expect(code).not.toMatch(/\b(if|for|while|function|return|=>)\b/)
    expect(code).not.toMatch(/[?]{1,2}|&&|\|\|/)
  })
})

describe('correctOptimizedDepUrl', () => {
  it("rewrites the path Vite's dev optimizer produces", () => {
    /*
     * Vite pre-bundles dependencies into node_modules/.vite/deps/, which relocates
     * import.meta.url out of the package — and does not copy the worker with it. The
     * result is a 404 and pdf.js's opaque "Setting up fake worker failed".
     *
     * Production builds never hit this. It cost a round of "works in build, broken in
     * dev" to find, so the mapping is pinned here.
     */
    expect(
      correctOptimizedDepUrl('http://localhost:5173/node_modules/.vite/deps/pdf.worker.min.js')
    ).toBe('http://localhost:5173/node_modules/@armsolusi/pdf-viewer/dist/pdf.worker.min.js')
  })

  it('preserves a base path', () => {
    // Real report came from an app served under /service/prepare-sharing/.
    expect(
      correctOptimizedDepUrl('http://localhost:5174/service/app/node_modules/.vite/deps/pdf.worker.min.js')
    ).toBe('http://localhost:5174/service/app/node_modules/@armsolusi/pdf-viewer/dist/pdf.worker.min.js')
  })

  it('leaves a production asset URL untouched', () => {
    // There the bundler already emitted a real file next to the app's other assets.
    const built = 'https://example.com/assets/pdf.worker.min-DEtVeC4l.js'
    expect(correctOptimizedDepUrl(built)).toBe(built)
  })

  it('leaves an unrecognised layout alone rather than guessing', () => {
    const odd = 'http://localhost:3000/some/other/place/pdf.worker.min.js'
    expect(correctOptimizedDepUrl(odd)).toBe(odd)
  })

  it('survives a missing URL', () => {
    expect(correctOptimizedDepUrl(undefined)).toBeUndefined()
  })

  it('relocates the decoder and font directories too, not just the worker', () => {
    /*
     * The worker was the only relocated asset for long enough that this function was
     * written around its filename. pdf.js v6 also fetches its image decoders and standard
     * fonts at runtime, and Vite's optimizer moves those URLs exactly the same way — but
     * their failure is quieter: a CCITT stencil whose decoder never loads is not skipped,
     * it is painted in full, so a scanned logo becomes a solid black rectangle.
     */
    const base = 'http://localhost:5173/node_modules/'
    expect(correctOptimizedDepUrl(`${base}.vite/deps/wasm/`, 'wasm/')).toBe(
      `${base}@armsolusi/pdf-viewer/dist/wasm/`
    )
    expect(correctOptimizedDepUrl(`${base}.vite/deps/standard_fonts/`, 'standard_fonts/')).toBe(
      `${base}@armsolusi/pdf-viewer/dist/standard_fonts/`
    )
  })
})

describe('resolveAssetUrls', () => {
  /*
   * Only a host's own directories travel as URLs now. The package's own assets are
   * resolved per file by utils/binaryData.js, because a bundler renames what it emits and
   * pdf.js's own  cannot survive that.
   */
  it('passes nothing when the host configured nothing', () => {
    expect(resolveAssetUrls()).toEqual({});
    expect(resolveAssetUrls({})).toEqual({});
  });

  it('forwards what the host supplied', () => {
    expect(
      resolveAssetUrls({
        wasmUrl: 'https://cdn.example.com/pdfjs/wasm/',
        standardFontDataUrl: 'https://cdn.example.com/pdfjs/fonts/',
      })
    ).toEqual({
      wasmUrl: 'https://cdn.example.com/pdfjs/wasm/',
      standardFontDataUrl: 'https://cdn.example.com/pdfjs/fonts/',
    });
  });

  it('adds the trailing slash a host left off', () => {
    // pdf.js concatenates the filename straight on, and getFactoryUrlProp rejects a URL
    // without a slash outright.
    expect(resolveAssetUrls({ wasmUrl: 'https://cdn.example.com/wasm' })).toEqual({
      wasmUrl: 'https://cdn.example.com/wasm/',
    });
  });

  it('carries one option without inventing the other', () => {
    expect(resolveAssetUrls({ wasmUrl: '/my/wasm/' })).toEqual({ wasmUrl: '/my/wasm/' });
  });
});

describe('source hygiene', () => {
  it('never imports an asset with ?url, which Vite would inline', async () => {
    /*
     * The regression that cost the most to find: `import x from '…?url'` anywhere in
     * src/ makes Vite library mode base64-inline the 1.2 MB worker into the published
     * bundle, ignoring assetsInlineLimit. It took the package from 36 kB to 1.7 MB.
     *
     * workerUrl.js is external in vite.config.js and copied into dist/ verbatim, so the
     * URL expression is resolved by the consumer's bundler instead of ours.
     */
    const files = await collectSourceFiles(resolve(import.meta.dirname, '..'))
    const offenders = []
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      // Anchored at the line start so the `?url` example quoted in this module's own
      // fallback warning — indented inside a string — is not mistaken for an import.
      if (/^import\s[^\n]*\?url['"]/m.test(source)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})

/** workerUrl.js with its comments stripped — they discuss the forms that do NOT work. */
async function readWorkerUrlCode() {
  const source = await readFile(resolve(import.meta.dirname, 'workerUrl.js'), 'utf8')
  return source
    .split('\n')
    .filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line) && line.trim())
    .join('\n')
}

/** Everything published from src/PDFViewer, excluding tests. */
async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(full)))
    else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(full)
  }
  return files
}
