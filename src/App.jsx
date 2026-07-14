import { useState, useRef } from 'react';
import { PDFViewer } from './PDFViewer';
import { IconFileText } from '@tabler/icons-react';
import './App.css';

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
      <PDFViewer
        ref={stamperRef}
        src="/signed-document.pdf"
        config={{
          specimenAsset: '/Tandatangan.png',
          onSpecimenChange: (isPlaced) => setHasSpecimen(isPlaced),
          onDownload: handleDownload,
          canDownload: hasSpecimen,
          allowMultipleStamps: true,
          maxStamps: 5,
          customToolbarActions: [
            {
              id: 'btn-add-number',
              label: 'Ambil Nomor',
              icon: <IconFileText size={14} stroke={2} />,
              onClick: () => {
                // Simulate fetching a number from API
                const fakeNumber = "123/IT-DEV/VIII/2026";
                if (stamperRef.current) {
                  stamperRef.current.addTextStamp({
                    text: fakeNumber,
                    fontSize: 16,
                    color: '#000000'
                  });
                }
              }
            }
          ]
        }}
      />
    </div>
  );
}