import { Page } from './Page';
import { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';

export const Document = forwardRef(({ pdfDoc, scale, stamps, setStamps, specimenAsset, scrollContainerRef, activeStampId, setActiveStampId, onDeleteStamp }, ref) => {
    const activePageIndex = useRef(0);

    useEffect(() => {
        if (!scrollContainerRef.current) return;
        
        const observer = new IntersectionObserver((entries) => {
            let maxRatio = 0;
            let bestIndex = activePageIndex.current;
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
                    maxRatio = entry.intersectionRatio;
                    bestIndex = parseInt(entry.target.dataset.pageIndex, 10);
                }
            });
            if (maxRatio > 0) {
                activePageIndex.current = bestIndex;
            }
        }, {
            root: scrollContainerRef.current,
            threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
        });

        // We need a slight delay to ensure DOM nodes are rendered by React
        setTimeout(() => {
            if (scrollContainerRef.current) {
                const pages = scrollContainerRef.current.querySelectorAll('.pdf-page-container');
                pages.forEach(p => observer.observe(p));
            }
        }, 100);

        return () => observer.disconnect();
    }, [pdfDoc, scale]);

    useImperativeHandle(ref, () => ({
        getActivePageIndex: () => activePageIndex.current
    }));

    return (
        <div 
            ref={scrollContainerRef} 
            className="flex-1 overflow-auto py-8 flex flex-col items-center relative"
            onMouseDown={() => setActiveStampId(null)}
        >
            {pdfDoc && Array.from({ length: pdfDoc.numPages }).map((_, i) => (
                <Page
                    key={i}
                    pdfDoc={pdfDoc}
                    pageNumber={i + 1}
                    scale={scale}
                    stamps={stamps}
                    setStamps={setStamps}
                    specimenAsset={specimenAsset}
                    activeStampId={activeStampId}
                    setActiveStampId={setActiveStampId}
                    onDeleteStamp={onDeleteStamp}
                />
            ))}
        </div>
    );
});
