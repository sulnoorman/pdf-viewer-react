import { useEffect, useRef, useState } from 'react'
import IconChevronDown from '@tabler/icons-react/dist/esm/icons/IconChevronDown.mjs'
import controls from '../styles/controls.module.css'
import styles from './SplitMenu.module.css'

/**
 * A primary action with an optional dropdown beside it.
 *
 * Shared by the stamp and image toolbar controls, which have the same shape and the
 * same dismissal rules but list different things. The caret is only rendered when
 * `items` is non-empty, so a viewer configured with a single stamp shows a plain
 * button rather than a menu that can only ever contain one entry.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.icon      primary button content
 * @param {() => void} props.onPrimary                primary action
 * @param {boolean} [props.disabled]                  disables the primary button
 * @param {string} props.label                        accessible name for the primary
 * @param {string} [props.title]                      tooltip; falls back to `label`
 * @param {string} props.menuLabel                    accessible name for the caret
 * @param {Array<{id: string, label: string, src?: string}>} [props.items]
 * @param {(id: string) => void} [props.onSelect]
 * @param {import('react').ReactNode} [props.footer]  extra entry below the list
 */
export function SplitMenu({
  icon,
  onPrimary,
  disabled = false,
  label,
  title,
  menuLabel,
  items = [],
  onSelect,
  footer = null,
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

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

  const hasMenu = items.length > 0 || footer !== null

  return (
    <div ref={containerRef} className={styles.wrap}>
      <button
        type="button"
        onClick={onPrimary}
        disabled={disabled}
        className={`${controls.chipButton} ${hasMenu ? styles.main : ''}`}
        title={title ?? label}
        aria-label={label}
      >
        {icon}
      </button>

      {hasMenu && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${controls.chipButton} ${styles.caret}`}
          aria-label={menuLabel}
          aria-expanded={open}
          title={menuLabel}
        >
          <IconChevronDown size={14} stroke={2} />
        </button>
      )}

      {open && hasMenu && (
        <div className={styles.menu}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setOpen(false)
                onSelect?.(item.id)
              }}
              className={styles.item}
            >
              {item.src && <img src={item.src} alt="" className={styles.thumb} />}
              <span className={styles.itemLabel}>{item.label}</span>
            </button>
          ))}

          {footer && (
            <>
              {items.length > 0 && <div className={styles.separator} />}
              {footer}
            </>
          )}
        </div>
      )}
    </div>
  )
}
