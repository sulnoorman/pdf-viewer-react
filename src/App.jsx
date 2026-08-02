import './App.css'
import { useState, useRef, useCallback } from 'react'
import { PDFViewer } from './PDFViewer'
import IconFileText from '@tabler/icons-react/dist/esm/icons/IconFileText.mjs'

// The library deliberately does not bundle the pdf.js worker — the host app supplies
// its URL, because how you reference it depends on your bundler. This is the Vite form.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/**
 * Indonesian UI, supplied entirely from the host.
 *
 * Only the keys that matter are listed; anything omitted falls back to the English
 * default. This is what `config.labels` is for — translating without forking the
 * library and having to re-apply the edits on every upgrade.
 */
const LABELS = {
  toggleThumbnails: 'Tampilkan pratinjau halaman',
  thumbnailSidebar: 'Pratinjau halaman',
  previousPage: 'Halaman sebelumnya',
  nextPage: 'Halaman berikutnya',
  pageNumber: 'Nomor halaman',
  goToPage: 'Ke halaman {page}',
  zoomIn: 'Perbesar (Ctrl +)',
  zoomOut: 'Perkecil (Ctrl -)',
  // zoomLevel: 'Tingkat perbesaran',
  // zoomAutomatic: 'Otomatis',
  // zoomActualSize: 'Ukuran Asli',
  // zoomPageFit: 'Muat Halaman',
  // zoomPageWidth: 'Lebar Halaman',
  rotateLeft: 'Putar kiri (tahan Shift untuk semua halaman)',
  rotateRight: 'Putar kanan (tahan Shift untuk semua halaman)',
  undo: 'Urungkan (Ctrl+Z)',
  redo: 'Ulangi (Ctrl+Y)',
  draw: 'Coret bebas',
  drawSettings: 'Pengaturan coretan',
  colour: 'Warna',
  thickness: 'Ketebalan',
  opacity: 'Transparansi',
  strokeThickness: 'Ketebalan goresan',
  strokeOpacity: 'Transparansi goresan',
  addStamp: 'Tambah stempel',
  chooseStamp: 'Pilih gambar stempel',
  uploadImage: 'Unggah gambar…',
  noStampConfigured: 'Belum ada gambar stempel',
  addText: 'Tambah kotak teks',
  textPlaceholder: 'Ketik di sini…',
  fontSize: 'Ukuran font',
  font: 'Font',
  textColour: 'Warna teks',
  duplicate: 'Gandakan (Ctrl+D)',
  delete: 'Hapus (Del)',
  download: 'Unduh',
  loading: 'Memuat dokumen…',
  loadFailed: 'Dokumen ini tidak dapat dibuka.',
  retry: 'Coba lagi',
  noDocument: 'Belum ada dokumen.',
}

export default function App() {
  const viewerRef = useRef(null)
  const [counts, setCounts] = useState({ image: 0, text: 0, ink: 0, total: 0 })

  const handleDownload = useCallback(async () => {
    try {
      const blob = await viewerRef.current.getFlattenedPDF()
      const url = URL.createObjectURL(blob)
      // const link = document.createElement('a')
      // link.href = url
      // link.download = 'signed-document.pdf'
      // document.body.appendChild(link)
      // link.click()
      // link.remove()
      // // Revoking immediately can cancel the download in some browsers.
      // setTimeout(() => URL.revokeObjectURL(url), 10_000)
      console.log(url)
    } catch (e) {
      alert(`Failed to export: ${e.message}`)
    }
  }, [])

  const addDocumentNumber = useCallback(() => {
    viewerRef.current?.addTextStamp({
      text: '123/IT-DEV/VIII/2026',
      fontSize: 16,
      color: '#000000',
    })
  }, [])

  return (
    <div className="w-screen h-screen bg-gray-100 flex items-center justify-center">
      <PDFViewer
        ref={viewerRef}
        src="/signed-document.pdf"
        config={{
          workerSrc,
          labels: LABELS,
          specimenAsset: '/Tandatangan.png',
          // Gating on the image-stamp count alone locked out anyone who had only
          // drawn or typed. Any annotation now enables the export button.
          onAnnotationsChange: setCounts,
          onDownload: handleDownload,
          canDownload: counts.total > 0,
          allowMultipleStamps: true,
          maxStamps: 5,
          customToolbarActions: [
            {
              id: 'btn-add-number',
              label: 'Ambil Nomor',
              icon: <IconFileText size={14} stroke={2} />,
              onClick: addDocumentNumber,
            },
          ],
        }}
      />
    </div>
  )
}
