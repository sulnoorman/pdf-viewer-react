import { useState } from 'react'
import IconZoomOut from '@tabler/icons-react/dist/esm/icons/IconZoomOut.mjs'
import IconZoomIn from '@tabler/icons-react/dist/esm/icons/IconZoomIn.mjs'
import IconChevronDown from '@tabler/icons-react/dist/esm/icons/IconChevronDown.mjs'
import IconArrowBackUp from '@tabler/icons-react/dist/esm/icons/IconArrowBackUp.mjs'
import IconArrowForwardUp from '@tabler/icons-react/dist/esm/icons/IconArrowForwardUp.mjs'
import IconPencil from '@tabler/icons-react/dist/esm/icons/IconPencil.mjs'
import IconTypography from '@tabler/icons-react/dist/esm/icons/IconTypography.mjs'
import IconDownload from '@tabler/icons-react/dist/esm/icons/IconDownload.mjs'
import IconLayoutSidebar from '@tabler/icons-react/dist/esm/icons/IconLayoutSidebar.mjs'
import IconRotate from '@tabler/icons-react/dist/esm/icons/IconRotate.mjs'
import IconRotateClockwise from '@tabler/icons-react/dist/esm/icons/IconRotateClockwise.mjs'
import { useTools } from '../../context/ToolContext.jsx'
import { MIN_SCALE, MAX_SCALE } from '../../hooks/useZoom.js'
import { PageNavigation } from '../PageNavigation.jsx'
import { StampMenu } from '../StampMenu.jsx'
import controls from '../../styles/controls.module.css'
import styles from '../Toolbar.module.css'

const PRESET_SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 8, 10]
const ZOOM_STEP = 0.2

/**
 * Toolbar items, one component per id.
 *
 * Previously all of this was inline in Toolbar.jsx, which meant the layout was the
 * markup: there was no way to reorder or drop a control without editing the library.
 * Splitting id from placement is what lets `config.toolbar.displayActions` exist.
 *
 * Every item is a component rather than a plain element so it can hold its own state
 * (the draw settings popover) and read context (ink colour) without the toolbar
 * knowing anything about it.
 *
 * Each receives one `ctx` prop — see Toolbar.jsx for what is in it.
 *
 * The id → component map lives in registry.js rather than here, because a module that
 * exports both components and plain values loses React Fast Refresh.
 */

/* -------------------------------- left zone ------------------------------- */

export function ThumbnailsToggle({ ctx }) {
  return (
    <button
      type="button"
      onClick={ctx.api.toggleThumbnails}
      aria-pressed={ctx.showThumbnails}
      className={controls.iconButton}
      title={ctx.labels.toggleThumbnails}
      aria-label={ctx.labels.toggleThumbnails}
    >
      <IconLayoutSidebar size={16} stroke={2} />
    </button>
  )
}

export function PageNav({ ctx }) {
  return (
    <div className={styles.hideOnNarrow}>
      <PageNavigation
        pageCount={ctx.pageCount}
        activePageIndex={ctx.activePageIndex}
        onGoToPage={ctx.api.goToPage}
      />
    </div>
  )
}

/* ------------------------------- centre zone ------------------------------ */

export function ZoomOutButton({ ctx }) {
  return (
    <button
      type="button"
      onClick={() => ctx.api.setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))}
      className={controls.iconButton}
      title={ctx.labels.zoomOut}
      aria-label={ctx.labels.zoomOut}
    >
      <IconZoomOut size={16} stroke={2} />
    </button>
  )
}

export function ZoomInButton({ ctx }) {
  return (
    <button
      type="button"
      onClick={() => ctx.api.setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP))}
      className={controls.iconButton}
      title={ctx.labels.zoomIn}
      aria-label={ctx.labels.zoomIn}
    >
      <IconZoomIn size={16} stroke={2} />
    </button>
  )
}

export function ZoomSelect({ ctx }) {
  const { scale, zoomMode, labels, api } = ctx
  const isCustomScale = zoomMode === 'custom' && !PRESET_SCALES.includes(scale)

  return (
    <div className={styles.zoomSelectWrap}>
      <select
        value={zoomMode === 'custom' ? scale.toString() : zoomMode}
        onChange={(e) => {
          const value = e.target.value
          if (['auto', 'page-fit', 'page-width', 'actual-size'].includes(value)) {
            api.setZoomMode(value)
          } else {
            api.setScale(Number.parseFloat(value))
          }
        }}
        className={styles.zoomSelect}
        aria-label={labels.zoomLevel}
      >
        <option value="auto">{labels.zoomAutomatic}</option>
        <option value="actual-size">{labels.zoomActualSize}</option>
        <option value="page-fit">{labels.zoomPageFit}</option>
        <option value="page-width">{labels.zoomPageWidth}</option>
        <option disabled>──────────</option>
        {PRESET_SCALES.map((preset) => (
          <option key={preset} value={preset}>
            {Math.round(preset * 100)}%
          </option>
        ))}
        {isCustomScale && (
          <option value={scale.toString()} hidden>
            {Math.round(scale * 100)}%
          </option>
        )}
      </select>
      <span className={styles.zoomCaret}>
        <IconChevronDown size={14} stroke={2} />
      </span>
    </div>
  )
}

/** The recessed well: zoom out, level, zoom in. */
export function ZoomCluster({ ctx }) {
  return (
    <div className={styles.inset}>
      <ZoomOutButton ctx={ctx} />
      <ZoomSelect ctx={ctx} />
      <ZoomInButton ctx={ctx} />
    </div>
  )
}

