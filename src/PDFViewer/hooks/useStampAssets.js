import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createId } from '../utils/id.js'

/**
 * The id `config.specimenAsset` is registered under. Reserved: a host entry using this
 * id is treated as a specimen too rather than colliding with the configured one.
 */
export const SPECIMEN_ASSET_ID = 'specimen'

/** What an asset means to the host, which is what `hasSpecimen` is derived from. */
export const ASSET_KINDS = Object.freeze({ SPECIMEN: 'specimen', STAMP: 'stamp' })

/**
 * The set of images available as stamps.
 *
 * The original API took a single `config.specimenAsset` URL, so a viewer could only
 * ever place one image and the user could not supply their own signature. This
 * combines three sources into one registry keyed by `assetId`, which is what an image
 * annotation stores and what the exporter embeds once per distinct id.
 *
 * Accepted shapes for `config.stampAssets`:
 *   - `{ seal: '/seal.png', sign: '/sign.png' }`
 *   - `[{ id: 'seal', label: 'Company seal', src: '/seal.png' }]`
 *
 * Every entry carries a `kind`. Without it "has the document been signed?" is
 * unanswerable: a seal, a user's uploaded doodle and the configured specimen all
 * produce the same image annotation, so counting images cannot tell them apart.
 *
 * @param {object} params
 * @param {string} [params.specimenAsset] the signature image, registered as a specimen
 * @param {object|Array} [params.stampAssets] host-provided registry
 */
export function useStampAssets({ specimenAsset, stampAssets }) {
  const [uploaded, setUploaded] = useState({})

  // Object URLs outlive React state, so they are tracked separately and revoked on
  // unmount; leaking them keeps the whole image alive for the life of the tab.
  const objectUrlsRef = useRef([])
  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.length = 0
    }
  }, [])

  const provided = useMemo(() => normalizeAssets(stampAssets, specimenAsset), [
    stampAssets,
    specimenAsset,
  ])

  /**
   * assetId -> { id, kind, label, src, bytes?, mimeType? }.
   * The exporter reads `bytes` when present and falls back to fetching `src`.
   */
  const assets = useMemo(() => ({ ...provided, ...uploaded }), [provided, uploaded])

  /**
   * Register a user-picked image.
   *
   * Both the bytes and an object URL are kept: the URL renders on screen, and the
   * bytes go straight to pdf-lib so export never has to re-read a blob URL that the
   * browser may already have released.
   */
  const addUploadedAsset = useCallback(async (file) => {
    if (!file) return null

    const bytes = await file.arrayBuffer()
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.push(url)

    const id = createId('asset')
    setUploaded((current) => ({
      ...current,
      // An image the user picked is never the configured specimen, however much it
      // may look like a signature — otherwise anyone could satisfy a "must be signed"
      // check by uploading a blank PNG.
      [id]: {
        id,
        kind: ASSET_KINDS.STAMP,
        label: file.name,
        src: url,
        bytes,
        mimeType: file.type,
      },
    }))
    return id
  }, [])

  const list = useMemo(
    () =>
      Object.entries(assets).map(([id, asset]) => ({
        id,
        kind: asset.kind ?? ASSET_KINDS.STAMP,
        label: asset.label ?? id,
        src: asset.src,
      })),
    [assets]
  )

  return { assets, list, addUploadedAsset }
}

/**
 * Accept an object map, an array of descriptors, or the single `specimenAsset` URL.
 *
 * Entries default to `kind: 'stamp'`. A host that genuinely has several signature
 * images can mark them `kind: 'specimen'` itself, which keeps multi-signature flows
 * working without inventing a second registry.
 */
export function normalizeAssets(stampAssets, specimenAsset) {
  const result = {}

  const put = (id, asset) => {
    if (!id || !asset?.src) return
    result[id] = {
      ...asset,
      id,
      kind: asset.kind === ASSET_KINDS.SPECIMEN ? ASSET_KINDS.SPECIMEN : ASSET_KINDS.STAMP,
      label: asset.label ?? id,
    }
  }

  if (Array.isArray(stampAssets)) {
    for (const asset of stampAssets) put(asset?.id, asset)
  } else if (stampAssets && typeof stampAssets === 'object') {
    for (const [id, value] of Object.entries(stampAssets)) {
      if (!value) continue
      put(id, typeof value === 'string' ? { src: value } : value)
    }
  }

  /*
   * `specimenAsset` owns a reserved id of its own.
   *
   * It used to be flattened into an entry called 'default', which lost the fact that
   * it was the specimen and — worse — was silently dropped whenever the host also
   * passed `stampAssets.default`. A host entry that happens to use the reserved id is
   * simply promoted to a specimen instead of being overwritten.
   */
  if (specimenAsset) {
    const existing = result[SPECIMEN_ASSET_ID]
    result[SPECIMEN_ASSET_ID] = existing
      ? { ...existing, kind: ASSET_KINDS.SPECIMEN }
      : {
          id: SPECIMEN_ASSET_ID,
          kind: ASSET_KINDS.SPECIMEN,
          label: 'Signature',
          src: specimenAsset,
        }
  }

  return result
}
