import { useState } from 'react';
import IconZoomOut from '@tabler/icons-react/dist/esm/icons/IconZoomOut.mjs';
import IconZoomIn from '@tabler/icons-react/dist/esm/icons/IconZoomIn.mjs';
import IconChevronDown from '@tabler/icons-react/dist/esm/icons/IconChevronDown.mjs';
import IconArrowBackUp from '@tabler/icons-react/dist/esm/icons/IconArrowBackUp.mjs';
import IconArrowForwardUp from '@tabler/icons-react/dist/esm/icons/IconArrowForwardUp.mjs';
import IconPencil from '@tabler/icons-react/dist/esm/icons/IconPencil.mjs';
import IconRubberStamp from '@tabler/icons-react/dist/esm/icons/IconRubberStamp.mjs';
import IconDownload from '@tabler/icons-react/dist/esm/icons/IconDownload.mjs';

export const Toolbar = ({ 
    scale, setScale, zoomMode, setZoomMode, 
    onAddStamp, onDownload, canDownload, 
    isDrawMode, setIsDrawMode, 
    inkColor, setInkColor, inkThickness, setInkThickness, inkOpacity, setInkOpacity, 
    canUndoInk, undoInk, canRedoInk, redoInk,
    customToolbarActions = []
}) => {
    const presetScales = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 8, 10];
    const isCustomScale = zoomMode === 'custom' && !presetScales.includes(scale);

    const [showDrawSettings, setShowDrawSettings] = useState(false);

    return (
        <div className="flex items-center justify-between px-4 py-2 bg-[#323639] border-b border-[#202224] shadow-md z-10 text-white h-12 shrink-0">
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold ml-2 text-gray-200">PDF Viewer & Stamper</span>
            </div>

            <div className="flex items-center gap-1 bg-[#202224] rounded px-1 py-1">
                <button
                    type='button'
                    onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                    className="p-1 hover:bg-[#525659] rounded text-gray-300 hover:text-white transition-colors cursor-pointer"
                    title="Zoom Out"
                >
                    <IconZoomOut size={16} stroke={2} />
                </button>
                <div className="relative flex items-center">
                    <select
                        value={zoomMode === 'custom' ? scale.toString() : zoomMode}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (['auto', 'page-fit', 'page-width', 'actual-size'].includes(val)) {
                                setZoomMode(val);
                            } else {
                                setScale(parseFloat(val));
                            }
                        }}
                        className="w-30 bg-transparent border-none text-gray-200 text-xs font-medium focus:outline-none focus:bg-[#424649] rounded py-1 pl-2 pr-4 appearance-none cursor-pointer hover:bg-[#525659] transition-colors"
                    >
                        <option value="auto">Automatic Zoom</option>
                        <option value="actual-size">Actual Size</option>
                        <option value="page-fit">Page Fit</option>
                        <option value="page-width">Page Width</option>
                        <option disabled>──────────</option>
                        <option value="0.5">50%</option>
                        <option value="0.75">75%</option>
                        <option value="1">100%</option>
                        <option value="1.25">125%</option>
                        <option value="1.5">150%</option>
                        <option value="2">200%</option>
                        <option value="3">300%</option>
                        <option value="4">400%</option>
                        <option value="5">500%</option>
                        <option value="8">800%</option>
                        <option value="10">1000%</option>
                        {isCustomScale && (
                            <option value={scale.toString()} hidden>
                                {Math.round(scale * 100)}%
                            </option>
                        )}
                    </select>
                    <div className="absolute right-2 pointer-events-none">
                        <IconChevronDown size={14} className="text-gray-400" stroke={2} />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setScale(s => Math.min(10, s + 0.2))}
                    className="p-1 hover:bg-[#525659] rounded text-gray-300 hover:text-white transition-colors cursor-pointer"
                    title="Zoom In"
                >
                    <IconZoomIn size={16} stroke={2} />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 mr-2">
                    <button
                        type='button'
                        onClick={undoInk}
                        disabled={!canUndoInk}
                        className={`p-1.5 rounded transition-colors ${canUndoInk ? 'text-gray-200 hover:bg-[#525659] hover:text-white cursor-pointer' : 'text-gray-600 cursor-not-allowed'}`}
                        title="Undo"
                    >
                        <IconArrowBackUp size={16} stroke={2} />
                    </button>
                    <button
                        type='button'
                        onClick={redoInk}
                        disabled={!canRedoInk}
                        className={`p-1.5 rounded transition-colors ${canRedoInk ? 'text-gray-200 hover:bg-[#525659] hover:text-white cursor-pointer' : 'text-gray-600 cursor-not-allowed'}`}
                        title="Redo"
                    >
                        <IconArrowForwardUp size={16} stroke={2} />
                    </button>
                </div>

                <div className="relative flex items-center">
                    <button
                        type='button'
                        onClick={() => setIsDrawMode(!isDrawMode)}
                        className={`px-3 py-1.5 border border-r-0 text-xs font-medium rounded-l transition-colors flex items-center gap-2 cursor-pointer ${isDrawMode
                                ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700'
                                : 'bg-[#424649] border-[#525659] text-gray-200 hover:bg-[#525659] hover:text-white'
                            }`}
                    >
                        <IconPencil size={14} stroke={2} />
                        Draw
                    </button>
                    <button
                        type='button'
                        onClick={() => setShowDrawSettings(!showDrawSettings)}
                        className={`px-2 py-1.5 border text-xs font-medium rounded-r transition-colors flex items-center cursor-pointer ${isDrawMode
                                ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700'
                                : 'bg-[#424649] border-[#525659] text-gray-200 hover:bg-[#525659] hover:text-white'
                            }`}
                    >
                        <IconChevronDown size={14} stroke={2} />
                    </button>

                    {showDrawSettings && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-[#323639] border border-[#525659] rounded-md shadow-lg p-3 z-50 text-gray-200">
                            <div className="mb-3">
                                <label className="text-xs mb-1 block text-gray-300">Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={inkColor} onChange={e => setInkColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0" />
                                    <span className="text-xs font-mono">{inkColor}</span>
                                </div>
                            </div>
                            <div className="mb-3">
                                <label className="text-xs mb-1 flex justify-between text-gray-300">
                                    <span>Thickness</span>
                                    <span>{inkThickness}px</span>
                                </label>
                                <input type="range" min="1" max="15" value={inkThickness} onChange={e => setInkThickness(parseInt(e.target.value))} className="w-full accent-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs mb-1 flex justify-between text-gray-300">
                                    <span>Opacity</span>
                                    <span>{Math.round(inkOpacity * 100)}%</span>
                                </label>
                                <input type="range" min="10" max="100" value={inkOpacity * 100} onChange={e => setInkOpacity(parseInt(e.target.value) / 100)} className="w-full accent-blue-500" />
                            </div>
                        </div>
                    )}
                </div>
                <div className="w-px h-6 bg-[#525659] mx-1"></div>
                
                {customToolbarActions.map((action, idx) => (
                    <button
                        key={action.id || idx}
                        type='button'
                        onClick={action.onClick}
                        className="px-3 py-1.5 bg-[#424649] border border-[#525659] text-gray-200 text-xs font-medium rounded hover:bg-[#525659] hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                        title={action.tooltip || action.label}
                    >
                        {action.icon}
                        {action.label}
                    </button>
                ))}

                <button
                    type='button'
                    onClick={onAddStamp}
                    className="px-3 py-1.5 bg-[#424649] border border-[#525659] text-gray-200 text-xs font-medium rounded hover:bg-[#525659] hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                >
                    <IconRubberStamp size={14} stroke={2} />
                    Add Stamp
                </button>
                
                {onDownload && (
                    <button
                        type='button'
                        onClick={onDownload}
                        disabled={!canDownload}
                        className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-2 transition-colors ${canDownload ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-[#424649] text-gray-500 cursor-not-allowed'}`}
                    >
                        <IconDownload size={14} stroke={2} />
                        Download
                    </button>
                )}
            </div>
        </div>
    );
};
