/**
 * Generic undo/redo wrapper around any pure reducer.
 *
 * Replaces the old ink-only history, which had two defects beyond its narrow scope:
 * it called `setHistoryIndex` from inside a `setInkHistory` updater (an impure state
 * update closing over a stale index), and it snapshotted a nested
 * `Record<pageIndex, Path[]>` structure.
 *
 * Snapshots are cheap here because the wrapped state is normalised and updated
 * immutably: a snapshot copies a map of references, and untouched annotations —
 * including ink strokes holding thousands of points — are shared, not cloned.
 *
 * ## Transactions
 *
 * A drag emits an UPDATE on every pointermove. Without grouping, one drag would fill
 * the entire undo stack and the user would have to press Ctrl+Z fifty times to put a
 * stamp back. Wrap continuous gestures in BEGIN/COMMIT so they collapse to one entry:
 *
 *   dispatch(beginTransaction())
 *   ...many updateAnnotation() dispatches...
 *   dispatch(commitTransaction())
 *
 * COMMIT records nothing if the gesture ended where it started, and CANCEL restores
 * the pre-gesture state (used when a second finger turns a drag into a pinch).
 */

export const HISTORY_ACTIONS = Object.freeze({
  UNDO: 'history/undo',
  REDO: 'history/redo',
  BEGIN_TRANSACTION: 'history/beginTransaction',
  COMMIT_TRANSACTION: 'history/commitTransaction',
  CANCEL_TRANSACTION: 'history/cancelTransaction',
  CLEAR: 'history/clear',
})

export const undo = () => ({ type: HISTORY_ACTIONS.UNDO })
export const redo = () => ({ type: HISTORY_ACTIONS.REDO })
export const beginTransaction = () => ({ type: HISTORY_ACTIONS.BEGIN_TRANSACTION })
export const commitTransaction = () => ({ type: HISTORY_ACTIONS.COMMIT_TRANSACTION })
export const cancelTransaction = () => ({ type: HISTORY_ACTIONS.CANCEL_TRANSACTION })
export const clearHistory = () => ({ type: HISTORY_ACTIONS.CLEAR })

export const DEFAULT_HISTORY_LIMIT = 100

/**
 * @template S
 * @param {S} present
 * @returns {{past: S[], present: S, future: S[], txDepth: number, txBase: S|null}}
 */
export function createHistoryState(present) {
  return { past: [], present, future: [], txDepth: 0, txBase: null }
}

export const canUndo = (state) => state.past.length > 0
export const canRedo = (state) => state.future.length > 0

/** Push onto `past`, dropping the oldest entry once the cap is reached. */
function pushPast(past, entry, limit) {
  const next = past.length >= limit ? past.slice(past.length - limit + 1) : past.slice()
  next.push(entry)
  return next
}

/**
 * @template S
 * @param {(state: S, action: object) => S} reducer
 * @param {{limit?: number}} [options]
 */
export function withHistory(reducer, { limit = DEFAULT_HISTORY_LIMIT } = {}) {
  return function historyReducer(state, action) {
    const { past, present, future, txDepth, txBase } = state

    switch (action.type) {
      case HISTORY_ACTIONS.UNDO: {
        // Undoing mid-gesture would corrupt txBase; ignore it.
        if (txDepth > 0 || past.length === 0) return state
        return {
          ...state,
          past: past.slice(0, -1),
          present: past[past.length - 1],
          future: [present, ...future],
        }
      }

      case HISTORY_ACTIONS.REDO: {
        if (txDepth > 0 || future.length === 0) return state
        return {
          ...state,
          past: pushPast(past, present, limit),
          present: future[0],
          future: future.slice(1),
        }
      }

      case HISTORY_ACTIONS.BEGIN_TRANSACTION:
        // Nested begins are tolerated so callers can compose without bookkeeping.
        return {
          ...state,
          txDepth: txDepth + 1,
          txBase: txDepth === 0 ? present : txBase,
        }

      case HISTORY_ACTIONS.COMMIT_TRANSACTION: {
        if (txDepth === 0) return state
        const depth = txDepth - 1
        if (depth > 0) return { ...state, txDepth: depth }

        // A gesture that changed nothing must not create an undo step.
        if (txBase === present) return { ...state, txDepth: 0, txBase: null }

        return {
          past: pushPast(past, txBase, limit),
          present,
          future: [],
          txDepth: 0,
          txBase: null,
        }
      }

      case HISTORY_ACTIONS.CANCEL_TRANSACTION: {
        if (txDepth === 0) return state
        return { ...state, present: txBase, txDepth: 0, txBase: null }
      }

      case HISTORY_ACTIONS.CLEAR:
        return { ...state, past: [], future: [] }

      default: {
        const next = reducer(present, action)
        // Reducers return the same reference when an action is a no-op.
        if (next === present) return state

        if (txDepth > 0) return { ...state, present: next }

        return {
          past: pushPast(past, present, limit),
          present: next,
          future: [],
          txDepth: 0,
          txBase: null,
        }
      }
    }
  }
}
