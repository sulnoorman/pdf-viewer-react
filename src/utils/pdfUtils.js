import { PDFDocument } from 'pdf-lib';

export const flattenPDFWithStamps = async (src, specimenAsset, stamps) => {
    if (stamps.length === 0) throw new Error("No specimen placed!");

    const existingPdfBytes = await fetch(src).then(res => res.arrayBuffer());
    const pdfDocLib = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDocLib.getPages();

    const pngImageBytes = await fetch(specimenAsset).then(res => res.arrayBuffer());
    const pngImage = await pdfDocLib.embedPng(pngImageBytes);

    for (const stamp of stamps) {
        const page = pages[stamp.pageIndex];
        if (!page) continue;

        const pdfHeight = page.getHeight();

        // Coordinates in state are now unscaled (scale=1).
        // pdf-lib uses coordinates from the bottom-left corner.
        // Our React coordinates are from the top-left corner.
        const xInPdf = stamp.x;
        const yInPdfFromTop = stamp.y;
        const heightInPdf = stamp.height;
        const widthInPdf = stamp.width;
        
        const yInPdf = pdfHeight - yInPdfFromTop - heightInPdf;

        page.drawImage(pngImage, {
            x: xInPdf,
            y: yInPdf,
            width: widthInPdf,
            height: heightInPdf,
        });
    }

    const pdfBytes = await pdfDocLib.save();
    return new File([pdfBytes], 'signed-document.pdf', { type: 'application/pdf' });
};
