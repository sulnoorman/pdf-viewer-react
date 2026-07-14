import * as pdfjsLib from 'pdfjs-dist';
import { forwardRef, useState, useEffect, useRef, useImperativeHandle } from 'react';

// Modular Components
import { Toolbar } from './components/Toolbar';
import { Document } from './components/Document';
import { PDFDocument, rgb } from 'pdf-lib';

// Helper for hex to pdf-lib rgb
const hexToRgb = (hex) => {
    // Default to blue if invalid
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return rgb(0.145, 0.388, 0.921);
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
};

// Vite/Bun worker import
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

import 'pdfjs-dist/web/pdf_viewer.css';

export const PDFViewer = forwardRef(({ src, config }, ref) => {
    const {
        specimenAsset,
        onSpecimenChange,
        onDownload,
        canDownload = true,
        allowMultipleStamps = true,
        maxStamps = null,
        customToolbarActions = []
    } = config || {};

    const [pdfDoc, setPdfDoc] = useState(null);
    const [scale, setScale] = useState(1.0);
    const [zoomMode, setZoomMode] = useState('auto'); // 'auto', 'page-fit', 'page-width', 'actual-size', 'custom'
    const [stamps, setStamps] = useState([]);
    const [textStamps, setTextStamps] = useState([]);
    const [activeStampId, _setActiveStampId] = useState(null);
    const activeStampIdRef = useRef(null);
    const setActiveStampId = (id) => {
        activeStampIdRef.current = id;
        _setActiveStampId(id);
    };

    // Settings
    const [isDrawMode, setIsDrawMode] = useState(false);
    const [inkColor, setInkColor] = useState('#000000');
    const [inkThickness, setInkThickness] = useState(2);
    const [inkOpacity, setInkOpacity] = useState(1);

    // Undo/Redo History for Ink
    const [inkHistory, setInkHistory] = useState([{}]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const inkAnnotations = inkHistory[historyIndex];

    const handleSetInkAnnotations = (updater) => {
        setInkHistory(prevHistory => {
            // Using a functional state update inside another state update needs careful closure handling.
            // Actually, we can just compute the new state here since we have prevHistory.
            const current = prevHistory[historyIndex];
            let next;
            if (typeof updater === 'function') {
                next = updater(current);
            } else {
                next = updater;
            }

            const newHistory = prevHistory.slice(0, historyIndex + 1);
            newHistory.push(next);
            if (newHistory.length > 50) newHistory.shift();

            setHistoryIndex(newHistory.length - 1);
            return newHistory;
        });
    };

    const canUndoInk = historyIndex > 0;
    const canRedoInk = historyIndex < inkHistory.length - 1;

    const undoInk = () => { if (canUndoInk) setHistoryIndex(historyIndex - 1); };
    const redoInk = () => { if (canRedoInk) setHistoryIndex(historyIndex + 1); };

    const scrollContainerRef = useRef(null);
    const documentRef = useRef(null);

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

    const handleAddSpecimen = async () => {
        if (!pdfDoc) return;

        if (!allowMultipleStamps && stamps.length >= 1) return;
        if (allowMultipleStamps && maxStamps !== null && stamps.length >= maxStamps) return;

        // const container = scrollContainerRef.current;
        let currentPageIndex = 0;
        if (documentRef.current) {
            currentPageIndex = documentRef.current.getActivePageIndex();
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
        getFlattenedPDF: async () => {
            try {
                const existingPdfBytes = await fetch(src).then(res => res.arrayBuffer());
                const pdfDocLib = await PDFDocument.load(existingPdfBytes);
                const pages = pdfDocLib.getPages();

                // 1. Draw Stamps
                if (stamps.length > 0 && specimenAsset) {
                    const specimenBytes = await fetch(specimenAsset).then(res => res.arrayBuffer());
                    const isPng = specimenAsset.toLowerCase().endsWith('.png');
                    const image = isPng
                        ? await pdfDocLib.embedPng(specimenBytes)
                        : await pdfDocLib.embedJpg(specimenBytes);

                    stamps.forEach(stamp => {
                        const pageIndex = stamp.pageIndex || 0;
                        if (pageIndex < 0 || pageIndex >= pages.length) return;

                        const page = pages[pageIndex];
                        const { height: pageHeight } = page.getSize();

                        page.drawImage(image, {
                            x: stamp.x,
                            y: pageHeight - stamp.y - stamp.height,
                            width: stamp.width,
                            height: stamp.height,
                        });
                    });
                }

                // 2. Draw Ink Annotations (Coret-coret)
                for (const [pageIndexStr, paths] of Object.entries(inkAnnotations)) {
                    const pageIndex = parseInt(pageIndexStr, 10);
                    if (pageIndex < 0 || pageIndex >= pages.length) continue;

                    const page = pages[pageIndex];
                    const { height: pageHeight } = page.getSize();

                    for (const path of paths) {
                        if (!path || path.points.length < 2) continue;

                        const svgPath = `M ${path.points.map(p => `${p.x},${p.y}`).join(' L ')}`;
                        page.drawSvgPath(svgPath, {
                            x: 0,
                            y: pageHeight, // anchors the top-left of SVG to the top-left of the PDF page
                            borderColor: hexToRgb(path.color),
                            borderWidth: path.strokeWidth,
                            borderOpacity: path.opacity || 1,
                        });
                    }
                }

                const pdfBytes = await pdfDocLib.save();
                return new Blob([pdfBytes], { type: 'application/pdf' });
            } catch (error) {
                console.error("Error flattening PDF:", error);
                throw error;
            }
        }
    }));

    // Reactively update scale when zoomMode or window size changes
    useEffect(() => {
        if (zoomMode === 'custom' || !pdfDoc) return;

        const updateScale = async () => {
            const newScale = await calculateScaleForMode(zoomMode);
            if (newScale) {
                setScale(Math.max(0.1, Math.min(newScale, 10)));
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

    // Intercept pinch-to-zoom and keyboard zoom so it zooms the PDF, not the browser window
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setScale(s => Math.min(10, Math.max(0.1, s + delta)));
                setZoomMode('custom');
            }
        };

        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+' || e.key === '-') {
                    e.preventDefault();
                    const delta = e.key === '-' ? -0.1 : 0.1;
                    setScale(s => Math.min(10, Math.max(0.1, s + delta)));
                    setZoomMode('custom');
                } else if (e.key === '0') {
                    e.preventDefault();
                    setZoomMode('auto');
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // If focus is inside a textarea or input, do not intercept
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return;
                }
                const currentId = activeStampIdRef.current;
                if (currentId) {
                    e.preventDefault();
                    setStamps(prev => prev.filter(s => s.id !== currentId));
                    setTextStamps(prev => prev.filter(s => s.id !== currentId));
                    setActiveStampId(null);
                }
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('keydown', handleKeyDown, { passive: false });
        
        return () => {
            container.removeEventListener('wheel', handleWheel);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

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

    useImperativeHandle(ref, () => ({
        addTextStamp: ({ text, fontSize = 16, color = '#000000', fontFamily = 'Helvetica' }) => {
            let currentPageIndex = 0;
            if (documentRef.current) {
                currentPageIndex = documentRef.current.getActivePageIndex();
            }

            setTextStamps(prev => [
                ...prev,
                {
                    id: `text-${Date.now()}`,
                    pageIndex: currentPageIndex,
                    x: 50,
                    y: 50,
                    width: 250,
                    height: 50,
                    text: text,
                    fontSize: fontSize,
                    color: color,
                    fontFamily: fontFamily
                }
            ]);
        },
        getFlattenedPDF: async () => {
            try {
                const existingPdfBytes = await fetch(src).then(res => res.arrayBuffer());
                const pdfDocLib = await PDFDocument.load(existingPdfBytes);
                const pages = pdfDocLib.getPages();

                // 1. Draw Stamps
                if (stamps.length > 0 && specimenAsset) {
                    const specimenBytes = await fetch(specimenAsset).then(res => res.arrayBuffer());
                    const isPng = specimenAsset.toLowerCase().endsWith('.png');
                    const image = isPng
                        ? await pdfDocLib.embedPng(specimenBytes)
                        : await pdfDocLib.embedJpg(specimenBytes);

                    stamps.forEach(stamp => {
                        const pageIndex = stamp.pageIndex || 0;
                        if (pageIndex < 0 || pageIndex >= pages.length) return;

                        const page = pages[pageIndex];
                        const { height: pageHeight } = page.getSize();

                        page.drawImage(image, {
                            x: stamp.x,
                            y: pageHeight - stamp.y - stamp.height,
                            width: stamp.width,
                            height: stamp.height,
                        });
                    });
                }

                // 2. Draw Ink Annotations (Coret-coret)
                for (const [pageIndexStr, paths] of Object.entries(inkAnnotations)) {
                    const pageIndex = parseInt(pageIndexStr, 10);
                    if (pageIndex < 0 || pageIndex >= pages.length) continue;

                    const page = pages[pageIndex];
                    const { height: pageHeight } = page.getSize();

                    for (const path of paths) {
                        if (!path || path.points.length < 2) continue;

                        const svgPath = `M ${path.points.map(p => `${p.x},${p.y}`).join(' L ')}`;
                        page.drawSvgPath(svgPath, {
                            x: 0,
                            y: pageHeight, // anchors the top-left of SVG to the top-left of the PDF page
                            borderColor: hexToRgb(path.color),
                            borderWidth: path.strokeWidth,
                            borderOpacity: path.opacity || 1,
                        });
                    }
                }

                // 3. Draw Text Stamps
                if (textStamps.length > 0) {
                    textStamps.forEach(stamp => {
                        const pageIndex = stamp.pageIndex || 0;
                        if (pageIndex < 0 || pageIndex >= pages.length) return;

                        const page = pages[pageIndex];
                        const { height: pageHeight } = page.getSize();

                        // We map the color string to pdf-lib rgb
                        page.drawText(stamp.text, {
                            x: stamp.x,
                            // SVG/DOM y is from top, PDF y is from bottom.
                            // In HTML, y=0 is top. In PDF, y=pageHeight is top.
                            // We must subtract the text height to align perfectly.
                            y: pageHeight - stamp.y - (stamp.fontSize || 14),
                            size: stamp.fontSize || 14,
                            color: hexToRgb(stamp.color || '#000000'),
                            lineHeight: (stamp.fontSize || 14) * 1.2
                        });
                    });
                }

                const pdfBytes = await pdfDocLib.save();
                return new Blob([pdfBytes], { type: 'application/pdf' });
            } catch (error) {
                console.error("Error flattening PDF:", error);
                throw error;
            }
        }
    }));

    const handleDeleteStamp = (id) => {
        setStamps(prev => prev.filter(s => s.id !== id));
        setTextStamps(prev => prev.filter(s => s.id !== id));
        setActiveStampId(null);
    };

    return (
        <div className="flex flex-col w-full h-full bg-[#2a2a2e] overflow-hidden font-sans">
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
                isDrawMode={isDrawMode}
                setIsDrawMode={setIsDrawMode}
                inkColor={inkColor}
                setInkColor={setInkColor}
                inkThickness={inkThickness}
                setInkThickness={setInkThickness}
                inkOpacity={inkOpacity}
                setInkOpacity={setInkOpacity}
                canUndoInk={canUndoInk}
                undoInk={undoInk}
                canRedoInk={canRedoInk}
                redoInk={redoInk}
                customToolbarActions={customToolbarActions}
            />
            <Document
                ref={documentRef}
                pdfDoc={pdfDoc}
                scale={scale}
                stamps={stamps}
                setStamps={setStamps}
                textStamps={textStamps}
                setTextStamps={setTextStamps}
                inkAnnotations={inkAnnotations}
                setInkAnnotations={handleSetInkAnnotations}
                isDrawMode={isDrawMode}
                inkColor={inkColor}
                inkThickness={inkThickness}
                inkOpacity={inkOpacity}
                specimenAsset={specimenAsset}
                scrollContainerRef={scrollContainerRef}
                activeStampId={activeStampId}
                setActiveStampId={setActiveStampId}
                onDeleteStamp={handleDeleteStamp}
            />
        </div>
    );
});
