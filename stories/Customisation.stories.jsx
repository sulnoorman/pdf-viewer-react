import IconFileText from '@tabler/icons-react/dist/esm/icons/IconFileText.mjs'
import IconUpload from '@tabler/icons-react/dist/esm/icons/IconUpload.mjs'
import {
  PDFViewer,
  DEFAULT_LABELS,
  DEFAULT_TOOLBAR_ACTIONS,
  usePdfViewer,
  useViewerState,
} from '../src/index.js'
import { ViewerHarness, SAMPLE_SIGNATURE, panel, code } from './ViewerHarness.jsx'

const meta = {
  title: 'Customisation',
  component: PDFViewer,
  parameters: { layout: 'fullscreen' },
}

export default meta

/**
 * **Theming with CSS custom properties.**
 *
 * Colours live on `.rpvs-viewer` — the one class name in the package that is not
 * hashed, and therefore the only public CSS surface. Override the tokens you care about
 * from your own stylesheet:
 *
 * ```css
 * .rpvs-viewer {
 *   --rpvs-toolbar-bg: #1e293b;
 *   --rpvs-accent: #7c3aed;
 * }
 * ```
 *
 * `:where()` keeps the library's own specificity at zero, so a plain class selector in
 * your stylesheet wins without `!important`.
 */
export const Theming = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
      {/*
        Scoped through a wrapper, which is how a real application would do it: the
        tokens are declared on `.rpvs-viewer`, so any ancestor selector reaches them.
      */}
      <style>{`
        .story-violet .rpvs-viewer {
          --rpvs-bg: #1e1b2e;
          --rpvs-toolbar-bg: #2a2440;
          --rpvs-toolbar-border: #171326;
          --rpvs-inset-bg: #171326;
          --rpvs-control-bg: #3b3357;
          --rpvs-control-border: #4c4370;
          --rpvs-control-hover: #4c4370;
          --rpvs-accent: #7c3aed;
          --rpvs-accent-hover: #6d28d9;
          --rpvs-selection: #a78bfa;
          --rpvs-sidebar-bg: #241f38;
        }
      `}</style>

      <div className="story-violet" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <ViewerHarness specimenAsset={SAMPLE_SIGNATURE} />
      </div>

      <div style={panel}>
        Ten tokens changed, no component touched. A light theme is the same exercise.
      </div>
    </div>
  ),
}

/**
 * **Translating the interface.**
 *
 * `config.labels` is a plain map of resolved strings, so any i18n library drops in —
 * compute the map from your translations and pass it. Only the keys you supply are
 * overridden.
 *
 * `DEFAULT_LABELS` is exported so you can enumerate every key.
 */
export const Labels = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ViewerHarness
          specimenAsset={SAMPLE_SIGNATURE}
          labels={{
            addStamp: 'Tambah stempel',
            addText: 'Tambah kotak teks',
            draw: 'Coret bebas',
            download: 'Unduh',
            undo: 'Urungkan',
            redo: 'Ulangi',
          }}
        />
      </div>
      <div style={panel}>
        Six keys overridden; the rest fall back to English. There are{' '}
        <code style={code}>{Object.keys(DEFAULT_LABELS).length}</code> keys in total —
        hover any control to see which are translated here.
      </div>
    </div>
  ),
}

/**
 * **Choosing which actions appear, and in what order.**
 *
 * `displayActions` configures the **right-hand action row only**. The navigation half —
 * thumbnail toggle, page navigation, zoom, page rotation — is always there, because it is
 * how a user reads the document rather than acts on it.
 *
 * Leave the list out and you get every action in its shipped order; provide it and only
 * the ids you name appear, in the order you wrote them.
 *
 * To hide just one action, filter the exported default rather than writing your own list:
 * a hand-written list is frozen, and actions added in later versions would never reach
 * your users.
 */
export const ToolbarLayout = {
  render: () => <ToolbarLayoutDemo />,
}

function ToolbarLayoutDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ViewerHarness
          specimenAsset={SAMPLE_SIGNATURE}
          toolbar={{
            // Every action except Add text, plus one of the host's own after them.
            displayActions: [
              ...DEFAULT_TOOLBAR_ACTIONS.filter((id) => id !== 'addText'),
              'doc-number',
            ],
            customToolbarActions: [
              {
                id: 'doc-number',
                label: 'Nomor Surat',
                icon: <IconFileText size={16} stroke={2} />,
              },
            ],
          }}
        />
      </div>
      <div style={panel}>
        Add text is gone and the custom action follows Download. Navigation and zoom are
        untouched — <code style={code}>displayActions</code> does not reach them.
      </div>
    </div>
  )
}

/**
 * **A custom action can replace a built-in.**
 *
 * Reuse a built-in id and your action takes that slot. This is how to swap Download for an
 * upload of your own without giving up the default layout — the button keeps its place,
 * only the behaviour changes.
 *
 * Note also that `download` has to be *listed* to appear. Supplying `onDownload` makes the
 * built-in button available; naming it in `displayActions` is what puts it on the bar.
 */
export const CustomToolbar = {
  render: () => <CustomToolbarDemo />,
}

function CustomToolbarDemo() {
  const viewer = usePdfViewer()
  const total = useViewerState(viewer, (s) => s.counts.total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PDFViewer
          viewer={viewer}
          src="/sample.pdf"
          config={{
            specimenAsset: SAMPLE_SIGNATURE,
            toolbar: {
              displayActions: ['history', 'divider', 'draw', 'stamp', 'download'],
              customToolbarActions: [
                {
                  id: 'download',
                  label: 'Upload signed copy',
                  icon: <IconUpload size={16} stroke={2} />,
                  disabled: total === 0,
                  onClick: async () => {
                    const blob = await viewer.getFlattenedPDF()
                    window.alert(`Would upload ${(blob.size / 1024).toFixed(0)} kB`)
                  },
                },
              ],
            },
          }}
        />
      </div>
      <div style={panel}>
        The rightmost button is the host&apos;s, in Download&apos;s slot. It is disabled
        until something is on the page — <code style={code}>disabled</code> is read on every
        render, so <code style={code}>useViewerState</code> keeps it current.
      </div>
    </div>
  )
}

/**
 * **Building the bar yourself.**
 *
 * `renderToolbar` keeps the bar in place but hands over the rendering. `viewer` is a full
 * handle of the same shape `usePdfViewer()` returns, so one toolbar component works
 * whether it is rendered here or outside the viewer entirely.
 *
 * `toolbar: false` is the other exit: it removes the bar, leaving you to put controls
 * anywhere in your own layout.
 */
export const ReplaceToolbar = {
  render: () => (
    <ViewerHarness
      specimenAsset={SAMPLE_SIGNATURE}
      onExport={null}
      renderToolbar={({ viewer, state, labels }) => (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '8px 12px',
            background: '#0f172a',
            color: '#e2e8f0',
            font: '13px ui-sans-serif, system-ui, sans-serif',
          }}
        >
          <button type="button" onClick={viewer.undo} disabled={!state.canUndo}>
            {labels.undo}
          </button>
          <button type="button" onClick={() => viewer.addImageStamp()}>
            {labels.addStamp}
          </button>
          <button type="button" onClick={() => viewer.setDrawMode(!state.isDrawMode)}>
            {labels.draw} {state.isDrawMode ? '(on)' : ''}
          </button>
          <span style={{ marginLeft: 'auto' }}>
            page {state.activePageIndex + 1} / {state.pageCount} · {Math.round(state.scale * 100)}%
          </span>
        </div>
      )}
    />
  ),
}
