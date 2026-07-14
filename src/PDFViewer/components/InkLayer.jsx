import { useState, useRef } from 'react';

export const InkLayer = ({ width, height, scale, isDrawMode, inkAnnotations, setInkAnnotations, inkColor, inkThickness, inkOpacity }) => {
    const [currentPath, setCurrentPath] = useState(null);
    const [activePathId, setActivePathId] = useState(null);
    const svgRef = useRef(null);

    const getUnscaledPoint = (e) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const svgP = pt.matrixTransform(ctm.inverse());
        return { x: svgP.x, y: svgP.y };
    };

    const handlePointerDown = (e) => {
        if (!isDrawMode) return;
        e.preventDefault(); 
        e.stopPropagation();
        
        e.target.setPointerCapture(e.pointerId);
        
        const pt = getUnscaledPoint(e);
        setCurrentPath({
            id: `ink-${Date.now()}`,
            points: [pt],
            color: inkColor || '#000000',
            strokeWidth: inkThickness || 2,
            opacity: inkOpacity || 1
        });
    };

    const handlePointerMove = (e) => {
        if (!isDrawMode || !currentPath) return;
        e.preventDefault();
        e.stopPropagation();

        const pt = getUnscaledPoint(e);
        setCurrentPath(prev => ({
            ...prev,
            points: [...prev.points, pt]
        }));
    };

    const handlePointerUp = (e) => {
        if (!isDrawMode || !currentPath) return;
        e.preventDefault();
        e.stopPropagation();
        
        e.target.releasePointerCapture(e.pointerId);
        
        if (currentPath.points.length > 1) {
            setInkAnnotations(prev => [...prev, currentPath]);
        }
        setCurrentPath(null);
    };

    const handleDelete = (id, e) => {
        e.stopPropagation();
        setInkAnnotations(prev => prev.filter(p => p.id !== id));
        setActivePathId(null);
    };

    const renderPath = (path) => {
        if (!path || path.points.length === 0) return null;
        const d = `M ${path.points.map(p => `${p.x},${p.y}`).join(' L ')}`;
        const isActive = activePathId === path.id && !isDrawMode;
        
        return (
            <g key={path.id || 'current'}>
                {isActive && (
                    <path
                        d={d}
                        fill="none"
                        stroke="#0ea5e9" // sky-500 highlight
                        strokeWidth={path.strokeWidth + 4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.3"
                    />
                )}
                <path
                    d={d}
                    fill="none"
                    stroke={path.color}
                    strokeWidth={path.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={path.opacity || 1}
                    className={!isDrawMode ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}
                    onPointerDown={(e) => {
                        if (!isDrawMode) {
                            e.stopPropagation();
                            setActivePathId(path.id);
                        }
                    }}
                />
                {isActive && path.points.length > 0 && (
                    <g 
                        transform={`translate(${path.points[0].x - 12}, ${path.points[0].y - 12})`} 
                        className="cursor-pointer"
                        onPointerDown={(e) => handleDelete(path.id, e)}
                    >
                        <circle cx="12" cy="12" r="10" fill="#ef4444" />
                        <path d="M8 8 L16 16 M16 8 L8 16" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </g>
                )}
            </g>
        );
    };

    const pencilCursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>') 0 24, crosshair`;

    return (
        <svg
            ref={svgRef}
            className={`absolute top-0 left-0 w-full h-full ${isDrawMode ? 'z-50' : 'z-20 pointer-events-auto'}`}
            style={{ cursor: isDrawMode ? pencilCursor : 'auto' }}
            viewBox={`0 0 ${width / scale} ${height / scale}`}
            onPointerDown={(e) => {
                if (!isDrawMode) setActivePathId(null);
                else handlePointerDown(e);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {inkAnnotations.map(path => renderPath(path))}
            {currentPath && renderPath(currentPath)}
        </svg>
    );
};
