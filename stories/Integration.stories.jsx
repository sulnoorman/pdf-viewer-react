import { useCallback, useRef, useState } from 'react'
import { PDFViewer, usePdfViewer, useViewerState } from '../src/index.js'
import { ViewerHarness, CountsReadout, SAMPLE_SIGNATURE, panel, code } from './ViewerHarness.jsx'

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
 * in your application, not in the toolbar, so it needs to know the annotation state —
 * and state held inside `<PDFViewer>` is unreachable from the component rendering it.
 *
 * `usePdfViewer()` creates a handle that owns that state; `useViewerState` reads it out
 * here. No callback, and nothing mirrored into `useState`.
 *
 * Try it: Submit is disabled. Draw something, and it enables. Undo, and it disables again.
 */
export const SubmitGating = {
  render: () => <SubmitGatingDemo />,
}

function SubmitGatingDemo() {
  const viewer = usePdfViewer()
  const counts = useViewerState(viewer, (s) => s.counts)
  const [result, setResult] = useState(null)

  const submit = useCallback(async () => {
    setResult('Building revision…')
    const blob = await viewer.getFlattenedPDF()

    // In a real app this is where the upload goes:
    //   const body = new FormData()
    //   body.append('file', blob, 'revision.pdf')
    //   await fetch('/api/revisions', { method: 'POST', body })
    setResult(`Would upload revision.pdf (${(blob.size / 1024).toFixed(0)} kB)`)
  }, [viewer])

  const ready = counts.total > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PDFViewer
          viewer={viewer}
          src="/sample.pdf"
          config={{
            specimenAsset: SAMPLE_SIGNATURE,
            // No onDownload: this flow submits rather than downloads, so the toolbar
            // button is not rendered at all.
          }}
        />
      </div>

      <div style={panel}>
        <button type="button" onClick={submit} disabled={!ready} style={submitButton(ready)}>
          Kirim revisi
        </button>

        {!ready && <span>Beri catatan pada dokumen sebelum mengirim.</span>}
        <CountsReadout counts={counts} status={result} />
      </div>
    </div>
  )
}

const submitButton = (ready) => ({
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 6,
  border: 'none',
  cursor: ready ? 'pointer' : 'not-allowed',
  background: ready ? '#2563eb' : '#cbd5e1',
  color: ready ? '#fff' : '#64748b',
})

/**
 * **`hasSpecimen` and `hasAnnotation` are separate questions.**
 *
 * Some documents need a signature and nothing else; others need a hand-written note and
 * no signature at all. So they are two independent flags rather than two readings of one
 * count.
 *
 * This viewer has both a specimen (the signature) and an ordinary stamp (the seal) in its
 * stamp menu. Try each in turn:
 *
 * - **the seal** — neither flag moves. It is an image annotation, but it is not a
 *   signature, and it is not something the user wrote.
 * - **the signature** — `hasSpecimen` only.
 * - **a scribble, or a text box** — `hasAnnotation` only.
 * - **an image you upload** — neither. Otherwise any PNG at all would count as signed.
 *
 * Under the old `counts.image > 0` rule, the seal and the upload both read as a signature.
 */
export const SpecimenVsAnnotation = {
  render: () => <SpecimenVsAnnotationDemo />,
}

function SpecimenVsAnnotationDemo() {
  const viewer = usePdfViewer()
  const { hasSpecimen, hasAnnotation, counts } = useViewerState(viewer)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PDFViewer
          viewer={viewer}
          src="/sample.pdf"
          config={{
            specimenAsset: SAMPLE_SIGNATURE,
            // An ordinary stamp, to show what does NOT count as a specimen.
            stampAssets: [{ id: 'seal', label: 'Company seal', src: SAMPLE_SIGNATURE }],
          }}
        />
      </div>

      <div style={panel}>
        <button type="button" disabled={!hasSpecimen} style={submitButton(hasSpecimen)}>
          Needs a signature {hasSpecimen ? '✓' : '✗'}
        </button>
        <button type="button" disabled={!hasAnnotation} style={submitButton(hasAnnotation)}>
          Needs a written note {hasAnnotation ? '✓' : '✗'}
        </button>
        <code style={code}>
          {`specimen: ${counts.specimen}, stamp: ${counts.stamp}, ink: ${counts.ink}, text: ${counts.text}`}
        </code>
      </div>
    </div>
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
