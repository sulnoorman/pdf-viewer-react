import { describe, it, expect, vi } from 'vitest'
import { resolveLayout } from './resolveLayout.js'
import { DEFAULT_TOOLBAR_ACTIONS } from './registry.js'

/** Stand-in registry: the rules are about placement, not about what renders. */
const REGISTRY = {
  thumbnails: { zone: 'left', Component: () => null },
  pageNav: { zone: 'left', Component: () => null },
  zoom: { zone: 'center', Component: () => null },
  rotate: { zone: 'center', Component: () => null },
  history: { zone: 'right', Component: () => null },
  draw: { zone: 'right', Component: () => null },
  addText: { zone: 'right', Component: () => null },
  stamp: { zone: 'right', Component: () => null },
  download: { zone: 'right', Component: () => null },
}

const run = (config, options) => resolveLayout(config, { registry: REGISTRY, ...options })
const ids = (row) => row.map((item) => item.id)

describe('resolveLayout — the fixed rows', () => {
  it('always renders the navigation and zoom controls', () => {
    /*
     * These are how a user reads the document rather than acts on it. A config that
     * could remove them would leave a viewer nobody can navigate, so displayActions
     * does not reach them.
     */
    for (const config of [
      undefined,
      {},
      { displayActions: ['history'] },
      { displayActions: [] },
    ]) {
      const rows = run(config)
      expect(ids(rows.left)).toEqual(['thumbnails', 'pageNav'])
      expect(ids(rows.center)).toEqual(['zoom', 'rotate'])
    }
  })

  it('ignores a fixed control named in displayActions, and says why', () => {
    // Reported separately from an unknown id: telling someone `zoom` is an "unknown
    // action" would send them hunting for a typo that is not there.
    const onFixed = vi.fn()
    const onUnknown = vi.fn()
    const rows = run({ displayActions: ['zoom', 'thumbnails', 'history'] }, { onFixed, onUnknown })

    expect(ids(rows.right)).toEqual(['history'])
    expect(onFixed).toHaveBeenCalledWith(['zoom', 'thumbnails'])
    expect(onUnknown).not.toHaveBeenCalled()
  })

  it('does not let a fixed id duplicate a control into the right row', () => {
    const rows = run({ displayActions: ['zoom'] })
    expect(ids(rows.center)).toEqual(['zoom', 'rotate'])
    expect(rows.right).toEqual([])
  })
})

describe('resolveLayout — no displayActions', () => {
  it('lays out every action in its shipped order', () => {
    expect(ids(run().right)).toEqual([
      'history',
      'divider',
      'draw',
      'addText',
      'stamp',
      'download',
    ])
  })

  it('treats an empty list the same as none at all', () => {
    expect(run({ displayActions: [] })).toEqual(run({}))
    expect(run({ displayActions: null })).toEqual(run({}))
  })

  it('appends custom actions last, as the host asked', () => {
    // The old `customToolbarActions` prop wedged them in before Download with no way
    // to change that.
    const rows = run({ customToolbarActions: [{ id: 'nomor', label: 'Ambil Nomor' }] })
    expect(ids(rows.right).at(-1)).toBe('nomor')
  })
})

describe('resolveLayout — an explicit displayActions', () => {
  it('shows only what is named', () => {
    expect(ids(run({ displayActions: ['history'] }).right)).toEqual(['history'])
  })

  it('drops a custom action that is not named', () => {
    // Rule 2 applies to custom actions too: listing is opting in.
    const rows = run({
      displayActions: ['history'],
      customToolbarActions: [{ id: 'nomor', label: 'Nomor' }],
    })
    expect(ids(rows.right)).toEqual(['history'])
  })

  it('drops Download even when the host supplied onDownload', () => {
    /*
     * The one consequence that catches people out, so it is pinned here rather than
     * special-cased: config.toolbar and config.onDownload are separate decisions.
     */
    expect(ids(run({ displayActions: ['history'] }).right)).not.toContain('download')
  })

  it('follows the given order exactly', () => {
    const rows = run({ displayActions: ['download', 'stamp', 'draw', 'history'] })
    expect(ids(rows.right)).toEqual(['download', 'stamp', 'draw', 'history'])
  })

  it('supports filtering the exported default list', () => {
    // The recommended way to hide one control without pinning yourself to a list that
    // can never gain the controls a later version adds.
    const rows = resolveLayout({
      displayActions: DEFAULT_TOOLBAR_ACTIONS.filter((id) => id !== 'addText'),
    })
    expect(ids(rows.right)).not.toContain('addText')
    expect(ids(rows.right)).toContain('stamp')
  })

  it('never strands the whole bar, since the fixed rows survive', () => {
    const rows = run({ displayActions: ['nothing-real'] }, { onUnknown: () => {} })
    expect(rows.right).toEqual([])
    expect(ids(rows.left)).toEqual(['thumbnails', 'pageNav'])
  })
})

