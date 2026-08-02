import { createContext, useContext } from 'react'

/**
 * Document-level view state: the loaded document, its page geometry, the current
 * zoom, and the scroll container every page positions itself inside.
 *
 * This replaces a chain that threaded fourteen identical props from the viewer down
 * through Document and Page, twelve of which Document did nothing with but pass on.
 *
 * The caller owns memoisation of `value` — a provider cannot memoise an object it
 * receives already-built without a variable-length dependency list.
 */
const ViewerContext = createContext(null)

export function ViewerProvider({ value, children }) {
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
}

export function useViewer() {
  const value = useContext(ViewerContext)
  if (!value) throw new Error('useViewer must be used inside <PDFViewer>')
  return value
}
