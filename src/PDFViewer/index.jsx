import * as pdfjsLib from 'pdfjs-dist';
import { forwardRef, useState, useEffect, useRef, useImperativeHandle } from 'react';

// Modular Components
import { Toolbar } from './components/Toolbar';
import { Document } from './components/Document';
import { flattenPDFWithStamps } from '../utils/pdfUtils';

// Vite/Bun worker import
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export const PDFViewer = forwardRef(({ src, specimenAsset, onSpecimenChange, onDownload, canDownload }, ref) => {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [scale, setScale] = useState(1.0);
    const [zoomMode, setZoomMode] = useState('auto'); // 'auto', 'page-fit', 'page-width', 'actual-size', 'custom'
    const [stamps, setStamps] = useState([]);
    const [activeStampId, setActiveStampId] = useState(null);
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

    const calculateScaleForMode = async (mode) => {
        if (!pdfDoc || !scrollContainerRef.current) return null;
        
        const container = scrollContainerRef.current;
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        
        // Padding to ensure scrollbars don't immediately appear and look nice
        const paddingX = 40; 
        const paddingY = 40;

        if (mode === 'page-width') {
            return (container.clientWidth - paddingX) / viewport.width;
        } else if (mode === 'page-fit') {
            const scaleX = (container.clientWidth - paddingX) / viewport.width;
            const scaleY = (container.clientHeight - paddingY) / viewport.height;
            return Math.min(scaleX, scaleY);
        } else if (mode === 'auto') {
            const newScale = (container.clientWidth - paddingX) / viewport.width;
            return Math.min(newScale, 1.25); // Cap auto zoom to 125%
        } else if (mode === 'actual-size') {
            return 1;
        }
        return null;
    };

    // Reactively update scale when zoomMode or window size changes
    useEffect(() => {
        if (zoomMode === 'custom' || !pdfDoc) return;

        const updateScale = async () => {
            const newScale = await calculateScaleForMode(zoomMode);
            if (newScale) {
                setScale(Math.max(0.1, Math.min(newScale, 5)));
            }
        };

        updateScale();

        const handleResize = () => updateScale();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [zoomMode, pdfDoc]);

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
                setZoomMode('custom');
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
            
            // py-8 is 32px top padding. Margin is 24 * scale.
            currentPageIndex = Math.floor((scrollTop - 32) / (pageHeight + (24 * scale)));

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
                setScale={(newScale) => {
                    setScale(newScale);
                    setZoomMode('custom');
                }} 
                zoomMode={zoomMode}
                setZoomMode={setZoomMode}
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
                activeStampId={activeStampId}
                setActiveStampId={setActiveStampId}
            />
        </div>
    );
});