describe('resolveLayout — custom actions', () => {
  it('places a custom action in the action row', () => {
    const rows = run({
      displayActions: ['nomor'],
      customToolbarActions: [{ id: 'nomor', label: 'Nomor' }],
    })
    expect(rows.right).toHaveLength(1)
    expect(rows.right[0]).toMatchObject({ id: 'nomor', kind: 'custom' })
  })

  it('lets a custom action shadow a built-in of the same id', () => {
    /*
     * Deliberate, not accidental: reusing `download` is how a host swaps the built-in
     * button for its own Upload without giving up the default layout.
     */
    const upload = { id: 'download', label: 'Upload' }
    const rows = run({ displayActions: ['download'], customToolbarActions: [upload] })
    expect(rows.right[0]).toMatchObject({ kind: 'custom', action: upload })
  })

  it('cannot shadow a fixed navigation control', () => {
    // Shadowing works by id, and the fixed rows are not built from displayActions —
    // so a custom action called `zoom` lands in the action row and leaves zoom alone.
    const rows = run({
      displayActions: ['zoom'],
      customToolbarActions: [{ id: 'zoom', label: 'My zoom' }],
    })
    expect(ids(rows.center)).toEqual(['zoom', 'rotate'])
    expect(rows.right[0]).toMatchObject({ kind: 'custom' })
  })

  it('ignores a custom action with no id, since nothing could reference it', () => {
    expect(run({ customToolbarActions: [{ label: 'nameless' }, null] })).toEqual(run({}))
  })
})

describe('resolveLayout — separators', () => {
  it('keeps a separator between two actions', () => {
    const rows = run({ displayActions: ['history', 'divider', 'draw'] })
    expect(ids(rows.right)).toEqual(['history', 'divider', 'draw'])
  })

  it('drops a separator stranded at either edge', () => {
    // Exactly what filtering the default list produces: the divider that followed the
    // removed control is left hanging against the edge of the bar.
    expect(ids(run({ displayActions: ['divider', 'history'] }).right)).toEqual(['history'])
    expect(ids(run({ displayActions: ['history', 'divider'] }).right)).toEqual(['history'])
  })

  it('collapses a run of separators', () => {
    const rows = run({ displayActions: ['history', 'divider', 'divider', 'draw'] })
    expect(ids(rows.right)).toEqual(['history', 'divider', 'draw'])
  })

  it('drops separators when there is nothing else at all', () => {
    expect(run({ displayActions: ['divider', 'spacer'] }).right).toEqual([])
  })

  it('gives repeated separators distinct keys', () => {
    // Duplicate React keys would silently drop one of them.
    const rows = run({ displayActions: ['history', 'divider', 'draw', 'divider', 'stamp'] })
    const keys = rows.right.map((item) => item.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('resolveLayout — bad input', () => {
  it('skips an unknown id and reports it once', () => {
    const onUnknown = vi.fn()
    const rows = run({ displayActions: ['history', 'nope', 'draw'] }, { onUnknown })
    expect(ids(rows.right)).toEqual(['history', 'draw'])
    expect(onUnknown).toHaveBeenCalledTimes(1)
    expect(onUnknown).toHaveBeenCalledWith(['nope'])
  })

  it('stays quiet when everything resolves', () => {
    const onUnknown = vi.fn()
    const onFixed = vi.fn()
    run({ displayActions: ['history'] }, { onUnknown, onFixed })
    expect(onUnknown).not.toHaveBeenCalled()
    expect(onFixed).not.toHaveBeenCalled()
  })

  it('ignores non-string entries', () => {
    const rows = run({ displayActions: ['history', 42, null, { id: 'draw' }] })
    expect(ids(rows.right)).toEqual(['history'])
  })

  it('survives being handed nothing', () => {
    expect(() => resolveLayout(null)).not.toThrow()
    expect(() => resolveLayout(undefined)).not.toThrow()
  })
})
