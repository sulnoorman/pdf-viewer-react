import { forwardRef, useState, useEffect, useRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { Rnd } from 'react-rnd';

// Vite/Bun worker import
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const PDFPage = ({ pdfDoc, pageNumber, scale, stamps, setStamps, specimenAsset }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        let activeRenderTask = null;

        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current) return;
            
            // Get the unscaled viewport to determine base aspect ratio, considering page rotation
            const page = await pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale, rotation: page.rotate });
            
            setDimensions({
                width: viewport.width,
                height: viewport.height
            });

            const canvas = canvasRef.current;
            const context = canvas.getContext('2d', { alpha: false });

            // High DPI support
            const outputScale = window.devicePixelRatio || 1;
            
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = Math.floor(viewport.width) + "px";
            canvas.style.height =  Math.floor(viewport.height) + "px";

            const transform = outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : null;

            activeRenderTask = page.render({
                canvasContext: context,
                transform: transform,
                viewport: viewport,
            });

            try {
                await activeRenderTask.promise;
            } catch (err) {
                if (err.name !== 'RenderingCancelledException') {
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
    }, [pdfDoc, pageNumber, scale]);

    const pageStamps = stamps.filter(s => s.pageIndex === pageNumber - 1);

    const updateStamp = (id, newData) => {
        setStamps(prev => prev.map(s => (s.id === id ? { ...s, ...newData } : s)));
    };

    return (
        <div 
            ref={containerRef}
            className="relative mb-6 shadow-2xl bg-white" 
            style={{ 
                width: dimensions.width > 0 ? dimensions.width : 'auto',
                height: dimensions.height > 0 ? dimensions.height : 'auto' 
            }}
        >
            <canvas ref={canvasRef} className="block" />

            {pageStamps.map(stamp => (
                <Rnd
                    key={stamp.id}
                    size={{ width: stamp.width, height: stamp.height }}
                    position={{ x: stamp.x, y: stamp.y }}
                    onDragStop={(e, d) => updateStamp(stamp.id, { x: d.x, y: d.y })}
                    onResizeStop={(e, direction, ref, delta, position) => {
                        updateStamp(stamp.id, {
                            width: ref.offsetWidth,
                            height: ref.offsetHeight,
                            ...position,
                        });
                    }}
                    bounds="parent"
                    lockAspectRatio={true}
                    className="border-2 border-blue-500 bg-blue-500/10 cursor-move hover:bg-blue-500/20 transition-colors"
                >
                    <img src={specimenAsset} className="w-full h-full object-contain pointer-events-none" alt="specimen" />
                </Rnd>
            ))}
        </div>
    );
};

export const PDFStamper = forwardRef(({ src, specimenAsset, onSpecimenChange, onDownload, canDownload }, ref) => {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [scale, setScale] = useState(1.0);
    const [stamps, setStamps] = useState([]);
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        if (!src) return;
        let activeDoc = null;
        const loadPdf = async () => {
            const loadingTask = pdfjsLib.getDocument({ url: src });
            activeDoc = await loadingTask.promise;
            setPdfDoc(activeDoc);
        };
        loadPdf();
        return () => {
            if (activeDoc && typeof activeDoc.destroy === 'function') {
                activeDoc.destroy();
            }
        };
    }, [src]);

    useEffect(() => {
        if (onSpecimenChange) onSpecimenChange(stamps.length > 0);
    }, [stamps, onSpecimenChange]);

    const handleAddSpecimen = async () => {
        if (!pdfDoc) return;

        const container = scrollContainerRef.current;
        let currentPageIndex = 0;

        if (container) {
            const scrollTop = container.scrollTop;
            const firstPage = await pdfDoc.getPage(1);
            const baseViewport = firstPage.getViewport({ scale: 1 });
            const pageHeight = baseViewport.height * scale;
            
            // mb-6 is 1.5rem (24px) in Tailwind
            currentPageIndex = Math.floor(scrollTop / (pageHeight + 24));

            if (currentPageIndex < 0) currentPageIndex = 0;
            if (currentPageIndex > pdfDoc.numPages - 1) currentPageIndex = pdfDoc.numPages - 1;
        }

        setStamps(prev => [
            ...prev,
            {
                id: `stamp-${Date.now()}`,
                pageIndex: currentPageIndex,
                x: 50,
                y: 50,
                width: 150,
                height: 60,
            }
        ]);
    };

    useImperativeHandle(ref, () => ({
        getFlattenedPDF: async () => {
            if (stamps.length === 0) throw new Error("No specimen placed!");

            const existingPdfBytes = await fetch(src).then(res => res.arrayBuffer());
            const pdfDocLib = await PDFDocument.load(existingPdfBytes);
            const pages = pdfDocLib.getPages();

            const pngImageBytes = await fetch(specimenAsset).then(res => res.arrayBuffer());
            const pngImage = await pdfDocLib.embedPng(pngImageBytes);

            for (const stamp of stamps) {
                const page = pages[stamp.pageIndex];
                if (!page) continue;

                const pdfHeight = page.getHeight();

                // Coordinates in pdf-lib are from the bottom-left corner.
                // Our React coordinates are from the top-left corner of the scaled page.
                const xInPdf = stamp.x / scale;
                const yInPdfFromTop = stamp.y / scale;
                const heightInPdf = stamp.height / scale;
                const widthInPdf = stamp.width / scale;
                
                const yInPdf = pdfHeight - yInPdfFromTop - heightInPdf;

                page.drawImage(pngImage, {
                    x: xInPdf,
                    y: yInPdf,
                    width: widthInPdf,
                    height: heightInPdf,
                });
            }

            const pdfBytes = await pdfDocLib.save();
            return new File([pdfBytes], 'signed-document.pdf', { type: 'application/pdf' });
        }
    }));

    return (
        <div className="flex flex-col w-full h-full bg-[#525659] overflow-hidden font-sans">
            {/* Toolbar - Styling inspired by PDF.js */}
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
                    <span className="text-xs font-medium w-12 text-center text-gray-200 select-none">
                        {(scale * 100).toFixed(0)}%
                    </span>
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
                        onClick={handleAddSpecimen}
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

            {/* Scrollable Viewport */}
            <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4 md:p-8 flex flex-col items-center relative">
                {pdfDoc && Array.from({ length: pdfDoc.numPages }).map((_, i) => (
                    <PDFPage
                        key={i}
                        pdfDoc={pdfDoc}
                        pageNumber={i + 1}
                        scale={scale}
                        stamps={stamps}
                        setStamps={setStamps}
                        specimenAsset={specimenAsset}
                    />
                ))}
            </div>
        </div>
    )
})