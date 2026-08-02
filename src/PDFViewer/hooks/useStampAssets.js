import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createId } from '../utils/id.js'

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
 * @param {object} params
 * @param {string} [params.specimenAsset] legacy single-image prop
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
   * assetId -> { id, label, src, bytes?, mimeType? }.
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
      [id]: { id, label: file.name, src: url, bytes, mimeType: file.type },
    }))
    return id
  }, [])

  const list = useMemo(
    () =>
      Object.entries(assets).map(([id, asset]) => ({
        id,
        label: asset.label ?? id,
        src: asset.src,
      })),
    [assets]
  )

  return { assets, list, addUploadedAsset }
}

/** Accept an object map, an array of descriptors, or the legacy single URL. */
function normalizeAssets(stampAssets, specimenAsset) {
  const result = {}

  if (Array.isArray(stampAssets)) {
    for (const asset of stampAssets) {
      if (!asset?.id || !asset.src) continue
      result[asset.id] = { id: asset.id, label: asset.label ?? asset.id, src: asset.src }
    }
  } else if (stampAssets && typeof stampAssets === 'object') {
    for (const [id, value] of Object.entries(stampAssets)) {
      if (!value) continue
      result[id] =
        typeof value === 'string'
          ? { id, label: id, src: value }
          : { id, label: value.label ?? id, ...value }
    }
  }

  // `specimenAsset` is the original single-image API, kept working as the entry named
  // 'default' so existing integrations do not have to change.
  if (specimenAsset && !result.default) {
    result.default = { id: 'default', label: 'Signature', src: specimenAsset }
  }

  return result
}
