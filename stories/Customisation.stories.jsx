import { PDFViewer, DEFAULT_LABELS } from '../src/index.js'
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
