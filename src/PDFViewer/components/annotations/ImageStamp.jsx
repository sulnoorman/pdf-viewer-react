import { memo } from 'react'
import { TransformBox } from './TransformBox.jsx'
import { AnnotationToolbar } from './AnnotationToolbar.jsx'
import styles from './ImageStamp.module.css'

/**
 * A draggable, resizable, rotatable image stamp (signature, seal, specimen).
 *
 * Receives SCREEN coordinates; Page converts to and from view space so the zoom
 * factor is applied in exactly one place.
 */
function ImageStampComponent({
  annotation,
  screenRect,
  frameRotation,
  src,
  isActive,
  onSelect,
  onCommit,
  onEdit,
  onDuplicate,
  onDelete,
  constrainDraft,
  isDraggingRef,
}) {
  return (
    <TransformBox
      rect={screenRect}
      rotation={annotation.rotation ?? 0}
      frameRotation={frameRotation}
      selected={isActive}
      lockAspectRatio
      rotatable
      opacity={annotation.opacity ?? 1}
      constrainDraft={constrainDraft}
      isDraggingRef={isDraggingRef}
      onSelect={() => onSelect(annotation.id)}
      onCommit={(rect, rotation, node) => onCommit(annotation.id, rect, rotation, node)}
      toolbar={
        <AnnotationToolbar
          annotation={annotation}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      }
    >
      <img
        src={src}
        className={styles.image}
        draggable={false}
        alt="Stamp"
      />
    </TransformBox>
  )
}

export const ImageStamp = memo(ImageStampComponent)
