import { createContext, useContext, useReducer, useMemo, useCallback, useEffect } from 'react'
import { useLatestRef } from '../hooks/useLatestRef.js'
import {
  annotationReducer,
  initialAnnotationState,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
  duplicateAnnotation,
  annotationsToState,
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
  resetHistory,
  adoptDocument,
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

let warnedAboutLostDocumentId = false

/**
 * Whether a change in `documentId` means "a different document", which is the only thing
 * that may throw annotations away.
 *
 * Two changes look like switches but are not, and both are ordinary host code:
 *
 * - **`undefined` → an id.** `documentId={file?.id}` starts undefined while the metadata is
 *   still being fetched. Treating that as a switch would delete anything drawn in the
 *   meantime — work the user watched themselves do.
 * - **an id → `undefined`.** Almost certainly a bug on the host's side (a fetch that failed,
 *   a state reset), and throwing away a reviewer's annotations over it would be the worst
 *   possible reading. The store is kept and the host is told, once.
 */
function isDocumentSwitch(from, to) {
  if (from === to) return false
  if (from === undefined || from === null) return false

  if (to === undefined || to === null) {
    if (!warnedAboutLostDocumentId) {
      warnedAboutLostDocumentId = true
      console.warn(
        `[@armsolusi/pdf-viewer] \`documentId\` went from ${JSON.stringify(from)} to ` +
          `${to} — the annotations for it have been kept.\n` +
          'Pass a stable id for as long as the document is open. If it comes from data you ' +
          'fetch, render <PDFViewer> only once you have it rather than letting the id blink.'
      )
    }
    return false
  }

  return true
}

/**
 * @param {object} props
 * @param {string|number} [props.documentId] identifies the document the annotations belong
 *   to. When it changes the store is emptied and re-seeded, so one mounted viewer can move
 *   between documents — tabs of attachments, say — without their annotations mixing.
 * @param {Array<object>} [props.initialAnnotations] seed for the current document, in the
 *   shape `getAnnotations()` returns. Read only when `documentId` changes.
 */
export function AnnotationProvider({ children, documentId, initialAnnotations }) {
  const [history, dispatch] = useReducer(historyReducer, initialAnnotationState, (present) =>
    createHistoryState(present, documentId)
  )

  /*
   * Which document the store currently holds — kept inside the reducer state, not beside it.
   *
   * The mismatch has to be visible *during* render, because an effect runs after the paint:
   * reset from an effect alone and the previous attachment's annotations are drawn over the
   * new document for one frame — the exact symptom this feature removes, only briefer.
   *
   * That ruled out the two obvious homes for it. A ref cannot be read during render
   * (`react-hooks/refs`), and a `useState` companion cannot be written from an effect
   * (`react-hooks/set-state-in-effect`). Both rules are right, and working around either
   * with a second reducer standing in for `useState` would have been dodging them rather
   * than answering them. Reading reducer state during render is plainly fine, and it also
   * removes the possibility of the identity drifting out of step with the annotations it
   * describes — they are now one value, updated together or not at all.
   */
  const switching = isDocumentSwitch(history.documentId, documentId)

  /*
   * The seed is read here and nowhere else, which is what makes `initialAnnotations` behave
   * like `defaultValue` rather than a controlled prop — deliberate, because the host stores
   * what `onAnnotationsSnapshot` reports and so changes this prop on every single edit.
   * Reacting to that would be a loop with no end.
   */
  const seeded = useMemo(
    () => (switching ? annotationsToState(initialAnnotations) : null),
    [switching, initialAnnotations]
  )

  // Serving the seed straight away is what makes the switch flash-free.
  const present = switching ? seeded : history.present

  useEffect(() => {
    if (history.documentId === documentId) return
    // Recorded even when it was not a real switch, so `undefined -> id` is forgiven once
    // rather than leaving every later comparison measured against the original blank.
    dispatch(switching ? resetHistory(seeded, documentId) : adoptDocument(documentId))
  }, [history.documentId, documentId, switching, seeded])

  // Lets imperative callers read the latest annotations without re-subscribing.
  const presentRef = useLatestRef(present)
  // Read inside `replaceAll` rather than during render, which is what a ref is for. It
  // cannot be a dependency of `actions`: that bag's identity is promised to be stable.
  const documentIdRef = useLatestRef(documentId)

  const actions = useMemo(
    () => ({
      add: (annotation) => dispatch(addAnnotation(annotation)),
      update: (id, patch) => dispatch(updateAnnotation(id, patch)),
      remove: (id) => dispatch(deleteAnnotation(id)),
      duplicate: (id, offset, bounds) => dispatch(duplicateAnnotation(id, offset, bounds)),

      /**
       * Replace everything — restoring a draft that arrived after mount, say. History goes
       * with it: there is nothing meaningful to undo past a wholesale replacement, and
       * leaving it would let one Ctrl+Z discard the draft just loaded.
       *
       * The document identity is carried through unchanged. Dropping it would leave the
       * store claiming to hold no document, and the next render would spend itself putting
       * that right.
       */
      replaceAll: (annotations) =>
        dispatch(resetHistory(annotationsToState(annotations), documentIdRef.current)),

      undo: () => dispatch(undo()),
      redo: () => dispatch(redo()),

      // Wrap a continuous gesture so it collapses into one undo step.
      beginGesture: () => dispatch(beginTransaction()),
      endGesture: () => dispatch(commitTransaction()),
      abortGesture: () => dispatch(cancelTransaction()),

      /** Snapshot read for imperative APIs such as getFlattenedPDF(). */
      getSnapshot: () => presentRef.current,
    }),
    [presentRef, documentIdRef]
  )

  const value = useMemo(
    () => ({
      annotations: present,
      // Mid-switch the store still holds the previous document's history, so offering undo
      // would step into annotations that are no longer on screen.
      canUndo: !switching && canUndoSelector(history),
      canRedo: !switching && canRedoSelector(history),
    }),
    [history, present, switching]
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
