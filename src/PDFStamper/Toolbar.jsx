export const Toolbar = ({ scale, setScale, onAddStamp, onDownload, canDownload }) => {
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
                <input
                    type="number"
                    value={Math.round(scale * 100)}
                    onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val > 0) setScale(val / 100);
                    }}
                    className="w-12 text-center bg-transparent border-none text-gray-200 text-xs font-medium focus:outline-none focus:bg-[#424649] rounded py-0.5"
                />
                <span className="text-xs font-medium text-gray-400 pr-1 select-none">%</span>
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
