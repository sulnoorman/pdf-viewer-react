# Changelog

## Unreleased

## 0.1.6

### Fixed

- **A scanned logo rendered as a solid black square.** Reported against a government
  document whose emblem is a 1-bit CCITT stencil mask; the same file renders correctly in a
  browser's built-in viewer, which is what made it look like our defect.

  It was not our rendering code — the fault reproduces in a bare Node harness with
  `pdfjs-dist` and one `page.render()`. pdf.js v6 moved CCITT, JBIG2 and JPEG 2000 decoding
  out of JavaScript and into WebAssembly, fetched at runtime from a `wasmUrl` the embedder
  supplies. There is no default, and we never set one, so the decoder never started.

  What made it look like a rendering bug rather than a missing file: **a stencil mask that
  fails to decode is not a missing image.** With no `Decode` array a sample value of zero
  means *paint*, so the mask paints its whole rectangle in the current fill colour. Nothing
  throws, the page count is right, the layout is right, and one image is a black rectangle.

  The error also named the wrong format — `Jbig2Error` on a document containing no JBIG2 —
  because CCITT and JBIG2 are one binary: `jbig2.wasm` exports `_ccitt_decode` alongside
  `_jbig2_decode`.

  The package now ships `jbig2.wasm`, `openjpeg.wasm` and `qcms_bg.wasm` (and their
  licences), plus the standard font data, resolved the same way the worker already was —
  through the one module kept external so `import.meta.url` survives to the consumer's
  bundler. `config.wasmUrl` and `config.standardFontDataUrl` override them, matching
  `config.workerSrc`.

  **The tarball grows from 0.4 MB to 1.1 MB**, all of it these assets. Nothing enters your
  application bundle: each file is fetched only by a document that needs it, and most
  documents need none of them. `quickjs-eval.wasm` (458 kB, for running JavaScript embedded
  in PDF forms) and the no-wasm JavaScript fallbacks (583 kB) are deliberately left out.

  Also fixed by the same change, quietly: JPEG 2000 images, ICC colour profiles, and
  documents that reference a standard font without embedding it — the last of which
  substituted metrics and shifted the layout.

  One trap worth recording. The URLs are written with a trailing slash, and **that slash
  does not survive**: Vite rewrites `new URL('./wasm/', import.meta.url)` into an asset URL
  and normalises it away. pdf.js concatenates `wasmUrl + filename` with no separator, so
  losing it asks for `wasmjbig2.wasm`. It is now forced at the point of use rather than
  trusted, and a test pins it.

## 0.1.5

### Added

- **One viewer can now serve several documents, each with its own annotations.** Pass
  `documentId` alongside `src` and the annotation store is emptied and re-seeded whenever it
  changes. This is what a review workflow with a tab per attachment needs: without it,
  swapping `src` alone left the previous document's annotations in place — same coordinates,
  same page numbers, on a document they were never drawn on.

  Your application holds the annotations, one entry per file: `config.initialAnnotations`
  seeds a document and the new `config.onAnnotationsSnapshot` reports every annotation on
  every change. That map is the whole draft, so persisting it is enough for a reviewer's
  work to survive a reload — which is the reason the state lives in your app rather than
  hidden inside the viewer.

  `initialAnnotations` is read **only** when `documentId` changes, like `defaultValue` on an
  input. It has to be: hosts store what the snapshot callback reports, so the prop changes on
  every edit, and re-seeding from it would fight the user. `viewer.setAnnotations()` loads
  annotations at any other moment.

  `config.onAnnotationsChange` is untouched and still reports counts. Widening its payload
  would have broken every host already using it, and the two answer different questions: one
  gates a Submit button, the other saves work — a stamp being moved changes nothing to count
  and everything to store.

  Undo history is per document, so Ctrl+Z after opening an attachment cannot undo the
  restoring of its draft.

- **`flattenPdf()`** — the export pipeline without a mounted viewer, so a Submit button can
  produce *every* attachment with its own annotations. `getFlattenedPDF()` can only ever
  export the document on screen, and driving one viewer around the rest to collect the output
  would mean loading and rendering each in turn for nothing.

  ```js
  import { flattenPdf } from '@armsolusi/pdf-viewer'
  const blob = await flattenPdf({ src: file.url, annotations, stampAssets })
  ```

- **`viewer.setAnnotations()`** — replace every annotation, for restoring a draft that
  arrives after the viewer has mounted. Clears undo history, so one Ctrl+Z cannot discard
  what was just loaded.

