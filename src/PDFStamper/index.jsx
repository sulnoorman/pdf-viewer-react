import { forwardRef, useState, useEffect, useRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { Rnd } from 'react-rnd';

// Vite/Bun worker import
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// A sub-component to render individual pages and keep things clean
const PDFPage = ({ pdfDoc, pageNumber, scale, stamps, setStamps, specimenAsset }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current) return;
            const page = await pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;
        };

        renderPage();
    }, [pdfDoc, pageNumber, scale]);

    // Filter stamps that belong to THIS specific page
    const pageStamps = stamps.filter(s => s.pageIndex === pageNumber - 1);

    const updateStamp = (id, newData) => {
        setStamps(prev => prev.map(s => (s.id === id ? { ...s, ...newData } : s)));
    };

    return (
        <div className="relative mb-6 shadow-lg bg-white">
            <canvas ref={canvasRef} />

            {/* Render stamps for this page */}
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
                    className="border-2 border-blue-500"
                >
                    <img src={specimenAsset} className="w-full h-full object-contain pointer-events-none" alt="specimen" />
                </Rnd>
            ))}
        </div>
    );
};

export const PDFStamper = forwardRef(({ src, specimenAsset, onSpecimenChange }, ref) => {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [scale, setScale] = useState(1.2);
    const [stamps, setStamps] = useState([]); // Array to hold multiple stamps across pages
    const scrollContainerRef = useRef(null);

    // Load PDF
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
            } else if (activeDoc && activeDoc.loadingTask) {
                activeDoc.loadingTask.destroy();
            }
        };
    }, [src]);

    // Notify parent form whenever stamps change (for validation)
    useEffect(() => {
        if (onSpecimenChange) onSpecimenChange(stamps.length > 0);
    }, [stamps, onSpecimenChange]);

    // Add Specimen to the page the user is currently looking at
    // const handleAddSpecimen = () => {
    //     if (!pdfDoc) return;

    //     // Find which page is currently in the center of the viewport
    //     const container = scrollContainerRef.current;
    //     let currentPageIndex = 0;
    //     if (container) {
    //         const scrollTop = container.scrollTop;
    //         const pageHeight = (pdfDoc.getPage(1)?.viewport?.height || 800) * scale; // approx
    //         currentPageIndex = Math.floor(scrollTop / (pageHeight + 24)); // 24 is mb-6 margin
    //         if (currentPageIndex < 0) currentPageIndex = 0;
    //         if (currentPageIndex > pdfDoc.numPages - 1) currentPageIndex = pdfDoc.numPages - 1;
    //     }

    //     setStamps(prev => [
    //         ...prev,
    //         {
    //             id: `stamp-${Date.now()}`,
    //             pageIndex: currentPageIndex,
    //             x: 100,
    //             y: 100,
    //             width: 150,
    //             height: 60,
    //         }
    //     ]);
    // };
    // Add Specimen to the page the user is currently looking at
    const handleAddSpecimen = async () => {
        if (!pdfDoc) return;

        const container = scrollContainerRef.current;
        let currentPageIndex = 0;

        if (container) {
            const scrollTop = container.scrollTop;
            // We MUST await the getPage promise here
            const firstPage = await pdfDoc.getPage(1);
            const baseViewport = firstPage.getViewport({ scale: 1 });
            const pageHeight = baseViewport.height * scale;

            // 24 is the mb-6 margin between pages
            currentPageIndex = Math.floor(scrollTop / (pageHeight + 24));

            if (currentPageIndex < 0) currentPageIndex = 0;
            if (currentPageIndex > pdfDoc.numPages - 1) currentPageIndex = pdfDoc.numPages - 1;
        }

        setStamps(prev => [
            ...prev,
            {
                id: `stamp-${Date.now()}`,
                pageIndex: currentPageIndex,
                x: 100,
                y: 100,
                width: 150,
                height: 60,
            }
        ]);
    };

    // Imperative API: Flattens ALL stamps into their respective pages
    useImperativeHandle(ref, () => ({
        getFlattenedPDF: async () => {
            if (stamps.length === 0) throw new Error("No specimen placed!");

            const existingPdfBytes = await fetch(src).then(res => res.arrayBuffer());
            const pdfDocLib = await PDFDocument.load(existingPdfBytes);
            const pages = pdfDocLib.getPages();

            // Embed image once, reuse it for performance
            const pngImageBytes = await fetch(specimenAsset).then(res => res.arrayBuffer());
            const pngImage = await pdfDocLib.embedPng(pngImageBytes);

            // Loop through all stamps and draw them on the correct page
            for (const stamp of stamps) {
                const page = pages[stamp.pageIndex];
                if (!page) continue;

                const pdfHeight = page.getHeight();

                // Coordinate translation (React top-left -> pdf-lib bottom-left)
                const xInPdf = stamp.x / scale;
                const yInPdfFromTop = stamp.y / scale;
                const yInPdf = pdfHeight - yInPdfFromTop - (stamp.height / scale);

                page.drawImage(pngImage, {
                    x: xInPdf,
                    y: yInPdf,
                    width: stamp.width / scale,
                    height: stamp.height / scale,
                });
            }

            const pdfBytes = await pdfDocLib.save();
            return new File([pdfBytes], 'signed-document.pdf', { type: 'application/pdf' });
        }
    }));

    return (
        <div className="flex flex-col h-[700px] border border-gray-300 rounded-lg overflow-hidden bg-gray-100">

            {/* Toolbar (Tailwind styled) */}
            <div className="flex items-center gap-2 p-2 bg-gray-50 border-b border-gray-300">
                <button
                    type='button'
                    onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                    className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z" />
                    </svg>
                </button>
                <span className="text-sm font-medium text-gray-700 w-12 text-center">
                    {(scale * 100).toFixed(0)}%
                </span>
                <button
                    type="button"
                    onClick={() => setScale(s => Math.min(3, s + 0.2))}
                    className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                    </svg>
                </button>

                <button
                    type='button'
                    onClick={handleAddSpecimen}
                    className="ml-auto px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM3 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H3z" />
                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                    </svg>
                    Tambah Specimen
                </button>
            </div>

            {/* Scrollable Viewport */}
            <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4 flex flex-col items-center">
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