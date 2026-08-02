# react-pdf-viewer-stamping

A React PDF viewer with stamping and freehand annotation built in — pdf.js rendering and
pdf-lib export behind a single component.

Instead of assembling pdf.js, pdf-lib and a drag/resize library yourself and then owning
the coordinate maths between them, you render one component and call one method to get a
flattened PDF back.

> **0.1.0 — early release.** The API is settling while it gets used in real applications.
> Breaking changes will land as minor bumps until 1.0.

## Features

**Viewer** — pdf.js canvas rendering at device pixel ratio, selectable text layer, page
virtualisation for long documents, thumbnail sidebar, page navigation, five zoom modes up
to 1000%, zoom-to-pointer, trackpad and touch pinch, page rotation.

**Annotation** — image stamps (signatures, seals), inline-editable text boxes with font
and colour, freehand ink with adjustable colour, thickness and opacity.

**Editing** — move, resize, rotate and set opacity on any annotation; drag across page
boundaries; duplicate and copy/paste; undo/redo covering every annotation type.

**Export** — flattens annotations into a copy of the source PDF with pdf-lib. Original
text stays selectable and vector art stays vector; nothing is re-rasterised.

## Install

```bash
npm install react-pdf-viewer-stamping
```

React 18 or 19 is a peer dependency. `pdfjs-dist` and `pdf-lib` come along as
dependencies.

**This package is ESM only.** There is no CommonJS build, because there could not be a
working one: pdfjs-dist v6 is itself ESM-only. Vite, webpack 5, Next.js, Rollup and
Parcel all handle this. From a CommonJS file, use `await import(...)`.

## Quick start

```jsx
import { useRef, useCallback } from 'react'
import { PDFViewer } from 'react-pdf-viewer-stamping'
import 'react-pdf-viewer-stamping/style.css'

// See "The pdf.js worker" below — this line is bundler-specific.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export function SignDocument() {
  const viewer = useRef(null)

  const download = useCallback(async () => {
    const blob = await viewer.current.getFlattenedPDF()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'signed.pdf'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }, [])

  return (
    <div style={{ height: '100vh' }}>
      <PDFViewer
        ref={viewer}
        src="/contract.pdf"
        config={{
          workerSrc,
          specimenAsset: '/signature.png',
          onDownload: download,
        }}
      />
    </div>
  )
}
```

The viewer fills its container, so give the parent a height.

**Two things the library deliberately does not do:** it never downloads the file for you
(`onDownload` is yours to implement, which is what makes uploading instead of saving
possible), and it never bundles the pdf.js worker.

## The pdf.js worker

pdf.js needs a worker script, and the URL depends on your bundler. The worker is 1.25 MB,
so bundling it would have made the package fifteen times larger for everyone — including
apps that already ship their own copy of pdfjs-dist.

**Vite / Rollup**

```js
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
```

**webpack 5 / Next.js**

```js
const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
```

In Next.js the viewer must be client-side — add `'use client'` and load it with
`dynamic(() => import('./Viewer'), { ssr: false })`.

**Copy to your public folder**

Copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` into `public/` and pass
`workerSrc: '/pdf.worker.min.mjs'`. Remember to re-copy when pdfjs-dist is upgraded — the
worker and the API must be the same version.

You can also construct the Worker yourself and pass `config.workerPort`.

## `src`

Accepts a URL string, `File`, `Blob`, `ArrayBuffer` or `Uint8Array`. The bytes are read
once and reused for export, so a file picked from disk works, and exporting does not
depend on a URL still being reachable.

## API

### Props

| Prop | Type | Notes |
| --- | --- | --- |
| `src` | `string \| File \| Blob \| ArrayBuffer \| Uint8Array` | The document |
| `config` | `PDFViewerConfig` | See below |
| `ref` | `Ref<PDFViewerHandle>` | Imperative API |

### `config`

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `workerSrc` | `string` | — | URL of the pdf.js worker |
| `workerPort` | `Worker` | — | A Worker you built yourself; wins over `workerSrc` |
| `specimenAsset` | `string` | — | Single stamp image, registered as `default` |
| `stampAssets` | `Record<string, string \| StampAsset> \| StampAsset[]` | — | Several stamp images |
| `allowStampUpload` | `boolean` | `true` | Let the user add an image from disk |
| `allowMultipleStamps` | `boolean` | `true` | `false` allows exactly one image stamp |
| `maxStamps` | `number \| null` | `null` | Cap on image stamps |
| `labels` | `ViewerLabels` | English | Override any UI string |
| `rotateExportedPages` | `boolean` | `true` | Whether viewer rotation is written into the file |
| `onDownload` | `() => void` | — | Renders the Download button when provided |
| `canDownload` | `boolean` | `true` | Disables the Download button |
| `onAnnotationsChange` | `(counts) => void` | — | `{ image, text, ink, total }` |
| `onSpecimenChange` | `(hasSpecimen: boolean) => void` | — | Legacy: fires with whether at least one **image** stamp exists. Prefer `onAnnotationsChange`, which also counts text and ink |
| `onLoadError` | `(error) => void` | — | Document failed to load |
| `customToolbarActions` | `CustomToolbarAction[]` | `[]` | Your own toolbar buttons |

### Ref

| Method | Returns | Notes |
| --- | --- | --- |
| `getFlattenedPDF()` | `Promise<Blob>` | The signed document |
| `getAnnotations()` | `Annotation[]` | Current annotations, in paint order |
| `addTextStamp(options?)` | `string` | Adds a text box, returns its id |
| `addImageStamp(assetId?)` | `Promise<string \| null>` | Places a stamp image |
| `undo()` / `redo()` | `void` | Same stack as the toolbar buttons |

## Recipes

### Gate a button outside the viewer on whether the document has been annotated

A reviewer must mark up the document before they can submit. The Submit button lives in
your app, not in the toolbar, so it needs to know the annotation state.

`onAnnotationsChange` fires with a live count of each annotation type, including once on
mount, so your button starts in the right state:

```jsx
const [counts, setCounts] = useState({ image: 0, text: 0, ink: 0, total: 0 })

