# Changelog

## Unreleased

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
