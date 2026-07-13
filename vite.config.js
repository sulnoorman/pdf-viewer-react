import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    'process.env': {}
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'ReactPdfViewerStamping',
      fileName: 'react-pdf-viewer-stamping',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'pdfjs-dist', 'pdf-lib', 'react-rnd'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'pdfjs-dist': 'pdfjsLib',
          'pdf-lib': 'PDFLib'
        }
      }
    }
  }
})
