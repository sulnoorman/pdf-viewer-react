import { memo, useEffect, useRef, useState } from 'react'
import { TransformBox } from './TransformBox.jsx'
import { AnnotationToolbar } from './AnnotationToolbar.jsx'
import { SUPPORTED_FONTS, resolveCssFontStack, resolveFontValue } from '../../utils/fonts.js'
import { TEXT_PADDING, LINE_HEIGHT_RATIO } from '../../utils/exportPdf.js'
import controls from '../../styles/controls.module.css'
import styles from './TextStamp.module.css'
import { useLabels } from '../../context/LabelContext.jsx'

export const MIN_FONT_SIZE = 8
export const MAX_FONT_SIZE = 72

/**
 * An inline-editable text box.
 *
 * Two update paths, deliberately separate:
 *   - `onCommit` — geometry from TransformBox, in SCREEN pixels, converted by Page
 *   - `onEdit`   — content and formatting, already in store units
 *
 * ## Why typing takes a double-click
 *
 * The textarea fills the box, and an editable textarea swallows pointer events to place
 * a caret. While it was always editable the box could never be dragged at all: every
 * press landed on the textarea, selected the annotation and ended there.
 *
 * So the textarea is inert until asked for, exactly as pdf.js and every canvas editor
 * does it — one click selects and drags, a double-click starts typing, and clicking away
 * or pressing Escape stops. A box created from the toolbar opens straight into typing,
 * so "Add text" and host actions like "insert document number" are unaffected.
 */
function TextStampComponent({
  annotation,
  screenRect,
  frameRotation,
  scale,
  isActive,
  autoFocus,
  onSelect,
  onCommit,
  onEdit,
  onDuplicate,
  onDelete,
  onGestureStart,
  onGestureEnd,
  isDraggingRef,
}) {
  const labels = useLabels()
  const fontSize = annotation.fontSize || 16

  const textareaRef = useRef(null)
  const [editing, setEditing] = useState(autoFocus)

  /*
   * Deselecting must also stop editing, or a box left in edit mode keeps swallowing the
   * next drag. Adjusted during render rather than in an effect: this is derived state,
   * and an effect would paint one frame with the stale value.
   */
  const [wasActive, setWasActive] = useState(isActive)
  if (wasActive !== isActive) {
    setWasActive(isActive)
    if (!isActive) setEditing(false)
  }

  // Focus follows the mode, so a double-click puts the caret in without a second click.
  useEffect(() => {
    if (editing) textareaRef.current?.focus()
    else textareaRef.current?.blur()
  }, [editing])

  return (
    <TransformBox
      onActivate={() => setEditing(true)}
      rect={screenRect}
      rotation={annotation.rotation ?? 0}
      frameRotation={frameRotation}
      selected={isActive}
      rotatable
      opacity={annotation.opacity ?? 1}
      isDraggingRef={isDraggingRef}
      onSelect={() => onSelect(annotation.id)}
      onCommit={(rect, rotation, node) => onCommit(annotation.id, rect, rotation, node)}
      toolbar={
        <AnnotationToolbar
          annotation={annotation}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        >
          <input
            type="number"
            value={fontSize}
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10)
              if (Number.isNaN(next)) return
              onEdit(annotation.id, {
                fontSize: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, next)),
              })
            }}
            className={controls.numberInput}
            title={labels.fontSize}
          />

          <select
            value={resolveFontValue(annotation.fontFamily)}
            onChange={(e) => onEdit(annotation.id, { fontFamily: e.target.value })}
            className={controls.select}
            title={labels.font}
          >
            {SUPPORTED_FONTS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>

          <div
            className={controls.colorWell}
            title={labels.textColour}
          >
            <input
              type="color"
              value={annotation.color || '#000000'}
              onChange={(e) => onEdit(annotation.id, { color: e.target.value })}
              />
          </div>
        </AnnotationToolbar>
      }
    >
      <textarea
        ref={textareaRef}
        // Only a textarea in edit mode blocks dragging; the rest of the time the whole
        // box is a drag surface.
        {...(editing ? { 'data-no-drag': true } : {})}
        readOnly={!editing}
        value={annotation.text}
        placeholder={labels.textPlaceholder}
        onChange={(e) => onEdit(annotation.id, { text: e.target.value })}
        // Typing is wrapped in one history transaction per editing session, so a
        // sentence costs one Ctrl+Z instead of one per keystroke — which would
        // otherwise flush the whole undo stack.
        onFocus={onGestureStart}
        onBlur={() => {
          onGestureEnd?.()
          setEditing(false)
        }}
        // Escape leaves the text box without also clearing the selection, which is what
        // the viewer-wide Escape shortcut would otherwise do.
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          e.stopPropagation()
          setEditing(false)
        }}
        className={`${styles.textarea} ${editing ? styles.textareaEditing : ''}`}
        style={{
          fontSize: `${fontSize * scale}px`,
          color: annotation.color || '#000000',
          // Only families the exporter can actually reproduce are used on screen, so
          // what is shown matches what lands in the PDF.
          fontFamily: resolveCssFontStack(annotation.fontFamily),
          lineHeight: LINE_HEIGHT_RATIO,
          // Padding and line height are shared with the exporter and scale with zoom,
          // otherwise the on-screen text drifts from the exported position.
          padding: `${TEXT_PADDING * scale}px`,
        }}
      />
    </TransformBox>
  )
}

export const TextStamp = memo(TextStampComponent)
