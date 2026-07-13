import { forwardRef, useState, useEffect, useRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Modular Components
import { Toolbar } from './Toolbar';
import { Document } from './Document';
import { flattenPDFWithStamps } from './pdfUtils';

// Vite/Bun worker import
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

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

    // Intercept pinch-to-zoom so it zooms the PDF, not the browser window
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setScale(s => Math.min(5, Math.max(0.1, s + delta)));
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, []);

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

        // Calculate aspect ratio dynamically so the stamp is never stretched
        const img = new Image();
        img.src = specimenAsset;
        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; // Fallback if image fails to load
        });

        let initialWidth = 150;
        let initialHeight = 60;
        if (img.width && img.height) {
            const aspect = img.height / img.width;
            initialHeight = initialWidth * aspect;
        }

        setStamps(prev => [
            ...prev,
            {
                id: `stamp-${Date.now()}`,
                pageIndex: currentPageIndex,
                x: 50,
                y: 50,
                width: initialWidth,
                height: initialHeight,
            }
        ]);
    };

    useImperativeHandle(ref, () => ({
        getFlattenedPDF: () => flattenPDFWithStamps(src, specimenAsset, stamps, scale)
    }));

    return (
        <div className="flex flex-col w-full h-full bg-[#525659] overflow-hidden font-sans">
            <Toolbar 
                scale={scale} 
                setScale={setScale} 
                onAddStamp={handleAddSpecimen} 
                onDownload={onDownload} 
                canDownload={canDownload} 
            />
            <Document 
                pdfDoc={pdfDoc} 
                scale={scale} 
                stamps={stamps} 
                setStamps={setStamps} 
                specimenAsset={specimenAsset} 
                scrollContainerRef={scrollContainerRef}
            />
        </div>
    );
});