import { useEffect } from 'react'
import { useLatestRef } from './useLatestRef.js'

/** True when the user is typing, so editing keys must not be hijacked. */
function isTypingTarget(target) {
  const tag = target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable === true
}

/**
 * Window-level shortcuts.
 *
 * Handlers are read through a ref so the listener registers once and still sees the
 * current callbacks. The previous implementation registered with an empty dependency
 * array and worked around the resulting stale closure with a hand-maintained mirror
 * ref for the selected id — which had to be updated at every call site.
 */
export function useKeyboardShortcuts(handlers) {
  const handlersRef = useLatestRef(handlers)

  useEffect(() => {
    const onKeyDown = (e) => {
      const h = handlersRef.current
      const mod = e.ctrlKey || e.metaKey

      if (mod) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault()
            h.onZoomIn?.()
            return
          case '-':
            e.preventDefault()
            h.onZoomOut?.()
            return
          case '0':
            e.preventDefault()
            h.onZoomReset?.()
            return
          case 'z':
            if (isTypingTarget(e.target)) return
            e.preventDefault()
            // Ctrl+Shift+Z is the other common redo binding alongside Ctrl+Y.
            if (e.shiftKey) h.onRedo?.()
            else h.onUndo?.()
            return
          case 'y':
            if (isTypingTarget(e.target)) return
            e.preventDefault()
            h.onRedo?.()
            return
          case 'd':
            if (isTypingTarget(e.target)) return
            // Only swallow the browser's bookmark shortcut when there is something
            // selected to duplicate.
            if (h.onDuplicate?.()) e.preventDefault()
            return
          case 'c':
            // Never intercept a real text copy.
            if (isTypingTarget(e.target) || !window.getSelection()?.isCollapsed) return
            h.onCopy?.()
            return
          case 'v':
            if (isTypingTarget(e.target)) return
            if (h.onPaste?.()) e.preventDefault()
            return
          default:
            return
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isTypingTarget(e.target)) return
        if (!h.onDelete?.()) return
        e.preventDefault()
        return
      }

      if (e.key === 'Escape') {
        h.onEscape?.()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlersRef])
}
