import { useState } from 'react'
import IconChevronUp from '@tabler/icons-react/dist/esm/icons/IconChevronUp.mjs'
import IconChevronDown from '@tabler/icons-react/dist/esm/icons/IconChevronDown.mjs'
import controls from '../styles/controls.module.css'
import styles from './PageNavigation.module.css'
import { useLabels } from '../context/LabelContext.jsx'

/**
 * Page number box with previous/next.
 *
 * There was no way to reach a specific page at all before this: getting to page 40 of
 * 100 meant scrolling by hand.
 *
 * While the field has focus it shows the user's draft; otherwise it shows the live
 * page number. Deriving it this way — rather than syncing a draft in an effect — means
 * typing "4" is never overwritten the instant scrolling moves the active page on.
 */
export function PageNavigation({ pageCount, activePageIndex, onGoToPage }) {
  const labels = useLabels()
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  const value = editing ? draft : String(activePageIndex + 1)

  if (!pageCount) return null

  const commit = () => {
    setEditing(false)
    const parsed = Number.parseInt(draft, 10)
    if (Number.isNaN(parsed)) return
    onGoToPage(Math.max(1, Math.min(pageCount, parsed)) - 1)
  }

  const canPrev = activePageIndex > 0
  const canNext = activePageIndex < pageCount - 1

  return (
    <div className={styles.nav}>
      <button
        type="button"
        onClick={() => onGoToPage(activePageIndex - 1)}
        disabled={!canPrev}
        className={controls.iconButton}
        title={labels.previousPage}
        aria-label={labels.previousPage}
      >
        <IconChevronUp size={16} stroke={2} />
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={value}
        aria-label={labels.pageNumber}
        onFocus={(e) => {
          setDraft(String(activePageIndex + 1))
          setEditing(true)
          e.target.select()
        }}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            setEditing(false)
            e.currentTarget.blur()
          }
        }}
        className={styles.input}
      />

      <span className={styles.total}>/ {pageCount}</span>

      <button
        type="button"
        onClick={() => onGoToPage(activePageIndex + 1)}
        disabled={!canNext}
        className={controls.iconButton}
        title={labels.nextPage}
        aria-label={labels.nextPage}
      >
        <IconChevronDown size={16} stroke={2} />
      </button>
    </div>
  )
}
