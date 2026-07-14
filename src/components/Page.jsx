import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Stamp } from './Stamp';

export const Page = ({ pdfDoc, pageNumber, scale, stamps, setStamps, specimenAsset }) => {
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [activeStampId, setActiveStampId] = useState(null);
    
    // Smooth zoom state
    const [renderedScale, setRenderedScale] = useState(scale);

    useEffect(() => {
        if (scale === renderedScale) return;
        const timer = setTimeout(() => {
            setRenderedScale(scale);
        }, 300);
        return () => clearTimeout(timer);
    }, [scale, renderedScale]);

    useEffect(() => {
        let activeRenderTask = null;

        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current) return;
            
            // Get the unscaled viewport to determine base aspect ratio, considering page rotation
            const page = await pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: renderedScale });
            
            setDimensions({
                width: viewport.width,
                height: viewport.height
            });

            const outputScale = window.devicePixelRatio || 1;
            const targetWidth = Math.floor(viewport.width * outputScale);
            const targetHeight = Math.floor(viewport.height * outputScale);
            
            // Render to an offscreen canvas to prevent flicker (blank canvas) during async render
            const renderCanvas = document.createElement('canvas');
            renderCanvas.width = targetWidth;
            renderCanvas.height = targetHeight;
            const renderContext = renderCanvas.getContext('2d', { alpha: false });

            const transform = outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : null;

            activeRenderTask = page.render({
                canvasContext: renderContext,
                transform: transform,
                viewport: viewport,
            });

            try {
                await activeRenderTask.promise;

                // Only update the visible canvas AFTER rendering is perfectly complete
                if (canvasRef.current) {
                    const canvas = canvasRef.current;
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    canvas.style.width = Math.floor(viewport.width) + "px";
                    canvas.style.height =  Math.floor(viewport.height) + "px";
                    
                    const ctx = canvas.getContext('2d', { alpha: false });
                    ctx.drawImage(renderCanvas, 0, 0);
                }

                // Render Text Layer
                const textContent = await page.getTextContent();
                if (textLayerRef.current) {
                    textLayerRef.current.innerHTML = '';
                    const textLayer = new pdfjsLib.TextLayer({
                        textContentSource: textContent,
                        container: textLayerRef.current,
                        viewport: viewport,
                    });
                    await textLayer.render();
                }

            } catch (err) {
                if (err?.name !== 'RenderingCancelledException') {
                    console.error('Render error:', err);
                }
            }
        };

        renderPage();

        return () => {
            if (activeRenderTask) {
                activeRenderTask.cancel();
            }
        };
    }, [pdfDoc, pageNumber, renderedScale]);

    const pageStamps = stamps.filter(s => s.pageIndex === pageNumber - 1);

    const updateStamp = (id, newData) => {
        // Convert scaled DOM pixels back to unscaled (scale=1) PDF coordinates for state
        const unscaledData = {};
        if (newData.x !== undefined) unscaledData.x = newData.x / scale;
        if (newData.y !== undefined) unscaledData.y = newData.y / scale;
        if (newData.width !== undefined) unscaledData.width = newData.width / scale;
        if (newData.height !== undefined) unscaledData.height = newData.height / scale;

        setStamps(prev => prev.map(s => (s.id === id ? { ...s, ...unscaledData } : s)));
    };

    const cssScale = scale / renderedScale;

    return (
        <div 
            ref={containerRef}
            className="relative mb-6 shadow-2xl bg-white origin-top" 
            style={{ 
                width: dimensions.width > 0 ? dimensions.width * cssScale : 'auto',
                height: dimensions.height > 0 ? dimensions.height * cssScale : 'auto',
            }}
            onMouseDown={(e) => {
                if (e.target === canvasRef.current || e.target === containerRef.current) {
                    setActiveStampId(null);
                }
            }}
        >
            <div
                style={{
                    transform: `scale(${cssScale})`,
                    transformOrigin: 'top left',
                    width: dimensions.width,
                    height: dimensions.height,
                    position: 'absolute',
                    left: 0,
                    top: 0
                }}
            >
                <canvas ref={canvasRef} className="block" />
                <div 
                    ref={textLayerRef} 
                    className="textLayer" 
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        right: 0,
                        bottom: 0,
                        overflow: 'hidden',
                        lineHeight: 1.0,
                        opacity: 1, // Let users see selection highlights
                        '--scale-factor': renderedScale
                    }}
                />
            </div>

            {pageStamps.map(stamp => (
                <Stamp
                    key={stamp.id}
                    stamp={{
                        ...stamp,
                        x: stamp.x * scale,
                        y: stamp.y * scale,
                        width: stamp.width * scale,
                        height: stamp.height * scale
                    }}
                    specimenAsset={specimenAsset}
                    isActive={activeStampId === stamp.id}
                    setActiveStampId={setActiveStampId}
                    updateStamp={updateStamp}
                />
            ))}
        </div>
    );
};
