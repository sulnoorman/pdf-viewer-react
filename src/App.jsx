import { useRef, useState } from 'react';
import { PDFStamper } from './PDFStamper';

export default function App() {
  const stamperRef = useRef(null);
  const [hasSpecimen, setHasSpecimen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasSpecimen) return alert("Please add at least one specimen!");
    const flattenedPdfFile = await stamperRef.current.getFlattenedPDF();

    const url = URL.createObjectURL(flattenedPdfFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flattened-result.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Digital Signature Form</h2>

      <div className="mb-4">
        <PDFStamper
          ref={stamperRef}
          src="/sample.pdf"
          specimenAsset="/Tandatangan.png"
          onSpecimenChange={(isPlaced) => setHasSpecimen(isPlaced)}
        />
      </div>

      <button
        type="submit"
        disabled={!hasSpecimen}
        className={`px-4 py-2 rounded text-white ${hasSpecimen ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
      >
        Submit & Download Test
      </button>
    </form>
  );
}