export function RotateLeftButton({ ctx }) {
  return (
    <button
      type="button"
      onClick={(e) => ctx.api.rotatePages(-90, e.shiftKey ? 'all' : 'page')}
      className={controls.iconButton}
      title={ctx.labels.rotateLeft}
      aria-label={ctx.labels.rotateLeft}
    >
      <IconRotate size={16} stroke={2} />
    </button>
  )
}

export function RotateRightButton({ ctx }) {
  return (
    <button
      type="button"
      onClick={(e) => ctx.api.rotatePages(90, e.shiftKey ? 'all' : 'page')}
      className={controls.iconButton}
      title={ctx.labels.rotateRight}
      aria-label={ctx.labels.rotateRight}
    >
      <IconRotateClockwise size={16} stroke={2} />
    </button>
  )
}

export function RotateCluster({ ctx }) {
  return (
    <div className={`${styles.group} ${styles.hideOnMedium}`}>
      <RotateLeftButton ctx={ctx} />
      <RotateRightButton ctx={ctx} />
    </div>
  )
}

/* -------------------------------- right zone ------------------------------ */

export function UndoButton({ ctx }) {
  return (
    <button
      type="button"
      onClick={ctx.api.undo}
      disabled={!ctx.canUndo}
      className={controls.iconButton}
      title={ctx.labels.undo}
      aria-label={ctx.labels.undo}
    >
      <IconArrowBackUp size={16} stroke={2} />
    </button>
  )
}

export function RedoButton({ ctx }) {
  return (
    <button
      type="button"
      onClick={ctx.api.redo}
      disabled={!ctx.canRedo}
      className={controls.iconButton}
      title={ctx.labels.redo}
      aria-label={ctx.labels.redo}
    >
      <IconArrowForwardUp size={16} stroke={2} />
    </button>
  )
}

export function HistoryCluster({ ctx }) {
  return (
    <>
      <UndoButton ctx={ctx} />
      <RedoButton ctx={ctx} />
    </>
  )
}

/** Draw toggle plus a caret opening colour, thickness and opacity. */
export function DrawTool({ ctx }) {
  const {
    isDrawMode,
    setIsDrawMode,
    inkColor,
    setInkColor,
    inkThickness,
    setInkThickness,
    inkOpacity,
    setInkOpacity,
  } = useTools()
  const [showSettings, setShowSettings] = useState(false)
  const { labels } = ctx

  return (
    <div className={styles.split}>
      <button
        type="button"
        onClick={() => setIsDrawMode(!isDrawMode)}
        aria-pressed={isDrawMode}
        className={`${controls.chipButton} ${styles.splitMain} ${
          isDrawMode ? controls.active : ''
        }`}
        title={labels.draw}
        aria-label={labels.draw}
      >
        <IconPencil size={16} stroke={2} />
      </button>
      <button
        type="button"
        onClick={() => setShowSettings((open) => !open)}
        aria-expanded={showSettings}
        className={`${controls.chipButton} ${styles.splitCaret} ${
          isDrawMode ? controls.active : ''
        }`}
        aria-label={labels.drawSettings}
        title={labels.drawSettings}
      >
        <IconChevronDown size={14} stroke={2} />
      </button>

      {showSettings && (
        <div className={styles.drawPanel}>
          <div className={styles.drawPanelSection}>
            <label className={controls.fieldLabel} htmlFor="rpvs-ink-color">
              <span>{labels.colour}</span>
            </label>
            <div className={styles.colorRow}>
              <input
                id="rpvs-ink-color"
                type="color"
                value={inkColor}
                onChange={(e) => setInkColor(e.target.value)}
                className={styles.colorSwatch}
              />
              <span className={styles.colorValue}>{inkColor}</span>
            </div>
          </div>

          <div className={styles.drawPanelSection}>
            <label className={controls.fieldLabel}>
              <span>{labels.thickness}</span>
              <span>{inkThickness}px</span>
            </label>
            <input
              type="range"
              min="1"
              max="15"
              value={inkThickness}
              onChange={(e) => setInkThickness(Number.parseInt(e.target.value, 10))}
              className={controls.range}
              aria-label={labels.strokeThickness}
            />
          </div>

          <div className={styles.drawPanelSection}>
            <label className={controls.fieldLabel}>
              <span>{labels.opacity}</span>
              <span>{Math.round(inkOpacity * 100)}%</span>
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={inkOpacity * 100}
              onChange={(e) => setInkOpacity(Number.parseInt(e.target.value, 10) / 100)}
              className={controls.range}
              aria-label={labels.strokeOpacity}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function AddTextButton({ ctx }) {
  return (
    <button
      type="button"
      onClick={() => ctx.api.addTextStamp()}
      className={controls.chipButton}
      title={ctx.labels.addText}
      aria-label={ctx.labels.addText}
    >
      <IconTypography size={16} stroke={2} />
    </button>
  )
}

export function StampItem({ ctx }) {
  return (
    <StampMenu
      assets={ctx.stampAssets}
      allowUpload={ctx.allowStampUpload}
      onAddStamp={ctx.api.addImageStamp}
      onUpload={ctx.api.uploadStamp}
    />
  )
}

/**
 * Only rendered when the host supplied `onDownload` — the library never saves a file
 * itself, so a Download button with nothing behind it would be a dead control.
 */
export function DownloadButton({ ctx }) {
  if (!ctx.onDownload) return null
  return (
    <button
      type="button"
      onClick={ctx.onDownload}
      disabled={!ctx.canDownload}
      className={controls.primaryButton}
      title={ctx.labels.download}
      aria-label={ctx.labels.download}
    >
      <IconDownload size={16} stroke={2} />
    </button>
  )
}

