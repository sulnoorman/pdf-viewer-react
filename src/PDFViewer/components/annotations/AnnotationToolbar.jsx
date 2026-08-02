import IconTrash from '@tabler/icons-react/dist/esm/icons/IconTrash.mjs'
import IconCopy from '@tabler/icons-react/dist/esm/icons/IconCopy.mjs'
import IconDroplet from '@tabler/icons-react/dist/esm/icons/IconDroplet.mjs'
import styles from './AnnotationToolbar.module.css'
import { useLabels } from '../../context/LabelContext.jsx'

/**
 * The floating bar shown under a selected annotation.
 *
 * Image and text stamps had near-identical bars that drifted apart — the text one
 * grew a font picker and a colour well while the image one stayed a lone delete
 * button, and each re-implemented its own styling. This holds everything they share;
 * type-specific controls come in as `children` and appear first.
 *
 * Positioning and counter-rotation are TransformBox's job; this only draws the bar.
 * `data-no-drag` is what stops a click here from starting a move gesture.
 */
export function AnnotationToolbar({ annotation, onEdit, onDuplicate, onDelete, children }) {
  const labels = useLabels()
  const opacity = annotation.opacity ?? 1

  return (
    <div data-no-drag className={styles.bar}>
      {children}
      {children && <span className={styles.divider} />}

      <label className={styles.opacity} title={labels.opacity}>
        <IconDroplet size={14} stroke={2} className={styles.opacityIcon} />
        <input
          type="range"
          min="10"
          max="100"
          value={Math.round(opacity * 100)}
          onChange={(e) => onEdit(annotation.id, { opacity: Number(e.target.value) / 100 })}
          className={styles.opacityRange}
          aria-label={labels.opacity}
        />
        <span className={styles.opacityValue}>{Math.round(opacity * 100)}%</span>
      </label>

      <span className={styles.divider} />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDuplicate(annotation.id)
        }}
        className={styles.button}
        title={labels.duplicate}
        aria-label={labels.duplicate}
      >
        <IconCopy size={16} stroke={2} />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(annotation.id)
        }}
        className={styles.button}
        title={labels.delete}
        aria-label={labels.delete}
      >
        <IconTrash size={16} stroke={2} />
      </button>
    </div>
  )
}
