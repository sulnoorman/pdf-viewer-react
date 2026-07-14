import { Rnd } from 'react-rnd';

export const Stamp = ({ stamp, specimenAsset, isActive, setActiveStampId, updateStamp, onDeleteStamp, scale }) => {
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
                const centerX = stampRect.left + stampRect.width / 2;
                const centerY = stampRect.top + stampRect.height / 2;
                
                const elements = document.elementsFromPoint(centerX, centerY);
                const pageElement = elements.find(el => el.classList.contains('pdf-page-container'));
                
                if (pageElement) {
                    const pageIndex = parseInt(pageElement.dataset.pageIndex, 10);
                    const pageRect = pageElement.getBoundingClientRect();
                    
                    const newX = (stampRect.left - pageRect.left) / scale; 
                    const newY = (stampRect.top - pageRect.top) / scale;
                    
                    updateStamp(stamp.id, { x: newX, y: newY, pageIndex });
                } else {
                    // Fallback if dragged outside bounds
                    updateStamp(stamp.id, { x: d.x, y: d.y });
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
                    ? 'border-2 border-blue-500 bg-blue-500/10 z-50'
                    : 'border-2 border-transparent hover:border-blue-500 hover:bg-blue-500/10 z-10'
            }`}
        >
            {isActive && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteStamp(stamp.id);
                    }}
                    className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-md"
                >
                    ✕
                </button>
            )}
            <img src={specimenAsset} className="w-full h-full object-contain pointer-events-none" alt="specimen" />
        </Rnd>
    );
};
