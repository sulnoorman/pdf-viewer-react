import {
  TOOLBAR_REGISTRY,
  DEFAULT_TOOLBAR_ACTIONS,
  FIXED_LEFT_ACTIONS,
  FIXED_CENTER_ACTIONS,
} from './registry.js'

/** Ids that carry no behaviour and may appear as many times as you like. */
const SEPARATORS = Object.freeze(['divider', 'spacer'])

/**
 * Turn a `config.toolbar` into the three rows the toolbar renders.
 *
 * **`displayActions` configures the right-hand action row only.** The left and centre
 * rows — thumbnails, page navigation, zoom, page rotation — are always rendered as
 * shipped. They are how a user reads the document rather than acts on it, so a config
 * that could remove them would leave a viewer nobody can navigate.
 *
 * The rules for the right row:
 *
 *  1. No `displayActions` (or an empty one) — every built-in action appears in its
 *     shipped order, then each custom action after it.
 *  2. A `displayActions` list — only the ids named appear. That includes custom
 *     actions: an id left out is an item left out. It also includes `download`, even
 *     when `onDownload` is supplied, which is the one case that surprises people.
 *  3. Order follows the list exactly.
 *
 * Pure and registry-injectable so the rules can be tested without React.
 *
 * @param {object} [config] the `config.toolbar` object
 * @param {object} [options]
 * @param {object} [options.registry] defaults to the built-in one
 * @param {(ids: string[]) => void} [options.onUnknown] called once with any ids that
 *   matched nothing — a typo in a custom action id is otherwise indistinguishable
 *   from a button that simply vanished
 * @param {(ids: string[]) => void} [options.onFixed] called once with any ids naming a
 *   left- or centre-row control, which `displayActions` cannot place
 * @returns {{left: object[], center: object[], right: object[]}}
 */
export function resolveLayout(
  config = {},
  { registry = TOOLBAR_REGISTRY, onUnknown, onFixed } = {}
) {
  const { displayActions, customToolbarActions } = config ?? {}

  const custom = new Map()
  for (const action of Array.isArray(customToolbarActions) ? customToolbarActions : []) {
    if (action?.id) custom.set(action.id, action)
  }

  const requested = Array.isArray(displayActions) && displayActions.length > 0
  const ids = requested
    ? displayActions
    : // Custom actions go last, as the host asked: appended after the built-ins
      // rather than wedged in before Download the way the old prop was.
      [...DEFAULT_TOOLBAR_ACTIONS, ...custom.keys()]

  const unknown = []
  const fixed = []
  const right = []

  for (const id of ids) {
    if (typeof id !== 'string') continue

    if (SEPARATORS.includes(id)) {
      right.push({ id, kind: id })
      continue
    }

    /*
     * Custom actions are checked first, so a host can replace a built-in by reusing
     * its id — swapping Download for its own Upload button without giving up the
     * default layout. Shadowing is the point, not an accident.
     */
    const action = custom.get(id)
    if (action) {
      right.push({ id, kind: 'custom', action })
      continue
    }

    const entry = registry[id]
    if (!entry) {
      unknown.push(id)
      continue
    }

    // A real control, but one this list does not govern. Reported separately: telling
    // someone `zoom` is an "unknown action" would send them looking for a typo.
    if (entry.zone !== 'right') {
      fixed.push(id)
      continue
    }

    right.push({ id, kind: 'builtin', Component: entry.Component })
  }

  if (unknown.length > 0) onUnknown?.(unknown)
  if (fixed.length > 0) onFixed?.(fixed)

  return {
    left: fixedRow(FIXED_LEFT_ACTIONS, registry),
    center: fixedRow(FIXED_CENTER_ACTIONS, registry),
    right: withKeys(trimSeparators(right)),
  }
}

function fixedRow(ids, registry) {
  return ids
    .filter((id) => registry[id])
    .map((id) => ({ id, key: id, kind: 'builtin', Component: registry[id].Component }))
}

/** Separators repeat, so the id alone is not a unique React key. */
function withKeys(items) {
  return items.map((item, index) => ({ ...item, key: `${item.id}#${index}` }))
}

/**
 * Drop separators that ended up leading, trailing, or doubled.
 *
 * They become stranded easily: filtering `history` out of the default list leaves the
 * divider that used to follow it dangling against the edge of the bar.
 */
function trimSeparators(items) {
  const isSeparator = (item) => SEPARATORS.includes(item.kind)

  const kept = []
  for (const item of items) {
    // Built up as we go rather than filtered in place: removing a leading separator
    // can turn the next one into a leading separator too.
    if (isSeparator(item) && (kept.length === 0 || isSeparator(kept.at(-1)))) continue
    kept.push(item)
  }
  while (kept.length > 0 && isSeparator(kept.at(-1))) kept.pop()
  return kept
}
