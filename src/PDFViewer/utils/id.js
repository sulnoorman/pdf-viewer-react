/**
 * Annotation IDs.
 *
 * The previous scheme was `${prefix}-${Date.now()}`, which collides whenever two
 * objects are created within the same millisecond — trivially reachable by
 * paste-multiple or by a programmatic loop calling addTextStamp(). Two annotations
 * sharing an id makes React reuse the wrong DOM node and makes delete remove both.
 */

let counter = 0

/**
 * @param {string} prefix short type tag, e.g. 'image' | 'text' | 'ink'
 * @returns {string} an id unique within this session
 */
export function createId(prefix = 'ann') {
  counter += 1

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  // Monotonic counter keeps this unique even inside a single millisecond.
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

/** Test seam: reset the fallback counter so ids are reproducible. */
export function __resetIdCounter() {
  counter = 0
}
