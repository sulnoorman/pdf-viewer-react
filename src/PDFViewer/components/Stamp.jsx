import { Rnd } from 'react-rnd';

export const Stamp = ({ stamp, specimenAsset, isActive, setActiveStampId, updateStamp, onDeleteStamp }) => {
    return (
        <Rnd
            size={{ width: stamp.width, height: stamp.height }}
            position={{ x: stamp.x, y: stamp.y }}
            onDragStart={() => setActiveStampId(stamp.id)}
            onMouseDown={(e) => {
                e.stopPropagation();
                setActiveStampId(stamp.id);
            }}
            onDragStop={(e, d) => {
                const stampRect = d.node.getBoundingClientRect();
                const pages = Array.from(document.querySelectorAll('.pdf-page-container'));
                let maxArea = 0;
                let bestPage = null;

                for (const page of pages) {
                    const pageRect = page.getBoundingClientRect();
                    const overlapX = Math.max(0, Math.min(stampRect.right, pageRect.right) - Math.max(stampRect.left, pageRect.left));
                    const overlapY = Math.max(0, Math.min(stampRect.bottom, pageRect.bottom) - Math.max(stampRect.top, pageRect.top));
                    const area = overlapX * overlapY;
                    if (area > maxArea) {
                        maxArea = area;
                        bestPage = page;
                    }
                }

                if (bestPage) {
                    const pageIndex = parseInt(bestPage.dataset.pageIndex, 10);
                    const pageRect = bestPage.getBoundingClientRect();
                    
                    // Do NOT divide by scale here; updateStamp expects screen pixels and scales them internally
                    const newX = stampRect.left - pageRect.left; 
                    const newY = stampRect.top - pageRect.top;
                    
                    updateStamp(stamp.id, { x: newX, y: newY, pageIndex });
                } else {
                    // Fallback if dragged completely outside all pages
                    updateStamp(stamp.id, { x: Math.max(0, d.x), y: Math.max(0, d.y) });
                }
            }}
            onResizeStart={() => setActiveStampId(stamp.id)}
            onResizeStop={(e, direction, ref, delta, position) => {
                updateStamp(stamp.id, {
                    width: ref.offsetWidth,
                    height: ref.offsetHeight,
                    ...position,
                });
            }}
            lockAspectRatio={true}
            className={`transition-colors cursor-move group ${
                isActive
                    ? 'border-2 border-blue-500 bg-blue-500/5 z-50'
                    : 'border-2 border-transparent hover:border-blue-500 hover:bg-blue-500/10 z-10'
            }`}
        >
            <img src={specimenAsset} className="w-full h-full object-contain pointer-events-none" alt="specimen" />
            
            {isActive && (
                <div 
                    className="absolute top-full right-0 mt-2 bg-gray-800 text-white rounded-md shadow-lg flex items-center p-1 cursor-default"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteStamp(stamp.id);
                        }}
                        className="p-1.5 hover:bg-gray-500 rounded-md transition-colors"
                        title="Hapus Spesimen"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            )}
        </Rnd>
    );
};
