# @armsolusi/pdf-viewer

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
npm install @armsolusi/pdf-viewer
```

That is the whole setup. **React 18 or 19 is the only peer dependency**; `pdfjs-dist`,
`pdf-lib` and the pdf.js worker come with the package, so there is no worker URL to wire
up and no second install to remember. See "The pdf.js worker" below for why that is
unusual, and how to override it.

`pdfjs-dist` is pinned to an exact version rather than a range, because pdf.js refuses to
run when the worker and the API versions differ. If your app also uses pdfjs-dist
directly, npm will share one copy when the ranges overlap; otherwise you get two, and
`config.workerSrc` lets you point the viewer at yours.

**This package is ESM only.** There is no CommonJS build, because there could not be a
working one: pdfjs-dist v6 is itself ESM-only. Vite, webpack 5, Next.js, Rollup and
Parcel all handle this. From a CommonJS file, use `await import(...)`.

## Quick start

```jsx
import { useCallback } from 'react'
import { PDFViewer, usePdfViewer } from '@armsolusi/pdf-viewer'
import '@armsolusi/pdf-viewer/style.css'

export function SignDocument() {
  const viewer = usePdfViewer()

  const download = useCallback(async () => {
    const blob = await viewer.getFlattenedPDF()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'signed.pdf'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }, [viewer])

  return (
    <div style={{ height: '100vh' }}>
      <PDFViewer
        viewer={viewer}
        src="/contract.pdf"
        config={{
          specimenAsset: '/signature.png',
          onDownload: download,
        }}
      />
    </div>
  )
}
```

The viewer fills its container, so give the parent a height.

**The one thing the library deliberately does not do** is save the file. `onDownload` is
yours to implement, which is what makes uploading the signed document just as natural as
downloading it.

## The pdf.js worker

**There is nothing to configure.** pdf.js parses documents in a Web Worker, and that
worker ships inside this package; your bundler emits it as a separate file on its own.

That is worth a note because it is unusual, and because it constrains one thing. There is
no portable way for a library to ask a bundler for the URL of a file inside a
*dependency* — `?url` imports are Vite-only, and the `new URL('pkg/file', import.meta.url)`
form works on webpack but not Vite. A path relative to one of *our own* modules is the
only expression both understand, so the worker has to live here. In exchange,
`pdfjs-dist` is pinned to an exact version: pdf.js throws when the worker and the API
versions differ, and a range would let npm install a mismatched pair.

The worker is about 1.2 MB, emitted as its own file and fetched only when a document
loads — it never enters your main bundle.

### "Setting up fake worker failed"

pdf.js's message for this names no cause. Open the URL it prints and check two things.

**Does it 404?** Then a bundler moved the library without bringing the worker along. On
the Vite dev server, add one line to `vite.config.js`:

```js
optimizeDeps: { exclude: ['@armsolusi/pdf-viewer'] }
```

Vite pre-bundles dependencies into `node_modules/.vite/deps/`, which relocates the module
without copying the worker beside it. The library maps the usual layout back automatically,
so this is a fallback rather than a required step, and it affects the dev server only.

**Does it return the file but with `Content-Type: application/octet-stream`?** Then your
web server is refusing to call it JavaScript, and the browser will not execute a module
served as a binary. The worker ships as `.js` — rather than the `.mjs` pdfjs-dist uses —
precisely so this does not happen, because nginx and friends have no MIME mapping for
`.mjs`. If you see it anyway, add a mapping for whatever extension is being served:

```nginx
types { application/javascript js mjs; }
```

This one only ever appears in production, on a file that downloads perfectly, which is
what makes it worth knowing about in advance.

**Overriding it.** Pass `config.workerSrc` to point at a copy you serve yourself, or
`config.workerPort` for a `Worker` you constructed:

```jsx
// self-hosted, e.g. copied into public/ by your build
config={{ workerSrc: '/pdf.worker.min.js' }}
```

Both take precedence over the bundled copy. If you already load pdfjs-dist yourself and
have set `GlobalWorkerOptions` globally, that is respected too.

**Next.js.** The viewer must be client-side: add `'use client'` and load it with
`dynamic(() => import('./Viewer'), { ssr: false })`.

## How the viewer is used

Worth knowing before you write help text for your own users, because a few of these are
not guessable.

**Placing things**

| | |
| --- | --- |
| Stamp | Click the stamp button. With several configured, use the dropdown beside it. |
| Your own image | Click the image button; it opens a file picker straight away. |
| Text | Click the text button. The new box opens ready to type. |
| Freehand | Click the pencil to enter draw mode, then draw. Click it again to leave. The caret beside it sets colour, thickness and opacity. |

**Working with something already on the page**

| | |
| --- | --- |
| Select | Click it. |
| Move | Drag it — anywhere on the object, including text boxes. |
| Resize | Drag a corner or edge handle. |
| Rotate | Drag the round handle above it. Hold `Shift` to snap to 15°. |
| **Edit text** | **Double-click the box.** `Escape` or a click away stops. |
| Change colour, size, opacity | Use the small toolbar that appears below the selection. |

A text box takes a double-click to edit because a single click drags it — the same trade
pdf.js and every canvas editor makes. A box that was just created skips this and opens
straight into typing, so "add text" and host actions that insert text are unaffected.

Objects can be dragged **across page boundaries**; they are reassigned to whichever page
they end up over.

**Which page a new object lands on.** Stamps, images and text boxes are placed on the
*active* page — the one the page indicator shows, and the one `activePageIndex` reports.
With two pages sharing the screen, the **later** one wins, so scrolling down to a page and
stamping puts the stamp there rather than on the page above. A page has to cover at least a
quarter of the viewport to count, so a sliver at the bottom edge does not take over.

Use `viewer.goToPage(i)` to place somewhere else deliberately.

**Keyboard**

| Keys | Action |
| --- | --- |
| `Ctrl/Cmd` `+` / `-` / `0` | Zoom in, out, reset |
| `Ctrl/Cmd` + wheel, or trackpad pinch | Zoom to pointer |
| `Ctrl/Cmd` `Z` / `Y` | Undo / redo |
| `Ctrl/Cmd` `D` | Duplicate selection |
| `Ctrl/Cmd` `C` / `V` | Copy / paste |
| `Delete` / `Backspace` | Delete selection |
| `Escape` | Deselect, or stop editing text |
| `Shift` while rotating | Snap to 15° |
| `Shift` while clicking page rotate | Rotate every page |

Undo covers everything — placing, moving, resizing, rotating, typing, drawing, deleting.
A whole drag is one step, and a typing session is one step rather than one per keystroke.

## Asset URLs and `base`

`specimenAsset`, `stampAssets` and `src` are URLs your browser fetches, not module
imports, so your bundler never rewrites them.

That matters if your app is served under a sub-path. With Vite's `base: '/my-app/'`, a
file in `public/assets/` is served at `/my-app/assets/…`, but `'/assets/sign.png'`
resolves against the **origin** and 404s:

```jsx
specimenAsset: `${import.meta.env.BASE_URL}assets/sign.png`  // BASE_URL ends in a slash
```

Importing the image instead is the sturdier option, because the bundler then owns the URL:

```jsx
import signature from './assets/sign.png'   // from src/, not public/
config={{ specimenAsset: signature }}
```

A stamp image that fails to load leaves a blank thumbnail in the menu and an empty box on
the page, so the viewer logs a warning naming the asset and its URL.

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
| `viewer` | `PdfViewerHandle` | From `usePdfViewer()`. How to read state and drive it |
| `ref` | `Ref<PDFViewerHandle>` | The older, smaller door onto the same API |

### `config`

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `workerSrc` | `string` | bundled | Override the worker URL; the package ships one |
| `workerPort` | `Worker` | — | A Worker you built yourself; wins over `workerSrc` |
| `specimenAsset` | `string` | — | The signature image; the only thing `hasSpecimen` counts |
| `stampAssets` | `Record<string, string \| StampAsset> \| StampAsset[]` | — | Several stamp images |
| `allowMultipleStamps` | `boolean` | `true` | `false` allows exactly one image stamp |
| `maxStamps` | `number \| null` | `null` | Cap on image stamps |
| `labels` | `ViewerLabels` | English | Override any UI string |
| `rotateExportedPages` | `boolean` | `true` | Whether viewer rotation is written into the file |
| `onDownload` | `() => void` | — | Renders the Download button when provided |
| `canDownload` | `boolean` | `true` | Disables the Download button |
| `onAnnotationsChange` | `(counts) => void` | — | `{ specimen, stamp, image, text, ink, total }`. Fires only when a number changes |
| `onSpecimenChange` | `(hasSpecimen: boolean) => void` | — | Fires when `hasSpecimen` changes |
| `onLoadError` | `(error) => void` | — | Document failed to load |
| `toolbar` | `ToolbarConfig \| false` | — | Which actions appear; `false` hides the bar |
| `renderToolbar` | `({ viewer, state, labels }) => ReactNode` | — | Replace the bar entirely |

Both callbacks still work, but reading state through the controller below is simpler and
does not need a mirrored `useState`.

### Ref

The smaller, older door onto the same implementation. Everything here also exists on the
controller handle below, which is what new code should use.

| Method | Returns | Notes |
| --- | --- | --- |
| `getFlattenedPDF()` | `Promise<Blob>` | The signed document |
| `getAnnotations()` | `Annotation[]` | Current annotations, in paint order |
| `addTextStamp(options?)` | `string` | Adds a text box, returns its id |
| `addImageStamp(assetId?)` | `Promise<string \| null>` | Places a stamp image |
| `undo()` / `redo()` | `void` | Same stack as the toolbar buttons |

## Reading state from your own components

Your Submit button lives in your app, not in the toolbar, so it needs to know what is on
the document. State inside `<PDFViewer>` is unreachable from the component that renders
it — so `usePdfViewer()` creates a handle that owns the state, and you pass it in.

```jsx
import { PDFViewer, usePdfViewer, useViewerState } from '@armsolusi/pdf-viewer'

