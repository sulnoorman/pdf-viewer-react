import { createContext, useContext, useState, useMemo, useRef, useCallback } from 'react'

/**
 * Which tool is active, its settings, and which annotation is selected.
 *
 * Selection lives here rather than in the annotation store on purpose: selecting an
 * object is not an edit, so it must never create an undo step.
 */
const ToolContext = createContext(null)

export function ToolProvider({ children }) {
  const [isDrawMode, setIsDrawMode] = useState(false)
  const [inkColor, setInkColor] = useState('#000000')
  const [inkThickness, setInkThickness] = useState(2)
  const [inkOpacity, setInkOpacity] = useState(1)
  const [activeId, setActiveIdState] = useState(null)

  // Window-level keyboard handlers need the current selection without being
  // re-registered on every selection change.
  const activeIdRef = useRef(null)
  const setActiveId = useCallback((id) => {
    activeIdRef.current = id
    setActiveIdState(id)
  }, [])

  /**
   * Live-gesture handles, shared so the pinch handler can tell what a single finger
   * is already doing. See usePinchZoom for the disambiguation rules.
   *
   * `cancelStrokeRef` is set by whichever ink layer currently owns a stroke;
   * `isDraggingRef` is set while a TransformBox owns a pointer.
   */
  const cancelStrokeRef = useRef(null)
  const isDraggingRef = useRef(false)

  const value = useMemo(
    () => ({
      isDrawMode,
      setIsDrawMode,
      inkColor,
      setInkColor,
      inkThickness,
      setInkThickness,
      inkOpacity,
      setInkOpacity,
      activeId,
      setActiveId,
      activeIdRef,
      cancelStrokeRef,
      isDraggingRef,
    }),
    [isDrawMode, inkColor, inkThickness, inkOpacity, activeId, setActiveId]
  )

  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>
}

export function useTools() {
  const value = useContext(ToolContext)
  if (!value) throw new Error('useTools must be used inside <PDFViewer>')
  return value
}
