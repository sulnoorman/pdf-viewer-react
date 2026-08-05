import { useRef } from 'react'
import IconPhotoPlus from '@tabler/icons-react/dist/esm/icons/IconPhotoPlus.mjs'
import { SplitMenu } from './SplitMenu.jsx'
// The same stylesheet, so the footer entry matches the list items above it.
import styles from './SplitMenu.module.css'
import { useLabels } from '../context/LabelContext.jsx'

/**
 * Bring in an image of the user's own, and re-place ones already brought in.
 *
 * The counterpart to StampMenu: that one offers what the host configured, this one what
 * the person signing supplied. Splitting them is why the stamp control can drop its
 * dropdown — the upload entry no longer has to live behind a caret that was therefore
 * always present.
 *
 * The primary button opens the file picker straight away, because the first use is
 * always "I do not have one yet". Previously uploaded images collect behind the caret,
 * so a second placement does not mean picking the same file from disk again.
 */
export function ImageMenu({ uploaded, onAddStamp, onUpload, disabled }) {
  const labels = useLabels()
  const fileInputRef = useRef(null)

  const pickFile = () => fileInputRef.current?.click()

  return (
    <>
      <SplitMenu
        icon={<IconPhotoPlus size={16} stroke={2} />}
        onPrimary={pickFile}
        disabled={disabled}
        label={labels.addImage}
        menuLabel={labels.chooseImage}
        items={uploaded}
        onSelect={onAddStamp}
        // Repeated here so the menu is never a dead end: with images already uploaded,
        // the caret must still offer a way to add another.
        footer={
          uploaded.length > 0 ? (
            <button type="button" onClick={pickFile} className={styles.item}>
              {labels.uploadImage}
            </button>
          ) : null
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className={styles.hiddenInput}
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Reset so picking the same file twice still fires a change event.
          e.target.value = ''
          if (file) onUpload(file)
        }}
      />
    </>
  )
}
