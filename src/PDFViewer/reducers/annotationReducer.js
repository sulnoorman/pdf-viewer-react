import { createId } from '../utils/id.js'
import { pointsBBox } from '../utils/coords.js'

/**
 * The annotation store.
 *
 * Previously there were three disjoint stores with three different shapes:
 *   - `stamps`      : Array
 *   - `textStamps`  : Array
 *   - `inkHistory`  : Array<Record<pageIndex, Path[]>>  (its own 50-step history)
 *
 * That is why undo/redo only ever worked for ink, and why pressing Ctrl+Z after
 * moving a stamp silently reverted an unrelated pen stroke. One normalised store
 * makes a single history stack cover every annotation type.
 *
 * Shape:
 *   { byId: { [id]: Annotation }, order: string[] }
 *
 * `order` is the paint order and therefore the z-order; export walks it so the
 * exported file stacks objects the same way the screen does.
 *
 * Every coordinate here is in **view space** (PDF points, top-left origin, y down,
 * no zoom applied) — see utils/coords.js.
 */

/** @typedef {'image'|'text'|'ink'} AnnotationType */

export const ANNOTATION_TYPES = Object.freeze({
  IMAGE: 'image',
  TEXT: 'text',
  INK: 'ink',
})

export const initialAnnotationState = Object.freeze({ byId: {}, order: [] })

/* ------------------------------------------------------------------ *
 * Factories
 * ------------------------------------------------------------------ */

const baseDefaults = {
  pageIndex: 0,
  x: 50,
  y: 50,
  rotation: 0,
  opacity: 1,
}

/**
 * An image/signature stamp.
 * `assetId` names an entry in the stamp asset registry rather than embedding a URL,
 * so export can embed each distinct image exactly once.
 */
export function createImageAnnotation({
  assetId = 'default',
  width = 150,
  height = 60,
  ...rest
} = {}) {
  return {
    ...baseDefaults,
    ...rest,
    id: rest.id ?? createId(ANNOTATION_TYPES.IMAGE),
    type: ANNOTATION_TYPES.IMAGE,
    assetId,
    width,
    height,
  }
}

/** An editable text box. */
export function createTextAnnotation({
  text = '',
  fontSize = 16,
  color = '#000000',
  fontFamily = 'Helvetica',
  width = 250,
  height = 50,
  ...rest
} = {}) {
  return {
    ...baseDefaults,
    ...rest,
    id: rest.id ?? createId(ANNOTATION_TYPES.TEXT),
    type: ANNOTATION_TYPES.TEXT,
    text,
    fontSize,
    color,
    fontFamily,
    width,
    height,
  }
}

/**
 * A freehand stroke. x/y/width/height are the derived bounding box, kept in sync so
 * selection and hit-testing can treat every annotation type uniformly.
 */
