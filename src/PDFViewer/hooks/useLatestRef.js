import { useRef, useEffect } from 'react'

/**
 * Keep a ref pointing at the newest value without writing to it during render.
 *
 * Used wherever a long-lived subscriber — a window keydown listener, an imperative
 * handle, a callback the host passed inline — needs the current value but must not
 * be torn down and re-created every time that value changes.
 *
 * The assignment happens in an effect, so the ref is current from the first commit
 * onwards. That is early enough for every consumer here: all of them read it from
 * event handlers or imperative calls, never during render.
 */
export function useLatestRef(value) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}