<PDFViewer
  ref={viewer}
  src={documentUrl}
  config={{ workerSrc, onAnnotationsChange: setCounts }}
/>

<button disabled={counts.total === 0} onClick={submitRevision}>
  Submit revision
</button>
{counts.total === 0 && <p>Mark up the document before submitting.</p>}
```

The counts go back down when annotations are removed, so a reviewer who deletes their
last mark is blocked again.

To require a *specific kind* of markup, read the individual counts — `counts.ink > 0` for
freehand marks, `counts.image > 0` for a signature, and so on.

### Upload the signed document instead of downloading it

`getFlattenedPDF()` returns a Blob; nothing forces you to save it locally.

```jsx
const submitRevision = async () => {
  const blob = await viewer.current.getFlattenedPDF()
  const body = new FormData()
  body.append('file', blob, 'revision.pdf')
  await fetch('/api/revisions', { method: 'POST', body })
}
```

### Store annotations instead of flattening them

`getAnnotations()` returns plain objects in view space (PDF points, top-left origin), so
they survive a round trip through JSON and your database. There is no import API yet —
see Known limitations.

```jsx
await fetch('/api/annotations', {
  method: 'POST',
  body: JSON.stringify(viewer.current.getAnnotations()),
})
```

## Keyboard

| Keys | Action |
| --- | --- |
| `Ctrl/Cmd` `+` / `-` / `0` | Zoom in, out, reset |
| `Ctrl/Cmd` + wheel or pinch | Zoom to pointer |
| `Ctrl/Cmd` `Z` / `Y` | Undo / redo |
| `Ctrl/Cmd` `D` | Duplicate selection |
| `Ctrl/Cmd` `C` / `V` | Copy / paste |
| `Delete` / `Backspace` | Delete selection |
| `Escape` | Deselect |

## Localisation

Pass the strings you want to change; the rest stay English. `DEFAULT_LABELS` is exported
so you can see every key.

```jsx
import { DEFAULT_LABELS } from 'react-pdf-viewer-stamping'

config={{
  labels: { download: 'Unduh', addStamp: 'Tambah Stempel', addText: 'Tambah Teks' },
}}
```

This is a resolved string map, so any i18n library drops straight in — compute the map
from your translations and pass it.

## Theming

Colours are CSS custom properties on `.rpvs-viewer`, the one class name that is not
hashed. Override the ones you need:

```css
.rpvs-viewer {
  --rpvs-toolbar-bg: #1e293b;
  --rpvs-accent: #7c3aed;
  --rpvs-bg: #0f172a;
}
```

Tokens cover surfaces (`--rpvs-bg`, `--rpvs-toolbar-bg`, `--rpvs-sidebar-bg`), controls
(`--rpvs-control-bg`, `--rpvs-control-border`), text (`--rpvs-text`,
`--rpvs-text-muted`) and accents (`--rpvs-accent`, `--rpvs-selection`).

## Known limitations

- Annotations are **flattened** into page content on export, so they cannot be edited
  again in a PDF reader. Round-trippable PDF annotation objects are not supported yet.
- Only the 14 standard PDF fonts. Custom font embedding is not supported.
- Links and form fields in the source document are rendered but inert.
- No persistence: annotations live in memory and are lost on reload. Read them with
  `getAnnotations()` if you need to store them.
- Resize handles operate on the unrotated bounding box, so resizing a rotated object
  feels slightly off-axis.

## Licence

MIT
