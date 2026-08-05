import './App.css'
import { useCallback } from 'react'
import { PDFViewer, usePdfViewer, useViewerState } from './index.js'
import IconFileText from '@tabler/icons-react/dist/esm/icons/IconFileText.mjs'

// No workerSrc: the pdf.js worker ships inside the package and is resolved by the
// consumer's own bundler. Pass `config.workerSrc` only to override it.

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
  /*
   * The controller pair, rather than a ref plus an onChange callback.
   *
   * `viewer` has a stable identity, so passing it as a prop never re-renders the
   * viewer, and `useViewerState` reads state out here — outside <PDFViewer> — which is
   * what makes gating a button below possible without mirroring anything in state.
   */
  const viewer = usePdfViewer()
  const { hasSpecimen, hasAnnotation, counts } = useViewerState(viewer)

  const handleDownload = useCallback(async () => {
    try {
      const blob = await viewer.getFlattenedPDF()
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
  }, [viewer])

  const addDocumentNumber = useCallback(() => {
    viewer.addTextStamp({
      text: '123/IT-DEV/VIII/2026',
      fontSize: 16,
      color: '#000000',
    })
  }, [viewer])

  return (
    <div className="w-screen h-screen bg-gray-100 flex flex-col">
      <div className="flex-1 min-h-0">
        <PDFViewer
          viewer={viewer}
          src="/signed-document.pdf"
          config={{
            labels: LABELS,
            specimenAsset: '/Tandatangan.png',
            onDownload: handleDownload,
            canDownload: counts.total > 0,
            allowMultipleStamps: true,
            maxStamps: 5,
            toolbar: {
              // The action row only — thumbnails, page navigation and zoom stay as they
              // are. Note that Download has to be listed even though onDownload is set;
              // leaving it out hides the button.
              displayActions: [],
              customToolbarActions: [
                {
                  id: 'add-number',
                  label: 'Ambil Nomor',
                  icon: <IconFileText size={14} stroke={2} />,
                  onClick: addDocumentNumber,
                },
              ],
            },
          }}
        />
      </div>

      {/*
        The two requirements that made the flags worth separating. Both buttons live
        outside <PDFViewer> and neither goes through an onChange callback.
      */}
      <div className="flex items-center gap-3 p-3 text-sm bg-white border-t">
        <button type="button" disabled={!hasSpecimen} className="px-3 py-1.5 border rounded">
          Butuh spesimen {hasSpecimen ? '✓' : '✗'}
        </button>
        <button type="button" disabled={!hasAnnotation} className="px-3 py-1.5 border rounded">
          Butuh anotasi {hasAnnotation ? '✓' : '✗'}
        </button>
        <code className="text-xs text-gray-600">{JSON.stringify(counts)}</code>
      </div>
    </div>
  )
}
