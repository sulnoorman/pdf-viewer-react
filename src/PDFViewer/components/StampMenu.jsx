import IconRubberStamp from '@tabler/icons-react/dist/esm/icons/IconRubberStamp.mjs'
import { SplitMenu } from './SplitMenu.jsx'
import { useLabels } from '../context/LabelContext.jsx'

/**
 * Place one of the stamp images the host configured.
 *
 * Stamps and user images are two controls, not one. They were merged, which made the
 * dropdown unavoidable: even a viewer with a single specimen showed a caret, because
 * the upload entry always lived behind it. Now the caret appears only when there is
 * genuinely a choice of stamp — with one specimen this is a plain button — and bringing
 * in a new image is the separate ImageMenu.
 *
 * @param {object} props
 * @param {Array<{id: string, label: string, src?: string}>} props.assets host-configured only
 */
export function StampMenu({ assets, onAddStamp, disabled }) {
  const labels = useLabels()

  return (
    <SplitMenu
      icon={<IconRubberStamp size={16} stroke={2} />}
      onPrimary={() => onAddStamp()}
      disabled={disabled || assets.length === 0}
      label={labels.addStamp}
      title={assets.length === 0 ? labels.noStampConfigured : labels.addStamp}
      menuLabel={labels.chooseStamp}
      // One stamp needs no menu: the primary button already places it.
      items={assets.length > 1 ? assets : []}
      onSelect={onAddStamp}
    />
  )
}
