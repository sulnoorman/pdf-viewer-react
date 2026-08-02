import { createContext, useContext, useMemo } from 'react'
import { DEFAULT_LABELS, mergeLabels } from '../labels.js'

/**
 * UI strings, in their own context.
 *
 * Kept apart from ViewerContext on purpose: that value changes on every zoom step, so
 * putting labels there would re-render every component that only ever reads static
 * text. This value changes only when the host passes a different `labels` object.
 */
const LabelContext = createContext(DEFAULT_LABELS)

export function LabelProvider({ labels, children }) {
  const value = useMemo(() => mergeLabels(labels), [labels])
  return <LabelContext.Provider value={value}>{children}</LabelContext.Provider>
}

/** All resolved labels. Falls back to the English defaults outside a provider. */
export function useLabels() {
  return useContext(LabelContext)
}
