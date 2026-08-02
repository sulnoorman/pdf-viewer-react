import { memo } from 'react'
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

  return (
    <TransformBox
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
        data-no-drag
        // Focused straight away when created from the toolbar, so the user can type
        // without first having to click into a box they just asked for.
        autoFocus={autoFocus}
        value={annotation.text}
        placeholder={labels.textPlaceholder}
        onChange={(e) => onEdit(annotation.id, { text: e.target.value })}
        // Typing is wrapped in one history transaction per editing session, so a
        // sentence costs one Ctrl+Z instead of one per keystroke — which would
        // otherwise flush the whole undo stack.
        onFocus={onGestureStart}
        onBlur={onGestureEnd}
        className={styles.textarea}
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