- **Returning to a document already visited is now instant**, which is what makes tabs
  usable at all. Switching used to repeat the entire load — re-fetch the whole file,
  re-parse it in a fresh worker, and re-measure every page one at a time — so a large
  attachment made the reviewer wait on every switch even though nothing had changed.

  The last **3** documents now stay parsed, least-recently-used, and the scroll position
  comes back with them. `config.documentCacheSize` changes that number and `0` switches it
  off; nothing is prefetched, so only documents actually opened are kept. The memory cost is
  `documentCacheSize × file size` for the pristine bytes, plus pdf.js's own structures on
  top — which depend on what is in the document rather than its size, so lower the number if
  your attachments are large.

  Two other costs went with it, and both make the **first** load faster too: every document
  shares one pdf.js worker instead of starting and tearing one down per document, and page
  geometry is measured in batches rather than one sequential worker round trip per page —
  116 of them, for a 116-page file, before anything could be drawn.

  The page list is keyed by document as well as page index, which matters more than it
  sounds: a document arriving from the cache no longer passes through a loading state, so
  nothing unmounts the page components — and reusing them left the previous document's
  canvas, text layer and annotation layer on screen until the new raster landed. On a large
  document that is long enough to read, so it looked as though the wrong attachment had been
  opened. The scroller itself is still reused, which is what preserves the scroll position.

  Keeping a document also means being careful about what tears it down. `loadingTask.destroy()`
  is documented by pdf.js as "abort all network requests and destroy the worker" — the same
  teardown as `PDFDocumentProxy.destroy()`, not merely cancelling a fetch — so it is now
  called only for a load that never reached the cache. A cached document is released when its
  entry is evicted or the viewer unmounts, and not before.

  Both of those return promises that reject when the thing they are tearing down has already
  gone, which happens routinely — effect cleanups run in declaration order, so the shared
  worker goes before the documents using it, and React's StrictMode runs every cleanup once
  on mount. So does a worker's own readiness promise, which pdf.js rejects when the worker is
  disposed of before it finished starting; nothing awaits that one, and `PDFWorker.destroy()`
  returns void, so it needed a handler of its own.

  Left unattended these surfaced as `Uncaught (in promise) Error: Worker was destroyed` as
  soon as the viewer mounted in development — a library error in the console, about nothing:
  the worker that rejects is one that was never used. All three are handled now.

### Fixed

- **A destroyed document was rendered while the next one loaded.** Changing `src` destroyed
  the outgoing pdf.js document but the hook still reported it as ready, so every `getPage()`
  threw and was swallowed into the console. Staleness was decided by testing `pdfDoc` for
  null, which could not see a swap at all — the previous document was still there, so it
  looked fine. Results now carry the `src` they were loaded for. Unnoticeable for as long as
  `src` never changed after mount; on every tab switch, not.

  Moving away from a document that failed to load also used to show the old error under the
  new document; it now reports loading, as it should.

- **A PNG was embedded as a JPEG when its format could not be guessed from a name.** The
  format was taken from `mimeType` or a path ending in `.png`, and a `data:` URL has neither
  — pdf-lib then failed with "SOI not found in JPEG", naming neither the asset nor the real
  cause. The image bytes are inspected first now, which is the only signal always available;
  the old hints remain as a fallback. This matters more than it used to, because a data URL
  is how a host keeps an uploaded signature in a saved draft.

## 0.1.4

### Fixed

- **An annotation could be dragged or resized off its page and left there.** Its stored
  coordinates went negative and the exported PDF drew the stamp partly or wholly off the
  sheet — a signature that looked placed and then wasn't there. Nothing had ever
  constrained it; the gap only became reachable once dragging itself started working in
  `0.1.2`.

  There are now two rules, and they answer different moments:

  **While the gesture is live**, the object is held at the edge. Left and right bind on
  every page — there is nothing out there to move it to. Top and bottom bind only on the
  first and last page, because those are the edges of the *document*; between pages it
  travels freely, which is what keeps dragging a stamp onto the next page working. A page
  also stops clipping during a gesture, so a stamp crossing a boundary stays visible the
  whole way instead of being sliced in half. A resize answers an edge by giving back
  **size** rather than position, so the handle stays under the cursor and the opposite
  corner stays pinned; ratio-locked images shrink on both axes together.

  **On release**, the object is settled fully inside whichever page it covers most — never
  straddling two. That part is not cosmetic: pdf-lib draws into one page, and anything
  outside that page's MediaBox is not rendered by any PDF reader, so an object left across
  a boundary would export cut in half.

  Both rules account for rotation: a stamp turned 45° is held by its rotated corners, not
  by its unrotated box. And a drop in open page area moves nothing at all.

- **Four paths could still place an annotation outside a page.** Each wrote coordinates
  without consulting the page it was writing them onto: the annotation toolbar's duplicate
  button, `Ctrl+D` / `viewer.duplicateSelected()`, and `Ctrl+C`/`Ctrl+V`. Paste was the
  worst of them — it kept the source coordinates while switching the page, so copying from
  a large page onto a smaller one landed the copy well outside, with no gesture afterwards
  to correct it. Duplicate now measures against the annotation's **own** page rather than
  the one on screen, since the copy stays beside its original.

