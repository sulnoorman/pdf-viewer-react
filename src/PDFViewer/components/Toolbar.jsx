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
import { useTools } from '../context/ToolContext.jsx'
import { MIN_SCALE, MAX_SCALE } from '../hooks/useZoom.js'
import { PageNavigation } from './PageNavigation.jsx'
import { StampMenu } from './StampMenu.jsx'
import controls from '../styles/controls.module.css'
import styles from './Toolbar.module.css'
import { useLabels } from '../context/LabelContext.jsx'

const PRESET_SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 8, 10]
const ZOOM_STEP = 0.2

/**
 * The viewer chrome.
 *
 * Actions are icon-only, the way Chrome's and pdf.js's viewers do it. Labelled
 * buttons ate most of the bar's width and pushed the zoom cluster off-centre on
 * anything narrower than a desktop window; each control keeps its name in `title`
 * and `aria-label`, so nothing is lost but the horizontal space.
 *
 * Three groups — navigation, zoom, tools — and they give up space in that order as
 * the window narrows: page navigation goes first because scrolling and the keyboard
 * still reach every page.
 */
export function Toolbar({
  scale,
  setScale,
  zoomMode,
  setZoomMode,
  stampAssets,
  allowStampUpload,
  onAddStamp,
  onUploadStamp,
  onAddText,
  onDownload,
  canDownload,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  pageCount,
  activePageIndex,
  onGoToPage,
  showThumbnails,
  onToggleThumbnails,
  onRotatePages,
  customToolbarActions = [],
}) {
  const labels = useLabels()
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

  const [showDrawSettings, setShowDrawSettings] = useState(false)
  const isCustomScale = zoomMode === 'custom' && !PRESET_SCALES.includes(scale)

  return (
    <div className={styles.toolbar}>
      {/* Navigation */}
      <div className={styles.group}>
        <button
          type="button"
          onClick={onToggleThumbnails}
          aria-pressed={showThumbnails}
          className={controls.iconButton}
          title={labels.toggleThumbnails}
          aria-label={labels.toggleThumbnails}
        >
          <IconLayoutSidebar size={16} stroke={2} />
        </button>

        <div className={styles.hideOnNarrow}>
          <PageNavigation
            pageCount={pageCount}
            activePageIndex={activePageIndex}
            onGoToPage={onGoToPage}
          />
        </div>
      </div>

      {/* Zoom and page rotation */}
      <div className={styles.groupCenter}>
        <div className={styles.inset}>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))}
            className={controls.iconButton}
            title={labels.zoomOut}
            aria-label={labels.zoomOut}
          >
            <IconZoomOut size={16} stroke={2} />
          </button>

          <div className={styles.zoomSelectWrap}>
            <select
              value={zoomMode === 'custom' ? scale.toString() : zoomMode}
              onChange={(e) => {
                const value = e.target.value
                if (['auto', 'page-fit', 'page-width', 'actual-size'].includes(value)) {
                  setZoomMode(value)
                } else {
                  setScale(Number.parseFloat(value))
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

          <button
            type="button"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP))}
            className={controls.iconButton}
            title={labels.zoomIn}
            aria-label={labels.zoomIn}
          >
            <IconZoomIn size={16} stroke={2} />
          </button>
        </div>

        <div className={`${styles.group} ${styles.hideOnMedium}`}>
          <button
            type="button"
            onClick={(e) => onRotatePages(-90, e.shiftKey ? 'all' : 'page')}
            className={controls.iconButton}
            title={labels.rotateLeft}
            aria-label={labels.rotateLeft}
          >
            <IconRotate size={16} stroke={2} />
          </button>
          <button
            type="button"
            onClick={(e) => onRotatePages(90, e.shiftKey ? 'all' : 'page')}
            className={controls.iconButton}
            title={labels.rotateRight}
            aria-label={labels.rotateRight}
          >
            <IconRotateClockwise size={16} stroke={2} />
          </button>
        </div>
      </div>

      {/* Tools and actions */}
      <div className={styles.group}>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={controls.iconButton}
          title={labels.undo}
          aria-label={labels.undo}
        >
          <IconArrowBackUp size={16} stroke={2} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={controls.iconButton}
          title={labels.redo}
          aria-label={labels.redo}
        >
          <IconArrowForwardUp size={16} stroke={2} />
        </button>

        <span className={controls.divider} />

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
            onClick={() => setShowDrawSettings((open) => !open)}
            aria-expanded={showDrawSettings}
            className={`${controls.chipButton} ${styles.splitCaret} ${
              isDrawMode ? controls.active : ''
            }`}
            aria-label={labels.drawSettings}
            title={labels.drawSettings}
          >
            <IconChevronDown size={14} stroke={2} />
          </button>

          {showDrawSettings && (
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

        <button
          type="button"
          onClick={onAddText}
          className={controls.chipButton}
          title={labels.addText}
          aria-label={labels.addText}
        >
          <IconTypography size={16} stroke={2} />
        </button>

        <StampMenu
          assets={stampAssets}
          allowUpload={allowStampUpload}
          onAddStamp={onAddStamp}
          onUpload={onUploadStamp}
        />

        {customToolbarActions.map((action, index) => (
          <button
            key={action.id || index}
            type="button"
            onClick={action.onClick}
            className={controls.chipButton}
            title={action.tooltip || action.label}
            aria-label={action.label}
          >
            {/* Host actions stay icon-only when they supply one, and fall back to
                their label when they do not, so nothing becomes unclickable. */}
            {action.icon ?? action.label}
          </button>
        ))}

        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            disabled={!canDownload}
            className={controls.primaryButton}
            title={labels.download}
            aria-label={labels.download}
          >
            <IconDownload size={16} stroke={2} />
          </button>
        )}
      </div>
    </div>
  )
}
