import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as pdfjsLib from 'pdfjs-dist'
import { configureWorker } from './worker.js'

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

  it('never resolves a worker itself — a bundled worker would bloat the package', () => {
    configureWorker({})
    // Nothing assigned: the host is responsible. The regression this guards against is
    // re-introducing `import ... '?url'`, which Vite lib mode base64-inlines (1.7 MB bundle).
    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('')
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toMatch(/workerSrc/)
  })
})