function ReviewDocument() {
  const viewer = usePdfViewer()
  const { hasSpecimen, hasAnnotation } = useViewerState(viewer)

  return (
    <>
      <PDFViewer viewer={viewer} src={url} config={{ specimenAsset }} />

      <button disabled={!hasSpecimen} onClick={submit}>Submit signed</button>
      <button disabled={!hasAnnotation} onClick={submit}>Submit reviewed</button>
    </>
  )
}
```

The handle's identity never changes, so passing it as a prop does not re-render the
viewer, and it is safe in a dependency array. Every method on it is also safe to call
before the viewer has mounted — it is a no-op, not a crash — so a toolbar of your own
needs no readiness check.

**Pass a selector** when you only read part of the state. Without one your component
re-renders on every change, including `scale` ticking through a pinch gesture:

```jsx
const canSubmit = useViewerState(viewer, (s) => s.hasAnnotation)
```

Return a primitive or a stable reference from a selector. One that builds a fresh object
(`(s) => ({ ink: s.counts.ink })`) is never equal to the last, so it re-renders on every
change — read `counts` itself instead.

### `hasSpecimen` and `hasAnnotation` are independent

Some documents need a signature and nothing else; others need a hand-written note and no
signature at all. So they are two separate flags, not two readings of one count:

| | Counts towards |
| --- | --- |
| Stamp from `specimenAsset` | `hasSpecimen` |
| Stamp from `stampAssets` (a seal, a logo) | neither |
| Image the user uploaded from disk | neither |
| Freehand ink | `hasAnnotation` |
| Text box | `hasAnnotation` |

An image stamp never counts as an annotation, and only a *specimen* image counts as a
signature. That distinction is why stamp assets carry a `kind`: a seal and a signature are
both image annotations, so counting images cannot tell them apart. If you register several
signature images instead of using `specimenAsset`, mark them yourself:

```js
stampAssets: [
  { id: 'director', kind: 'specimen', src: '/director.png' },
  { id: 'seal', src: '/seal.png' },
]
```

### The whole state

`status`, `error`, `pageCount`, `activePageIndex`, `scale`, `zoomMode`, `hasSpecimen`,
`hasAnnotation`, `counts`, `canUndo`, `canRedo`, `isDrawMode`, `selectedId`,
`showThumbnails`.

`counts` is `{ specimen, stamp, image, text, ink, total }`, where
`specimen + stamp === image`.

### Driving the viewer

Beyond the ref methods, the handle carries everything the toolbar can do — which is what
makes a toolbar of your own possible:

`reload()`, `uploadStamp(file)`, `duplicateSelected()`, `deleteSelected()`, `zoomIn()`,
`zoomOut()`, `setScale(n)`, `setZoomMode(mode)`, `goToPage(i)`,
`rotatePages(delta, scope?)`, `setDrawMode(bool)`, `setInk({ color, thickness, opacity })`,
`toggleThumbnails()`.

## Customising the toolbar

The bar has two halves. **Navigation** — the thumbnail toggle, page navigation, zoom and
page rotation — is always there, because it is how a user reads the document rather than
acts on it, and a viewer nobody can navigate is not a viewer. **Actions**, on the right,
are yours to arrange.

```jsx
config={{
  toolbar: {
    displayActions: ['history', 'doc-number', 'download'],
    customToolbarActions: [
      { id: 'doc-number', label: 'Document number', icon: <Icon />, onClick: insert },
    ],
  },
}}
```

**The rules — all of which apply to the action row only:**

1. **No `displayActions`** — every action appears in its shipped order, then each of your
   custom actions after it.
2. **A `displayActions` list** — only the ids named appear. Anything left out is left
   out, custom actions included.
3. **Order follows the list**, exactly as written.

> **`download` is not exempt.** Passing `onDownload` makes the button *available*; naming
> `download` in `displayActions` makes it *appear*. A list without it has no Download
> button, however the rest of the config looks.

Naming a navigation control (`zoom`, `thumbnails`, …) in `displayActions` does nothing but
log a warning in development — the control still renders in its own place. To rearrange
those, replace the whole bar with `renderToolbar`.

### Action ids

`history`, `draw`, `addText`, `stamp`, `image`, `download`.

`history` is a cluster; use `undo` and `redo` to place its halves separately.

**`stamp` and `image` are separate on purpose.** `stamp` places one of the images *you*
configured through `specimenAsset` and `stampAssets`; `image` lets the *user* bring in
one of their own. Because uploading is no longer hidden behind the stamp control's
dropdown, that dropdown appears only when there is genuinely a choice — configure a
single specimen and you get a plain button, not a menu with one entry in it.

To forbid users adding their own images, leave `image` out:

```jsx
toolbar: { displayActions: DEFAULT_TOOLBAR_ACTIONS.filter((id) => id !== 'image') }
```

`divider` and `spacer` may appear as often as you like. One stranded at either end of the
row is dropped rather than left dangling against the edge.

### Hiding one action

Filter the exported list instead of writing your own:

```jsx
import { DEFAULT_TOOLBAR_ACTIONS } from '@armsolusi/pdf-viewer'

