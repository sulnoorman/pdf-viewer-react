import { Rnd } from 'react-rnd';

export const Stamp = ({ stamp, specimenAsset, isActive, setActiveStampId, updateStamp }) => {
    return (
        <Rnd
            size={{ width: stamp.width, height: stamp.height }}
            position={{ x: stamp.x, y: stamp.y }}
            onDragStart={() => setActiveStampId(stamp.id)}
            onDragStop={(e, d) => updateStamp(stamp.id, { x: d.x, y: d.y })}
            onResizeStart={() => setActiveStampId(stamp.id)}
            onResizeStop={(e, direction, ref, delta, position) => {
                updateStamp(stamp.id, {
                    width: ref.offsetWidth,
                    height: ref.offsetHeight,
                    ...position,
                });
            }}
            bounds="parent"
            lockAspectRatio={true}
            className={`transition-colors cursor-move ${
                isActive
                    ? 'border-2 border-blue-500 bg-blue-500/10'
                    : 'border-2 border-transparent hover:border-gray-400 hover:bg-gray-400/10'
            }`}
        >
            <img src={specimenAsset} className="w-full h-full object-contain pointer-events-none" alt="specimen" />
        </Rnd>
    );
};