- **A drop that touched no page sent the annotation back to the page it came from.**
  Releasing in the gutter between pages, or out in the margin when zoomed out, returned no
  target at all — so a stamp dragged from page 1 to the gutter before page 5 reappeared on
  page 1. The nearest page now wins. Overlap is still what decides a box straddling two
  pages, and that rule is unchanged: the page it covers most gets it.

## 0.1.3

### Changed

- **With two pages on screen, the later one is now the active page** — the page a new
  stamp or text box lands on. Scrolling down until the next page appeared and then
  stamping used to put the stamp on the page above, so it had to be fetched by scrolling
  back. A page must cover at least a quarter of the viewport to qualify, so a sliver at
  the bottom edge does not steal it.

### Fixed

- **The active page was unstable at a fixed scroll position** — the same view reported
  page 1 or page 2 depending on how you had scrolled to it. Two causes, both now gone:
  it was decided from the `IntersectionObserver` entries of a single callback, which
  carries only the pages that just crossed a threshold rather than the whole picture; and
  it compared `intersectionRatio`, a fraction of the *page*, so a short page fully in view
  outranked a tall page filling the screen. Coverage is now measured directly against the
  viewport, from every page, on scroll.

## 0.1.2

Distributed as a git tag, not on a registry yet — see MAINTAINING.md. Everything below
accumulated across `0.1.0`–`0.1.2`, which were all pre-release tags; the breaking changes
cost nothing while nobody outside the team was consuming it, and would have been expensive
later.

**No change is needed in consuming applications.** If a sticky navbar of yours was being
painted over by a selected annotation, reinstalling is enough — the `z-index` you already
have on it now takes effect.

### Renamed

- The package is now **`@armsolusi/pdf-viewer`** (was `react-pdf-viewer-stamping`).
  Imports and the stylesheet path change accordingly:

  ```js
  import { PDFViewer } from '@armsolusi/pdf-viewer'
  import '@armsolusi/pdf-viewer/style.css'
  ```

  The `.rpvs-viewer` class and the `--rpvs-*` custom properties are **unchanged** — they
  are the documented theming contract, and renaming them would force every consumer to
  rewrite their CSS.

### Added

- **The pdf.js worker ships with the package, so `config.workerSrc` is no longer needed.**
  `npm install @armsolusi/pdf-viewer` and render the component — nothing else. `pdfjs-dist`
  moved from a peer dependency to an ordinary one, so it is not a separate install either.

  Why it took this shape: there is no portable way for a library to obtain the URL of a
  file inside a *dependency*. `?url` imports are Vite-only, and
  `new URL('pkg/file', import.meta.url)` works on webpack but not Vite — which is why the
  host used to have to supply the URL itself. A path relative to one of the package's own
  modules is the one expression both bundlers understand, verified against Vite 8 and
  webpack 5: each emits the worker as a separate asset rather than inlining it.

  Two consequences worth knowing. `pdfjs-dist` is pinned to an **exact** version, because
  pdf.js throws when the worker and API versions differ; upgrading pdf.js now means a
  release here. And the tarball grew from 42 kB to 414 kB — all of it the worker, fetched
  only when a document loads and never part of your main bundle.

  `config.workerSrc` and `config.workerPort` still override it, and a `GlobalWorkerOptions`
  you set yourself is still respected.

### Fixed after first testing in a real app

- **A selected annotation painted over the host application's sticky navbar**, and raising
  the navbar's `z-index` appeared to do nothing. The viewer did not establish a stacking
  context, so its internal values — 50 on a selected annotation and on popovers, 10 on the
  toolbar — competed in the *host page's* root stacking context. The viewer now isolates
  its layers, so it behaves as one layer and an ordinary `z-index` on your own overlay
  works. See "Putting your own UI over the viewer" in the README.

- **Vite's dev server broke the bundled worker.** It pre-bundles dependencies into
  `node_modules/.vite/deps/`, which relocates the module without copying the worker beside
  it; the relative path 404s and pdf.js reports the opaque "Setting up fake worker failed".
  Production builds were unaffected, which is exactly why the first round of verification —
  `vite build` and `webpack`, but not `vite dev` — missed it. The library now maps the
  optimizer's path back to the package, and a failure that survives that says so and names
  `optimizeDeps.exclude`.

- **Toolbar warnings never reached anyone.** They were guarded on `import.meta.env.PROD`,
  which is substituted at *this package's* build time, so the branch was compiled away
  before publishing. A mistyped `displayActions` id was silently invisible — the exact
  situation the warning exists to prevent. The guard is gone; the warning fires once per
  id, in any environment.

