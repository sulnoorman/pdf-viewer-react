import { useRef, useState } from 'react';
import { PDFViewer } from './PDFViewer';

export default function App() {
  const stamperRef = useRef(null);
  const [hasSpecimen, setHasSpecimen] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);

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
      {/* Toolbar Actions */}
      <div className="flex gap-4 p-4 bg-white border-b border-gray-300">
          <button
              onClick={() => {
                  if (stamperRef.current) {
                      stamperRef.current.addStamp();
                  }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium shadow-sm"
          >
              + Add Stamp
          </button>
          
          <button
              onClick={() => setIsDrawMode(!isDrawMode)}
              className={`px-4 py-2 rounded-md transition font-medium shadow-sm flex items-center gap-2 ${
                  isDrawMode 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 ring-2 ring-indigo-300' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              {isDrawMode ? 'Drawing Mode: ON' : 'Draw Mode'}
          </button>
      </div>

      <PDFViewer
        ref={stamperRef}
        src="/sample.pdf"
        config={{
          specimenAsset: "/Tandatangan.png",
          onSpecimenChange: (isPlaced) => setHasSpecimen(isPlaced),
          onDownload: handleDownload,
          canDownload: hasSpecimen,
          allowMultipleStamps: true,
          maxStamps: 5,
          isDrawMode: isDrawMode,
        }}
      />
    </div>
  );
}