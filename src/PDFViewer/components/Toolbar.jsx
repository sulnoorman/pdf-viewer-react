import { useMemo } from 'react'
import { resolveLayout } from './toolbar/resolveLayout.js'
import controls from '../styles/controls.module.css'
import styles from './Toolbar.module.css'
import { useLabels } from '../context/LabelContext.jsx'

/**
 * The viewer chrome.
 *
 * Actions are icon-only, the way Chrome's and pdf.js's viewers do it. Labelled
 * buttons ate most of the bar's width and pushed the zoom cluster off-centre on
 * anything narrower than a desktop window; each control keeps its name in `title`
 * and `aria-label`, so nothing is lost but the horizontal space.
 *
 * Three zones — navigation, zoom, tools — and they give up space in that order as
 * the window narrows: page navigation goes first because scrolling and the keyboard
 * still reach every page.
 *
 * This file used to hold every control inline, which made the layout unchangeable
 * from outside. It now only arranges: which items appear and in what order comes
 * from `resolveLayout`, and the items themselves live in toolbar/registry.jsx.
 */
export function Toolbar({ toolbar, ctx }) {
  const labels = useLabels()

  const rows = useMemo(
    () => resolveLayout(toolbar, { onUnknown: warnUnknown, onFixed: warnFixed }),
    [toolbar]
  )

  // One object for every item, so adding a control never means threading another
  // prop through here — the old signature had grown to 22.
  const itemCtx = useMemo(() => ({ ...ctx, labels }), [ctx, labels])

  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>{renderRow(rows.left, itemCtx)}</div>
      <div className={styles.groupCenter}>{renderRow(rows.center, itemCtx)}</div>
      <div className={styles.group}>{renderRow(rows.right, itemCtx)}</div>
    </div>
  )
}

function renderRow(items, ctx) {
  return items.map((item) => {
    switch (item.kind) {
      case 'divider':
        return <span key={item.key} className={controls.divider} />
      case 'spacer':
        return <span key={item.key} style={{ flex: 1 }} />
      case 'custom':
        return <CustomAction key={item.key} action={item.action} />
      default: {
        const { Component } = item
        return <Component key={item.key} ctx={ctx} />
      }
    }
  })
}

function CustomAction({ action }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      aria-pressed={action.active}
      className={`${controls.chipButton} ${action.active ? controls.active : ''}`}
      title={action.tooltip || action.label}
      aria-label={action.label}
    >
      {/* Host actions stay icon-only when they supply one, and fall back to their
          label when they do not, so nothing becomes unclickable. */}
      {action.icon ?? action.label}
    </button>
  )
}

const warned = new Set()

/**
 * A mistyped id would otherwise be indistinguishable from a button that simply did
 * not appear, which is a miserable thing to debug. Warned once per id so a re-render
 * loop cannot flood the console, and never in production builds.
 */
function warnUnknown(ids) {
  warnOnce(
    ids,
    (id) =>
      `Unknown toolbar action "${id}" in config.toolbar.displayActions. Use a built-in ` +
      'action id, or the id of an entry in config.toolbar.customToolbarActions.'
  )
}

/** A real control, but one `displayActions` does not govern. */
function warnFixed(ids) {
  warnOnce(
    ids,
    (id) =>
      `Toolbar action "${id}" is one of the fixed navigation controls, so ` +
      'config.toolbar.displayActions cannot place it — that list configures the ' +
      'right-hand action row only. Use config.renderToolbar to rearrange the whole bar.'
  )
}

/*
 * Not gated on a dev/prod flag.
 *
 * `import.meta.env.PROD` is replaced at *this package's* build time, not the consumer's,
 * so guarding on it compiled the whole branch away and these warnings never reached
 * anyone — which is precisely the failure they exist to prevent. A bad toolbar id is a
 * mistake in the host's source either way, and warning once per id cannot flood a log.
 */
function warnOnce(ids, message) {
  for (const id of ids) {
    if (warned.has(id)) continue
    warned.add(id)
    console.warn(`[@armsolusi/pdf-viewer] ${message(id)}`)
  }
}