- **`usePdfViewer()` and `useViewerState()`** — read viewer state from your own
  components without an `onChange` callback or a mirrored `useState`. State inside
  `<PDFViewer>` is unreachable from the component that renders it, so the handle owns it
  instead. The handle's identity never changes, so passing it as a prop does not re-render
  the viewer.

- **`hasSpecimen` and `hasAnnotation` as independent flags.** Some workflows require only
  a signature, others only a hand-written note and no signature at all. `hasSpecimen`
  counts stamps from `config.specimenAsset` (or an asset marked `kind: 'specimen'`);
  `hasAnnotation` counts ink and text. An image stamp is never an annotation, and a seal
  or an uploaded image is never a specimen.

- **`kind` on stamp assets** (`'specimen' | 'stamp'`, default `'stamp'`). This is what
  makes the split possible: a seal and a signature are both image annotations, so counting
  images cannot tell them apart.

- **`config.toolbar`** — `displayActions` chooses which actions appear in the right-hand
  row and in what order; `customToolbarActions` moved here from the top level. Also
  `toolbar: false` to drop the bar entirely, and `config.renderToolbar` to replace it.

  The navigation half of the bar — thumbnails, page navigation, zoom, page rotation — is
  always rendered and `displayActions` does not reach it. Those controls are how a user
  reads the document rather than acts on it, and a config able to remove them would leave
  a viewer nobody can navigate. `renderToolbar` remains the way to rearrange everything.

- **`DEFAULT_TOOLBAR_ACTIONS`** is exported, so hiding one action is
  `DEFAULT_TOOLBAR_ACTIONS.filter((id) => id !== 'addText')` rather than a hand-written
  list that can never gain the actions a later version adds.

- `counts` now includes `specimen` and `stamp`, where `specimen + stamp === image`.

### Changed after using it in a real application

- **Text boxes can be moved.** They never could: the textarea filled the box and was
  marked non-draggable, so every press on one only selected it. Following pdf.js, a single
  click now selects and drags and a double-click starts typing; Escape or a click away
  stops. Boxes created from the toolbar — including host actions that insert text — still
  open straight into typing, so those flows are unchanged.

- **The floating annotation toolbar hides while an object is being rotated**, and reappears
  on release. It tracks the rotated bounding box, so during a rotate gesture it swung
  around the object and could land under the pointer.

- **That toolbar now sits directly below the object at every angle.** Its counter-rotation
  pivoted around the bar's own centre rather than the object's, so the two rotations did
  not cancel and the bar drifted off the bottom edge as the object turned.

- **Stamps and user images are separate toolbar controls.** `stamp` places what the host
  configured; the new `image` places what the user brings in. Merging them forced a
  dropdown onto the stamp button even with a single specimen configured, because the
  upload entry always had to live behind it. Now the stamp dropdown appears only when
  there is more than one configured image.

  `config.allowStampUpload` is **removed**: leave `'image'` out of
  `toolbar.displayActions` instead, so toolbar composition stays in one place. Assets
  gained a `source` of `'config'` or `'upload'`, which is what the two menus filter on —
  separate from `kind`, which stays about specimen versus stamp.

### Changed — breaking

- **`config.customToolbarActions` → `config.toolbar.customToolbarActions`.** Custom
  actions also now land at the **end** of their zone rather than immediately before
  Download, and can be placed anywhere by naming them in `displayActions`.

- **`onSpecimenChange` means what its name says.** It fired for *any* image stamp
  (`counts.image > 0`), so a company seal or an image the user uploaded read as a
  signature. It now fires only for a specimen. If you were relying on the old behaviour,
  use `onAnnotationsChange` and read `counts.image`.

- **`onAnnotationsChange` fires only when a number changes.** It previously fired on every
  store change, so dragging an existing stamp re-notified the host with identical counts —
  and hosts that call `setState` from it were re-rendering their tree on every pointer-up.
  It still fires once on mount.

- **Custom toolbar actions require an `id`.** It was optional, but an action without one
  cannot be referenced from `displayActions`.

### Fixed

- **`stampAssets.default` silently suppressed `specimenAsset`.** The specimen was
  registered as the entry `'default'` only when the host had not used that key, so passing
  both meant no specimen at all and no warning. The specimen now owns a reserved id.

- **`addImageStamp()` ignored the specimen** when `stampAssets` was also configured: it
  fell back to the first registered asset, and the specimen was appended last. It now
  prefers a specimen asset.

- **`selectCounts` inflated `total`.** It was incremented outside the type check, and the
  check itself was `type in counts` — which is true for `'total'`. Either flaw alone let a
  host gating Submit on `total > 0` unlock on something that was never drawn.

## 0.1.0

Initial internal release.
