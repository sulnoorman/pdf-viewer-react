import { useState } from 'react';
import { 
    ZoomOut, ZoomIn, ChevronDown, 
    Undo, Redo, 
    Pencil, Stamp, Download 
} from 'lucide-react';

export const Toolbar = ({ 
    scale, setScale, zoomMode, setZoomMode, 
    onAddStamp, onDownload, canDownload, 
    isDrawMode, setIsDrawMode, 
    inkColor, setInkColor, inkThickness, setInkThickness, inkOpacity, setInkOpacity, 
    canUndoInk, undoInk, canRedoInk, redoInk,
    customToolbarActions = []
}) => {
    const presetScales = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
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
                    onClick={() => setScale(scale - 0.1)}
                    className="p-1.5 hover:bg-[#525659] text-gray-200 rounded transition-colors cursor-pointer"
                >
                    <ZoomOut size={16} strokeWidth={2} />
                </button>
                
                <span className="text-gray-200 text-xs font-medium min-w-[3rem] text-center">
                    {Math.round(scale * 100)}%
                </span>

                <button
                    type='button'
                    onClick={() => setScale(scale + 0.1)}
                    className="p-1.5 hover:bg-[#525659] text-gray-200 rounded transition-colors cursor-pointer"
                >
                    <ZoomIn size={16} strokeWidth={2} />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 mr-2">
                    <button
                        type='button'
                        onClick={undoInk}
                        disabled={!canUndoInk}
                        className={`p-1.5 rounded transition-colors ${canUndoInk ? 'hover:bg-[#525659] text-gray-200 cursor-pointer' : 'text-gray-500 cursor-not-allowed opacity-50'}`}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo size={16} strokeWidth={2} />
                    </button>
                    <button
                        type='button'
                        onClick={redoInk}
                        disabled={!canRedoInk}
                        className={`p-1.5 rounded transition-colors ${canRedoInk ? 'hover:bg-[#525659] text-gray-200 cursor-pointer' : 'text-gray-500 cursor-not-allowed opacity-50'}`}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo size={16} strokeWidth={2} />
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
                        <Pencil size={14} strokeWidth={2} />
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
                        <ChevronDown size={14} strokeWidth={2} />
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
                    <Stamp size={14} strokeWidth={2} />
                    Add Stamp
                </button>
                
                {onDownload && (
                    <button
                        type='button'
                        onClick={onDownload}
                        disabled={!canDownload}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-2
                            ${canDownload 
                                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                                : 'bg-[#424649] text-gray-400 cursor-not-allowed opacity-50'
                            }`}
                    >
                        <Download size={14} strokeWidth={2} />
                        Download
                    </button>
                )}
            </div>
        </div>
    );
};
