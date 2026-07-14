import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Stamp } from './Stamp';

export const Page = ({ pdfDoc, pageNumber, scale, stamps, setStamps, specimenAsset, activeStampId, setActiveStampId, onDeleteStamp }) => {
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const annotationLayerRef = useRef(null);
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    
    // Smooth zoom state
    const [debouncedScale, setDebouncedScale] = useState(scale);
    // Tracks the actual resolution of the canvas currently on screen
    const [canvasScale, setCanvasScale] = useState(scale);

    useEffect(() => {
        if (scale === debouncedScale) return;
        const timer = setTimeout(() => {
            setDebouncedScale(scale);
        }, 300);
        return () => clearTimeout(timer);
    }, [scale, debouncedScale]);

    // Pre-fetch dimensions to prevent layout shifts on multi-page docs
    useEffect(() => {
        if (!pdfDoc) return;
        let isMounted = true;
        pdfDoc.getPage(pageNumber).then(page => {
            if (!isMounted) return;
            const viewport = page.getViewport({ scale: debouncedScale });
            setDimensions(prev => prev.width === 0 ? { width: viewport.width, height: viewport.height } : prev);
        });
        return () => isMounted = false;
    }, [pdfDoc, pageNumber, debouncedScale]);

    useEffect(() => {
        let activeRenderTask = null;

        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current) return;
            
            // Get the unscaled viewport to determine base aspect ratio, considering page rotation
            const page = await pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: debouncedScale });

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

                    // Sync the component's visual state to match the new HD canvas exactly when it appears
                    setDimensions({
                        width: viewport.width,
                        height: viewport.height
                    });
                    setCanvasScale(debouncedScale);
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

                // Render Annotation Layer (Links, Forms, etc.)
                const annotations = await page.getAnnotations();
                if (annotationLayerRef.current && annotations.length > 0) {
                    annotationLayerRef.current.innerHTML = '';
                    
                    // SimpleLinkService mock for basic link rendering without complex routing
                    const simpleLinkService = {
                        getDestinationHash: () => '',
                        navigateTo: () => {},
                        getAnchorUrl: () => '',
                        setDocument: () => {},
                        executeNamedAction: () => {},
                        cachePageRef: () => {},
                        isPageVisible: () => true,
                        isPageCached: () => true,
                        page: pageNumber
                    };

                    const annotationLayer = new pdfjsLib.AnnotationLayer({
                        page: page,
                        viewport: viewport.clone({ dontFlip: true }),
                        div: annotationLayerRef.current,
                        annotations: annotations,
                        linkService: simpleLinkService,
                        downloadManager: null,
                        renderInteractiveForms: true
                    });

                    await annotationLayer.render({
                        annotations: annotations,
                        div: annotationLayerRef.current,
                        page: page,
                        viewport: viewport.clone({ dontFlip: true }),
                        linkService: simpleLinkService,
                        renderInteractiveForms: true
                    });
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
    }, [pdfDoc, pageNumber, debouncedScale]);

    const pageStamps = stamps.filter(s => s.pageIndex === pageNumber - 1);

    const updateStamp = (id, newData) => {
        // Convert scaled DOM pixels back to unscaled (scale=1) PDF coordinates for state
        const unscaledData = {};
        if (newData.x !== undefined) unscaledData.x = newData.x / scale;
        if (newData.y !== undefined) unscaledData.y = newData.y / scale;
        if (newData.width !== undefined) unscaledData.width = newData.width / scale;
        if (newData.height !== undefined) unscaledData.height = newData.height / scale;
        if (newData.pageIndex !== undefined) unscaledData.pageIndex = newData.pageIndex;

        setStamps(prev => prev.map(s => (s.id === id ? { ...s, ...unscaledData } : s)));
    };

    const cssScale = scale / canvasScale;

    return (
        <div 
            ref={containerRef}
            className="pdf-page-container relative shrink-0 shadow-sm bg-white origin-top border border-gray-400" 
            data-page-index={pageNumber - 1}
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
                        '--scale-factor': canvasScale,
                        '--total-scale-factor': canvasScale
                    }}
                />
                <div 
                    ref={annotationLayerRef} 
                    className="annotationLayer" 
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        right: 0,
                        bottom: 0,
                        overflow: 'hidden',
                        '--scale-factor': canvasScale,
                        '--total-scale-factor': canvasScale
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
                    onDeleteStamp={onDeleteStamp}
                    scale={scale}
                />
            ))}
        </div>
    );
};
