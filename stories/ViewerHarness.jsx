import { useCallback, useRef, useState } from 'react'
import { PDFViewer } from '../src/index.js'

// Nothing here configures a worker. The package ships one, so these stories exercise the
// same zero-config path a consumer gets.

export const SAMPLE_PDF = '/sample.pdf'
export const SAMPLE_SIGNATURE = '/Tandatangan.png'

/**
 * Shared harness for the stories.
 *
 * Storybook controls are flat, but the component takes a single `config` object, so
 * every option arrives as a top-level arg and is reassembled here. That is what makes
 * the options appear as real controls rather than one opaque JSON blob.
 *
 * It also does the two things the library deliberately leaves to the host — saving the
 * exported file and deciding when export is allowed — so each story doubles as a
 * working integration example.
 */
export function ViewerHarness({
  src = SAMPLE_PDF,
  onExport,
  renderBelow,
  /** Lets a story reach the imperative API, e.g. to drive a custom toolbar action. */
  viewerRef,
  children,
  ...config
}) {
  const localRef = useRef(null)
  const viewer = viewerRef ?? localRef
  const [counts, setCounts] = useState({ image: 0, text: 0, ink: 0, total: 0 })
  const [status, setStatus] = useState(null)

  const download = useCallback(async () => {
    try {
      setStatus('Exporting…')
      const blob = await viewer.current.getFlattenedPDF()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setStatus(`Exported ${(blob.size / 1024).toFixed(0)} kB — opened in a new tab`)
    } catch (error) {
      setStatus(`Export failed: ${error.message}`)
    }
  }, [viewer])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PDFViewer
          ref={viewer}
          src={src}
          config={{
            onAnnotationsChange: setCounts,
            onDownload: onExport === null ? undefined : download,
            canDownload: counts.total > 0,
            ...config,
          }}
        />
      </div>

      {/* The ref is not passed through: stories that need it own one and hand it in
          as viewerRef, which keeps it out of the render path. */}
      {renderBelow?.({ counts, status })}
      {children}
    </div>
  )
}

/** Small readout used by several stories to show the live annotation counts. */
export function CountsReadout({ counts, status }) {
  return (
    <div style={panel}>
      <strong>onAnnotationsChange:</strong>
      <code style={code}>
        {`{ image: ${counts.image}, text: ${counts.text}, ink: ${counts.ink}, total: ${counts.total} }`}
      </code>
      {status && <span style={{ color: '#64748b' }}>{status}</span>}
    </div>
  )
}

export const panel = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  padding: '10px 12px',
  background: '#f1f5f9',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  font: '13px ui-sans-serif, system-ui, sans-serif',
  color: '#0f172a',
}

export const code = {
  font: '12px ui-monospace, SFMono-Regular, Menlo, monospace',
  background: '#e2e8f0',
  padding: '2px 6px',
  borderRadius: 4,
}
