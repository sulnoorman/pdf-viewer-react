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

    return (
        <svg
            ref={svgRef}
            className={`absolute top-0 left-0 w-full h-full ${isDrawMode ? 'cursor-crosshair z-50' : 'z-20 pointer-events-auto'}`}
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
