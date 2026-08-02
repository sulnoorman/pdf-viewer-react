import { useCallback, useRef, useState } from 'react'
import { PDFViewer } from '../src/index.js'
import { ViewerHarness, CountsReadout, SAMPLE_SIGNATURE, panel, code } from './ViewerHarness.jsx'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const meta = {
  title: 'Integration',
  component: PDFViewer,
  parameters: { layout: 'fullscreen' },
}

export default meta

/**
 * **Gate a button outside the viewer on whether the document has been annotated.**
 *
 * A reviewer must mark up the document before they can submit. The Submit button lives
 * in your application, not in the toolbar, so it needs to know the annotation state.
 *
 * `onAnnotationsChange` fires with a live count of each type — including once on mount,
 * so the button starts in the right state rather than flickering.
 *
 * Try it: Submit is disabled. Draw something, and it enables. Undo, and it disables again.
 */
export const SubmitGating = {
  render: () => <SubmitGatingDemo />,
}

function SubmitGatingDemo() {
  const viewer = useRef(null)
  const [counts, setCounts] = useState({ image: 0, text: 0, ink: 0, total: 0 })
  const [result, setResult] = useState(null)

  const submit = useCallback(async () => {
    setResult('Building revision…')
    const blob = await viewer.current.getFlattenedPDF()

    // In a real app this is where the upload goes:
    //   const body = new FormData()
    //   body.append('file', blob, 'revision.pdf')
    //   await fetch('/api/revisions', { method: 'POST', body })
    setResult(`Would upload revision.pdf (${(blob.size / 1024).toFixed(0)} kB)`)
  }, [])

  const ready = counts.total > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PDFViewer
          ref={viewer}
          src="/sample.pdf"
          config={{
            workerSrc,
            specimenAsset: SAMPLE_SIGNATURE,
            onAnnotationsChange: setCounts,
            // No onDownload: this flow submits rather than downloads, so the toolbar
            // button is not rendered at all.
          }}
        />
      </div>

      <div style={panel}>
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            cursor: ready ? 'pointer' : 'not-allowed',
            background: ready ? '#2563eb' : '#cbd5e1',
            color: ready ? '#fff' : '#64748b',
          }}
        >
          Kirim revisi
        </button>

        {!ready && <span>Beri catatan pada dokumen sebelum mengirim.</span>}
        <CountsReadout counts={counts} status={result} />
      </div>
    </div>
  )
}

/**
 * **Require a specific kind of markup.**
 *
 * The counts are per type, so a workflow that demands an actual signature — not just a
 * scribble — can check `counts.image` on its own.
 */
export const RequireSignature = {
  render: () => <RequireSignatureDemo />,
}

function RequireSignatureDemo() {
  const [counts, setCounts] = useState({ image: 0, text: 0, ink: 0, total: 0 })

  return (
    <ViewerHarness
      specimenAsset={SAMPLE_SIGNATURE}
      onAnnotationsChange={setCounts}
      renderBelow={() => (
        <div style={panel}>
          <strong>Signature present:</strong>
          <code style={code}>{String(counts.image > 0)}</code>
          <span>
            `counts.image` ignores ink and text, so a scribble alone will not satisfy this
            check.
          </span>
        </div>
      )}
    />
  )
}

/**
 * **Read annotations as data instead of flattening them.**
 *
 * `getAnnotations()` returns plain objects in view space — PDF points, top-left origin —
 * so they survive a round trip through JSON and your database.
 *
 * Note the current limitation: there is no import API yet, so this is one-way.
 */
export const InspectAnnotations = {
  render: () => <InspectAnnotationsDemo />,
}

function InspectAnnotationsDemo() {
  const viewer = useRef(null)
  const [json, setJson] = useState('[]')

  return (
    <ViewerHarness
      specimenAsset={SAMPLE_SIGNATURE}
      viewerRef={viewer}
      renderBelow={() => (
        <div style={{ ...panel, alignItems: 'flex-start', flexDirection: 'column' }}>
          <button
            type="button"
            onClick={() => setJson(JSON.stringify(viewer.current.getAnnotations(), null, 2))}
            style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, cursor: 'pointer' }}
          >
            getAnnotations()
          </button>
          <pre
            style={{
              margin: 0,
              maxHeight: 160,
              overflow: 'auto',
              width: '100%',
              font: '11px ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {json}
          </pre>
        </div>
      )}
    />
  )
}