toolbar: { displayActions: DEFAULT_TOOLBAR_ACTIONS.filter((id) => id !== 'addText') }
```

A hand-written list is frozen: actions added in later versions never reach your users.
Filtering keeps you in step.

### Replacing a built-in button

Give a custom action a built-in action id and it takes that slot — the way to swap Download
for an upload of your own without giving up the default layout:

```jsx
toolbar: {
  customToolbarActions: [{ id: 'download', label: 'Upload', onClick: uploadSigned }],
}
```

### Building the bar yourself

`toolbar: false` removes it, leaving you to build one anywhere in your app and drive it
through the handle. `renderToolbar` keeps it in place but hands over the rendering:

```jsx
config={{
  renderToolbar: ({ viewer, state, labels }) => (
    <MyToolbar
      onUndo={viewer.undo}
      canUndo={state.canUndo}
      onSign={() => viewer.addImageStamp()}
    />
  ),
}}
```

`viewer` here is a full handle of the same shape `usePdfViewer()` returns, so one toolbar
component works either way.

## Recipes

### Upload the signed document instead of downloading it

`getFlattenedPDF()` returns a Blob; nothing forces you to save it locally.

```jsx
const submitRevision = async () => {
  const blob = await viewer.getFlattenedPDF()
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
  body: JSON.stringify(viewer.getAnnotations()),
})
```

## Localisation

Pass the strings you want to change; the rest stay English. `DEFAULT_LABELS` is exported
so you can see every key.

```jsx
import { DEFAULT_LABELS } from '@armsolusi/pdf-viewer'

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

## Putting your own UI over the viewer

The viewer isolates its own stacking context, so its internal layering never competes with
yours. A navbar, modal or dropdown of yours goes on top with an ordinary `z-index`:

```css
.my-navbar {
  position: sticky;   /* required — z-index is ignored on a static element */
  top: 0;
  z-index: 10;        /* any value ≥ 1 */
  background: #fff;   /* or it is transparent and the document shows through */
}
```

**`position` is the part people miss.** `z-index` has no effect at all on a `position:
static` element, which is why "I set a z-index and nothing changed" is almost always this
rather than a stacking problem. `position: sticky` or `relative` is enough.

`z-index: auto` on a positioned element is also not enough: elements at `auto` are painted
in DOM order, and the viewer usually comes after your navbar in the tree. Give it a number.

### Give the viewer's container a height

Worth repeating here because it changes which element scrolls. With a fixed height, the
viewer scrolls internally and its content stays inside its own box:

```jsx
<div style={{ height: '80vh' }}>
  <PDFViewer … />
</div>
```

Without one, the viewer grows as tall as the whole document and **the page** scrolls
instead. Everything still works, but the viewer's content travels up behind whatever you
have pinned to the top of the window — so this is the case where the layering above starts
to matter.

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
