import { createContext, useContext, useReducer, useMemo, useCallback } from 'react'
import { useLatestRef } from '../hooks/useLatestRef.js'
import {
  annotationReducer,
  initialAnnotationState,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
  duplicateAnnotation,
  selectByPage,
  selectCounts,
} from '../reducers/annotationReducer.js'
import {
  withHistory,
  createHistoryState,
  canUndo as canUndoSelector,
  canRedo as canRedoSelector,
  undo,
  redo,
  beginTransaction,
  commitTransaction,
  cancelTransaction,
} from '../reducers/withHistory.js'

/**
 * State and actions are deliberately in two contexts.
 *
 * Every annotation edit produces a new state object. If actions travelled in the same
 * context value, a component that only ever dispatches (the toolbar, the drag
 * handlers) would re-render on every pointermove of an unrelated drag. Splitting them
 * lets the actions context stay referentially stable for the life of the viewer.
 */
const AnnotationStateContext = createContext(null)
const AnnotationActionsContext = createContext(null)

const historyReducer = withHistory(annotationReducer)

export function AnnotationProvider({ children }) {
  const [history, dispatch] = useReducer(historyReducer, initialAnnotationState, createHistoryState)

  // Lets imperative callers read the latest annotations without re-subscribing.
  const presentRef = useLatestRef(history.present)

  const actions = useMemo(
    () => ({
      add: (annotation) => dispatch(addAnnotation(annotation)),
      update: (id, patch) => dispatch(updateAnnotation(id, patch)),
      remove: (id) => dispatch(deleteAnnotation(id)),
      duplicate: (id, offset, bounds) => dispatch(duplicateAnnotation(id, offset, bounds)),

      undo: () => dispatch(undo()),
      redo: () => dispatch(redo()),

      // Wrap a continuous gesture so it collapses into one undo step.
      beginGesture: () => dispatch(beginTransaction()),
      endGesture: () => dispatch(commitTransaction()),
      abortGesture: () => dispatch(cancelTransaction()),

      /** Snapshot read for imperative APIs such as getFlattenedPDF(). */
      getSnapshot: () => presentRef.current,
    }),
    [presentRef]
  )

  const value = useMemo(
    () => ({
      annotations: history.present,
      canUndo: canUndoSelector(history),
      canRedo: canRedoSelector(history),
    }),
    [history]
  )

  return (
    <AnnotationActionsContext.Provider value={actions}>
      <AnnotationStateContext.Provider value={value}>{children}</AnnotationStateContext.Provider>
    </AnnotationActionsContext.Provider>
  )
}

function useRequiredContext(context, name) {
  const value = useContext(context)
  if (!value) throw new Error(`${name} must be used inside <PDFViewer>`)
  return value
}

/** Full annotation state plus undo/redo availability. Re-renders on every edit. */
export function useAnnotationState() {
  return useRequiredContext(AnnotationStateContext, 'useAnnotationState')
}

/** Stable action bag. Safe to depend on; never causes a re-render. */
export function useAnnotationActions() {
  return useRequiredContext(AnnotationActionsContext, 'useAnnotationActions')
}

/** Annotations for one page, memoised so a page only re-renders when its own change. */
export function usePageAnnotations(pageIndex) {
  const { annotations } = useAnnotationState()
  return useMemo(() => selectByPage(annotations, pageIndex), [annotations, pageIndex])
}

/** Per-type counts, for host callbacks and download gating. */
export function useAnnotationCounts() {
  const { annotations } = useAnnotationState()
  return useMemo(() => selectCounts(annotations), [annotations])
}

/**
 * Handlers that open a history transaction for the duration of a drag or resize, so
 * the whole gesture is one Ctrl+Z.
 */
export function useGestureHistory() {
  const actions = useAnnotationActions()
  return {
    begin: useCallback(() => actions.beginGesture(), [actions]),
    end: useCallback(() => actions.endGesture(), [actions]),
    abort: useCallback(() => actions.abortGesture(), [actions]),
  }
}
