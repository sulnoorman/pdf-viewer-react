import { useState, useRef } from 'react';

export const InkLayer = ({ width, height, scale, isDrawMode, inkAnnotations, setInkAnnotations }) => {
    const [currentPath, setCurrentPath] = useState(null);
    const svgRef = useRef(null);

    const getUnscaledPoint = (e) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const rect = svgRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale
        };
    };

    const handlePointerDown = (e) => {
        if (!isDrawMode) return;
        e.preventDefault(); 
        e.stopPropagation();
        
        e.target.setPointerCapture(e.pointerId);
        
        const pt = getUnscaledPoint(e);
        setCurrentPath({
            points: [pt],
            color: '#2563eb', // blue-600
            strokeWidth: 2 
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

    const renderPath = (path, key) => {
        if (!path || path.points.length === 0) return null;
        // Optimization: For production, converting points to quadratic bezier curves (Q) 
        // creates a much smoother line than straight (L) line segments. But L works for now.
        const d = `M ${path.points.map(p => `${p.x},${p.y}`).join(' L ')}`;
        return (
            <path
                key={key}
                d={d}
                fill="none"
                stroke={path.color}
                strokeWidth={path.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        );
    };

    return (
        <svg
            ref={svgRef}
            className={`absolute top-0 left-0 w-full h-full ${isDrawMode ? 'cursor-crosshair z-50' : 'pointer-events-none z-20'}`}
            viewBox={`0 0 ${width} ${height}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {inkAnnotations.map((path, idx) => renderPath(path, `ink-${idx}`))}
            {currentPath && renderPath(currentPath, 'current')}
        </svg>
    );
};
