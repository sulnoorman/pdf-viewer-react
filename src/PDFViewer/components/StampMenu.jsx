import { useEffect, useRef, useState } from 'react'
import IconRubberStamp from '@tabler/icons-react/dist/esm/icons/IconRubberStamp.mjs'
import IconChevronDown from '@tabler/icons-react/dist/esm/icons/IconChevronDown.mjs'
import IconUpload from '@tabler/icons-react/dist/esm/icons/IconUpload.mjs'
import controls from '../styles/controls.module.css'
import styles from './StampMenu.module.css'
import { useLabels } from '../context/LabelContext.jsx'

/**
 * "Add Stamp" as a split button: the main half places the last used image, the caret
 * opens the full list plus an upload entry.
 *
 * Before this there was exactly one stamp image, fixed by the host in
 * `config.specimenAsset`, and no way for the person actually signing to supply their
 * own signature.
 */
export function StampMenu({ assets, allowUpload, onAddStamp, onUpload, disabled }) {
  const labels = useLabels()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)

  // A menu that only closes when you pick something is a trap on touch devices.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const hasChoice = assets.length > 1 || allowUpload
  const primaryDisabled = disabled || assets.length === 0

  return (
    <div ref={containerRef} className={styles.wrap}>
      <button
        type="button"
        onClick={() => onAddStamp()}
        disabled={primaryDisabled}
        className={`${controls.chipButton} ${hasChoice ? styles.main : ''}`}
        title={assets.length === 0 ? labels.noStampConfigured : labels.addStamp}
        aria-label={labels.addStamp}
      >
        <IconRubberStamp size={16} stroke={2} />
      </button>

      {hasChoice && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${controls.chipButton} ${styles.caret}`}
          aria-label={labels.chooseStamp}
          aria-expanded={open}
          title={labels.chooseStamp}
        >
          <IconChevronDown size={14} stroke={2} />
        </button>
      )}

      {open && (
        <div className={styles.menu}>
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => {
                setOpen(false)
                onAddStamp(asset.id)
              }}
              className={styles.item}
            >
              <img src={asset.src} alt="" className={styles.thumb} />
              <span className={styles.itemLabel}>{asset.label}</span>
            </button>
          ))}

          {allowUpload && (
            <>
              {assets.length > 0 && <div className={styles.separator} />}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={styles.item}
              >
                <IconUpload size={16} stroke={2} />
                {labels.uploadImage}
              </button>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className={styles.hiddenInput}
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Reset so picking the same file twice still fires a change event.
          e.target.value = ''
          setOpen(false)
          if (file) onUpload(file)
        }}
      />
    </div>
  )
}
