import { Page } from './Page';

export const Document = ({ pdfDoc, scale, stamps, setStamps, specimenAsset, scrollContainerRef, activeStampId, setActiveStampId }) => {
    return (
        <div ref={scrollContainerRef} className="flex-1 overflow-auto py-8 flex flex-col items-center relative">
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
                />
            ))}
        </div>
    );
};
