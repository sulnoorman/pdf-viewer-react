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
  RESET: 'history/reset',
  ADOPT: 'history/adopt',
})

export const undo = () => ({ type: HISTORY_ACTIONS.UNDO })
export const redo = () => ({ type: HISTORY_ACTIONS.REDO })
export const beginTransaction = () => ({ type: HISTORY_ACTIONS.BEGIN_TRANSACTION })
export const commitTransaction = () => ({ type: HISTORY_ACTIONS.COMMIT_TRANSACTION })
export const cancelTransaction = () => ({ type: HISTORY_ACTIONS.CANCEL_TRANSACTION })
export const clearHistory = () => ({ type: HISTORY_ACTIONS.CLEAR })

/**
 * Install a new present and throw the history away, in one step.
 *
 * Used when the viewer moves to another document, and when a saved draft is loaded over
 * whatever was there. It has to be atomic: replacing the state and clearing the history as
 * two dispatches leaves one commit in between where `past` still belongs to the previous
 * document, and a Ctrl+Z landing in that gap would discard the annotations just restored.
 *
 * @template S
 * @param {S} present
 * @param {unknown} [documentId] the subject the new present belongs to
 */
export const resetHistory = (present, documentId) => ({
  type: HISTORY_ACTIONS.RESET,
  present,
  documentId,
})

/**
 * Record which subject the current state belongs to, without touching the state itself.
 *
 * Needed for the changes that are *not* a reset — an id that was simply not known yet when
 * the state was created. Without recording it, later comparisons keep measuring against
 * the original blank and a genuine change would never be seen as one.
 *
 * @param {unknown} documentId
 */
export const adoptDocument = (documentId) => ({ type: HISTORY_ACTIONS.ADOPT, documentId })

export const DEFAULT_HISTORY_LIMIT = 100

/**
 * @template S
 * @param {S} present
 * @param {unknown} [documentId] opaque identity for whatever this history is about. The
 *   wrapper never interprets it; it is carried here so that "which subject does this state
 *   belong to?" is answerable from the state itself, during render, without a second state
 *   atom that could drift out of step with it.
 * @returns {{past: S[], present: S, future: S[], txDepth: number, txBase: S|null, documentId: unknown}}
 */
export function createHistoryState(present, documentId) {
  return { past: [], present, future: [], txDepth: 0, txBase: null, documentId }
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

        // Spread rather than a bare literal: a literal silently drops any field added to
        // the state later, which is how `documentId` would have gone missing on the first
        // drag after a document switch.
        return {
          ...state,
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

      case HISTORY_ACTIONS.RESET:
        // Also drops any open transaction: a reset that arrived mid-gesture has already
        // invalidated whatever that gesture was moving.
        return createHistoryState(action.present, action.documentId)

      case HISTORY_ACTIONS.ADOPT:
        if (state.documentId === action.documentId) return state
        return { ...state, documentId: action.documentId }

      default: {
        const next = reducer(present, action)
        // Reducers return the same reference when an action is a no-op.
        if (next === present) return state

        if (txDepth > 0) return { ...state, present: next }

        return {
          ...state,
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
