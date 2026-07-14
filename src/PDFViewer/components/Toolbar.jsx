import { useState } from 'react';

export const Toolbar = ({ scale, setScale, zoomMode, setZoomMode, onAddStamp, onDownload, canDownload, isDrawMode, setIsDrawMode, inkColor, setInkColor, inkThickness, setInkThickness, inkOpacity, setInkOpacity, canUndoInk, undoInk, canRedoInk, redoInk }) => {
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
                    onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                    className="p-1 hover:bg-[#525659] rounded text-gray-300 hover:text-white transition-colors cursor-pointer"
                    title="Zoom Out"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z" />
                    </svg>
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
                        className="w-[120px] bg-transparent border-none text-gray-200 text-xs font-medium focus:outline-none focus:bg-[#424649] rounded py-1 pl-2 pr-4 appearance-none cursor-pointer hover:bg-[#525659] transition-colors"
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
                        {isCustomScale && (
                            <option value={scale.toString()} hidden>
                                {Math.round(scale * 100)}%
                            </option>
                        )}
                    </select>
                    <div className="absolute right-2 pointer-events-none">
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setScale(s => Math.min(3, s + 0.2))}
                    className="p-1 hover:bg-[#525659] rounded text-gray-300 hover:text-white transition-colors cursor-pointer"
                    title="Zoom In"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                    </svg>
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    </button>
                    <button
                        type='button'
                        onClick={redoInk}
                        disabled={!canRedoInk}
                        className={`p-1.5 rounded transition-colors ${canRedoInk ? 'text-gray-200 hover:bg-[#525659] hover:text-white cursor-pointer' : 'text-gray-600 cursor-not-allowed'}`}
                        title="Redo"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                    </button>
                </div>

                <div className="relative flex items-center">
                    <button
                        type='button'
                        onClick={() => setIsDrawMode(!isDrawMode)}
                        className={`px-3 py-1.5 border border-r-0 text-xs font-medium rounded-l transition-colors flex items-center gap-2 cursor-pointer ${
                            isDrawMode 
                                ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700' 
                                : 'bg-[#424649] border-[#525659] text-gray-200 hover:bg-[#525659] hover:text-white'
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Draw
                    </button>
                    <button
                        type='button'
                        onClick={() => setShowDrawSettings(!showDrawSettings)}
                        className={`px-2 py-1.5 border text-xs font-medium rounded-r transition-colors flex items-center cursor-pointer ${
                            isDrawMode 
                                ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700' 
                                : 'bg-[#424649] border-[#525659] text-gray-200 hover:bg-[#525659] hover:text-white'
                        }`}
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
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
                                <input type="range" min="10" max="100" value={inkOpacity * 100} onChange={e => setInkOpacity(parseInt(e.target.value)/100)} className="w-full accent-blue-500" />
                            </div>
                        </div>
                    )}
                </div>
                <div className="w-px h-6 bg-[#525659] mx-1"></div>
                <button
                    type='button'
                    onClick={onAddStamp}
                    className="px-3 py-1.5 bg-[#424649] border border-[#525659] text-gray-200 text-xs font-medium rounded hover:bg-[#525659] hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM3 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H3z" />
                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                    </svg>
                    Add Stamp
                </button>
                {onDownload && (
                    <button
                        type='button'
                        onClick={onDownload}
                        disabled={!canDownload}
                        className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-2 transition-colors ${canDownload ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-[#424649] text-gray-500 cursor-not-allowed'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                        </svg>
                        Download
                    </button>
                )}
            </div>
        </div>
    );
};
