import { useRef, useState } from 'react';
import { PDFViewer } from './PDFViewer';

export default function App() {
  const stamperRef = useRef(null);
  const [hasSpecimen, setHasSpecimen] = useState(false);

  const handleDownload = async () => {
    if (!hasSpecimen) return alert("Please add at least one specimen!");
    try {
        const flattenedPdfFile = await stamperRef.current.getFlattenedPDF();
        const url = URL.createObjectURL(flattenedPdfFile);
        console.log(url)
        // const a = document.createElement('a');
        // a.href = url;
        // a.download = 'signed-document.pdf';
        // a.click();
        // URL.revokeObjectURL(url);
    } catch (e) {
        alert("Failed to download: " + e.message);
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-gray-200">
      {/* 
        This wrapper mimics an iframe container in a real app.
        The PDFStamper is designed to fill its parent container entirely (w-full h-full).
      */}
      <PDFViewer
        ref={stamperRef}
        src="/sample.pdf"
        config={{
          specimenAsset: "/Tandatangan.png",
          onSpecimenChange: (isPlaced) => setHasSpecimen(isPlaced),
          onDownload: handleDownload,
          canDownload: hasSpecimen,
          allowMultipleStamps: true,
          maxStamps: 5, // Example usage of the new limit
        }}
      />
    </div>
  );
}