export function createInkAnnotation({
  points = [],
  color = '#000000',
  strokeWidth = 2,
  ...rest
} = {}) {
  const bbox = pointsBBox(points)
  return {
    ...baseDefaults,
    ...rest,
    id: rest.id ?? createId(ANNOTATION_TYPES.INK),
    type: ANNOTATION_TYPES.INK,
    points,
    color,
    strokeWidth,
    ...bbox,
  }
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

export const ANNOTATION_ACTIONS = Object.freeze({
  ADD: 'annotation/add',
  UPDATE: 'annotation/update',
  DELETE: 'annotation/delete',
  DELETE_MANY: 'annotation/deleteMany',
  DUPLICATE: 'annotation/duplicate',
  BRING_TO_FRONT: 'annotation/bringToFront',
  SEND_TO_BACK: 'annotation/sendToBack',
  REPLACE_ALL: 'annotation/replaceAll',
})

export const addAnnotation = (annotation) => ({
  type: ANNOTATION_ACTIONS.ADD,
  annotation,
})
export const updateAnnotation = (id, patch) => ({
  type: ANNOTATION_ACTIONS.UPDATE,
  id,
  patch,
})
export const deleteAnnotation = (id) => ({ type: ANNOTATION_ACTIONS.DELETE, id })
export const duplicateAnnotation = (id, offset) => ({
  type: ANNOTATION_ACTIONS.DUPLICATE,
  id,
  offset,
})

/* ------------------------------------------------------------------ *
 * Reducer
 * ------------------------------------------------------------------ */

/** Keep the ink bbox in sync whenever points change. */
function withDerivedBBox(annotation) {
  if (annotation.type !== ANNOTATION_TYPES.INK) return annotation
  return { ...annotation, ...pointsBBox(annotation.points) }
}

/**
 * @param {{byId: Record<string, object>, order: string[]}} state
 * @param {{type: string}} action
 */
export function annotationReducer(state = initialAnnotationState, action) {
  switch (action.type) {
    case ANNOTATION_ACTIONS.ADD: {
      const annotation = withDerivedBBox(action.annotation)
      if (!annotation?.id || state.byId[annotation.id]) return state
      return {
        byId: { ...state.byId, [annotation.id]: annotation },
        order: [...state.order, annotation.id],
      }
    }

    case ANNOTATION_ACTIONS.UPDATE: {
      const existing = state.byId[action.id]
      if (!existing) return state

      const merged = withDerivedBBox({ ...existing, ...action.patch })

      // Bail out when nothing actually changed so history does not gain a no-op entry
      // (drag handlers fire continuously and would otherwise flood the undo stack).
      const unchanged = Object.keys(action.patch ?? {}).every((key) =>
        Object.is(existing[key], merged[key])
      )
      if (unchanged) return state

      return { ...state, byId: { ...state.byId, [action.id]: merged } }
    }

    case ANNOTATION_ACTIONS.DELETE: {
      if (!state.byId[action.id]) return state
      const byId = { ...state.byId }
      delete byId[action.id]
      return { byId, order: state.order.filter((id) => id !== action.id) }
    }

    case ANNOTATION_ACTIONS.DELETE_MANY: {
      const ids = new Set(action.ids ?? [])
      if (ids.size === 0) return state
      const present = [...ids].filter((id) => state.byId[id])
      if (present.length === 0) return state

      const byId = { ...state.byId }
      for (const id of present) delete byId[id]
      return { byId, order: state.order.filter((id) => !ids.has(id)) }
    }

    case ANNOTATION_ACTIONS.DUPLICATE: {
      const source = state.byId[action.id]
      if (!source) return state

      const offset = action.offset ?? 12
      const copy = {
        ...source,
        id: createId(source.type),
        x: source.x + offset,
        y: source.y + offset,
      }
      // Points carry absolute coordinates, so a duplicated stroke must be translated
      // too — otherwise the copy sits exactly on top of the original.
      if (copy.type === ANNOTATION_TYPES.INK) {
        copy.points = source.points.map((p) => ({ x: p.x + offset, y: p.y + offset }))
      }

      return {
        byId: { ...state.byId, [copy.id]: copy },
        order: [...state.order, copy.id],
      }
    }

    case ANNOTATION_ACTIONS.BRING_TO_FRONT: {
      if (!state.byId[action.id] || state.order.at(-1) === action.id) return state
      return {
        ...state,
        order: [...state.order.filter((id) => id !== action.id), action.id],
      }
    }

    case ANNOTATION_ACTIONS.SEND_TO_BACK: {
      if (!state.byId[action.id] || state.order[0] === action.id) return state
      return {
        ...state,
        order: [action.id, ...state.order.filter((id) => id !== action.id)],
      }
    }

    case ANNOTATION_ACTIONS.REPLACE_ALL:
      return action.state ?? initialAnnotationState

    default:
      return state
  }
}

/* ------------------------------------------------------------------ *
 * Selectors
 * ------------------------------------------------------------------ */

/** All annotations in paint order. */
export function selectAll(state) {
  return state.order.map((id) => state.byId[id])
}

/** Annotations belonging to one page, in paint order. */
export function selectByPage(state, pageIndex) {
  const result = []
  for (const id of state.order) {
    const annotation = state.byId[id]
    if (annotation?.pageIndex === pageIndex) result.push(annotation)
  }
  return result
}

/** Count per type — drives host callbacks like onAnnotationsChange. */
export function selectCounts(state) {
  const counts = { image: 0, text: 0, ink: 0, total: 0 }
  for (const id of state.order) {
    const type = state.byId[id]?.type
    if (type in counts) counts[type] += 1
    counts.total += 1
  }
  return counts
}
