import { ANNOTATION_TYPES } from '../reducers/annotationReducer.js'
import { ASSET_KINDS } from '../hooks/useStampAssets.js'

/**
 * The document-level questions a host actually asks, derived in one place.
 *
 * `hasSpecimen` deliberately does NOT read `counts.image`. A seal from
 * `config.stampAssets` and an image the user uploaded are both image annotations, so
 * counting images answers "is there a picture on the page?", not "has this been
 * signed?". The two are only separable by joining each annotation back to the asset
 * it points at and reading that asset's `kind` — which is why assets carry one.
 *
 * Kept pure and outside the annotation store: the store knows about shapes on pages
 * and has no business knowing what an image is *for*.
 *
 * @param {object} params
 * @param {Array} params.annotations  in paint order, as `selectAll` returns them
 * @param {Record<string, {kind?: string}>} params.assets  the stamp asset registry
 */
export function deriveViewerState({ annotations = [], assets = {} } = {}) {
  const counts = { specimen: 0, stamp: 0, image: 0, text: 0, ink: 0, total: 0 }

  for (const annotation of annotations) {
    switch (annotation?.type) {
      case ANNOTATION_TYPES.IMAGE: {
        counts.image += 1
        counts.total += 1
        // An unknown assetId counts as a plain stamp. Being lenient here is the safe
        // direction: the strict one would report a document as signed on the strength
        // of an asset that is not in the registry at all.
        if (assets[annotation.assetId]?.kind === ASSET_KINDS.SPECIMEN) counts.specimen += 1
        else counts.stamp += 1
        break
      }
      case ANNOTATION_TYPES.TEXT:
        counts.text += 1
        counts.total += 1
        break
      case ANNOTATION_TYPES.INK:
        counts.ink += 1
        counts.total += 1
        break
      default:
        break
    }
  }

  return {
    /** At least one stamp from an asset the host registered as a specimen. */
    hasSpecimen: counts.specimen > 0,
    /**
     * At least one mark the user made themselves — ink or text.
     *
     * Stamps are excluded on purpose. The two flags are independent because the
     * workflows are: some documents need only a signature, others need only a
     * hand-written note and no signature at all.
     */
    hasAnnotation: counts.ink > 0 || counts.text > 0,
    counts,
  }
}

/**
 * Compare two count objects by value.
 *
 * `onAnnotationsChange` used to fire on every store change, so dragging a stamp one
 * pixel re-notified the host with numbers that had not moved. Hosts that call
 * `setState` from it were re-rendering their whole tree on every pointer-up.
 */
export function sameCounts(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => a[key] === b[key])
}
