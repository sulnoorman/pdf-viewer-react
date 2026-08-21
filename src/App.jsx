import './App.css'
import { useCallback, useState } from 'react'
import IconFileText from '@tabler/icons-react/dist/esm/icons/IconFileText.mjs'
import {
  PDFViewer,
  usePdfViewer,
  useViewerState,
  DEFAULT_TOOLBAR_ACTIONS,
} from './index.js'

/**
 * A complete integration, meant to be read as the reference example.
 *
 * It deliberately shows every part a real application needs and nothing it does not:
 * translated labels, a configured signature, a host toolbar action, state read outside
 * the viewer to gate two different submit rules, and export.
 *
 * Note what is absent. There is no `workerSrc`: the pdf.js worker ships inside the
 * package and the consumer's bundler emits it. There is no `useState` mirroring the
 * annotation counts, and no `onAnnotationsChange`: `useViewerState` reads them directly.
 */

/**
 * Indonesian UI, supplied entirely from the host.
 *
 * Only the keys that matter are listed; anything omitted falls back to the English
 * default. This is what `config.labels` is for — translating without forking the
 * library and having to re-apply the edits on every upgrade. `DEFAULT_LABELS` is
 * exported if you want to enumerate every key.
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
  zoomLevel: 'Tingkat perbesaran',
  zoomAutomatic: 'Otomatis',
  zoomActualSize: 'Ukuran asli',
  zoomPageFit: 'Muat halaman',
  zoomPageWidth: 'Lebar halaman',
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
  addStamp: 'Tambah spesimen',
  chooseStamp: 'Pilih spesimen',
  noStampConfigured: 'Belum ada spesimen',
  addImage: 'Tambah gambar sendiri',
  chooseImage: 'Pilih gambar yang sudah ditambahkan',
  uploadImage: 'Unggah gambar lain…',
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

/*
 * Asset URLs are fetched by the browser, not resolved by the bundler, so a leading "/"
 * is relative to the origin and ignores any `base` the app is served under. BASE_URL
 * already ends in a slash.
 */
const SPECIMEN = `${import.meta.env.BASE_URL}Tandatangan.png`

export default function App() {
  /*
   * The controller pair, rather than a ref plus an onChange callback.
   *
   * `viewer` has a stable identity, so passing it as a prop never re-renders the viewer,
   * and `useViewerState` reads state out here — outside <PDFViewer> — which is what lets
   * the buttons below react without mirroring anything into local state.
   *
   * Pass a selector when you only need part of it: `useViewerState(v, s => s.canUndo)`
   * re-renders only when that value changes, rather than on every zoom tick.
   */
  const viewer = usePdfViewer()
  const { hasSpecimen, hasAnnotation, counts, status } = useViewerState(viewer)
  const [message, setMessage] = useState(null)

  /**
   * The library never saves the file. `getFlattenedPDF()` hands back a Blob and what
   * happens to it is the application's decision — which is what makes uploading the
   * signed document just as natural as downloading it.
   */
  const handleDownload = useCallback(async () => {
    try {
      setMessage('Menyiapkan berkas…')
      const blob = await viewer.getFlattenedPDF()

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'dokumen-bertanda-tangan.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000)

      setMessage(`Selesai — ${(blob.size / 1024).toFixed(0)} kB`)
    } catch (error) {
      setMessage(`Gagal: ${error.message}`)
    }
  }, [viewer])

  /** A host action on the toolbar. Anything on the handle is available to it. */
  const addDocumentNumber = useCallback(() => {
    viewer.addTextStamp({
      text: `123/IT-DEV/${new Date().getFullYear()}`,
      fontSize: 16,
      color: '#000000',
    })
  }, [viewer])

  const ready = status === 'ready'

  return (
    /*
      A full-height column that does not scroll: header, viewer, footer.

      This is the arrangement to copy. `overflow-hidden` on the page plus `flex-1 min-h-0`
      on the viewer's box means the *viewer* scrolls its own document, and the page around
      it stays put. `min-h-0` is the part that is easy to miss — without it a flex item
      refuses to shrink below its content, so the column grows past the viewport and the
      page scrolls after all.

      Let the page scroll instead and everything still works, but the viewer's content
      travels up behind anything pinned to the top of the window. That is the arrangement
      that exposed the stacking bug; see "Putting your own UI over the viewer" in the
      README if you need it.
    */
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-100">
      <header className="flex-none border-b bg-white p-3">
        <p className="text-black">Header</p>
      </header>

      <div className="min-h-0 flex-1 p-3">
        <div className="h-full">
          <PDFViewer
            viewer={viewer}
            src="/signed-document.pdf"
            config={{
              labels: LABELS,

              /* The signature. Only stamps placed from this satisfy `hasSpecimen`. */
              specimenAsset: SPECIMEN,

              /* Extra images the host offers. These are stamps, never specimens. */
              stampAssets: [{ id: 'seal', label: 'Cap perusahaan', src: SPECIMEN }],

              allowMultipleStamps: true,
              maxStamps: 5,

              /* Supplying onDownload is what renders the Download button. */
              onDownload: handleDownload,
              canDownload: ready && counts.total > 0,

              toolbar: {
                /*
                 * Everything except page rotation, plus one action of our own.
                 *
                 * Filtering the exported default rather than writing the list by hand
                 * keeps this in step with controls added in later versions. Only the
                 * right-hand action row is configurable — thumbnails, page navigation and
                 * zoom are always present.
                 */
                displayActions: [
                  ...DEFAULT_TOOLBAR_ACTIONS.filter((id) => id !== 'image'),
                  'ambil-nomor',
                ],
                customToolbarActions: [
                  {
                    id: 'ambil-nomor',
                    label: 'Ambil Nomor',
                    icon: <IconFileText size={16} stroke={2} />,
                    disabled: !ready,
                    onClick: addDocumentNumber,
                  },
                ],
              },

              onLoadError: (error) => setMessage(`Gagal memuat: ${error.message}`),
            }}
          />
        </div>
      </div>

      {/*
        Two submit rules with different requirements — the reason the flags are separate.
        Both live outside <PDFViewer>, and neither goes through a callback.
      */}
      <div className="flex flex-none flex-wrap items-center gap-3 border-t bg-white p-3 text-sm">
        <button
          type="button"
          disabled={!hasSpecimen}
          onClick={() => setMessage('Kirim sebagai dokumen bertanda tangan')}
          className="rounded border px-3 py-1.5 disabled:opacity-40"
        >
          Kirim — wajib spesimen {hasSpecimen ? '✓' : '✗'}
        </button>

        <button
          type="button"
          disabled={!hasAnnotation}
          onClick={() => setMessage('Kirim sebagai dokumen bercatatan')}
          className="rounded border px-3 py-1.5 disabled:opacity-40"
        >
          Kirim — wajib catatan {hasAnnotation ? '✓' : '✗'}
        </button>

        <code className="text-xs text-gray-600">{JSON.stringify(counts)}</code>
        {message && <span className="text-gray-700">{message}</span>}
      </div>
    </div>
  )
}
