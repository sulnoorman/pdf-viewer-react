import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// `vite` (dev/preview) serves the demo app in index.html + src/main.jsx.
// `vite build` produces the distributable library from src/index.js.
//
// Tailwind is used by the DEMO ONLY (src/App.css). The library itself must never
// require the consumer to have Tailwind configured — see docs/ARCHITECTURE.md.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],

  // public/ holds demo fixtures (sample PDF, signature image). Copying them into
  // dist/ would ship them inside the published tarball, so only serve them in dev.
  publicDir: command === 'build' ? false : 'public',

  // NOTE: no `define: { 'process.env': {} }` here, and none is needed. It only ever
  // existed for react-draggable (inside react-rnd), which read process.env at drag
  // time; that dependency is gone, along with the `process` shim the demo carried.

  build: {
    // NOTE: library mode inlines every referenced asset as a data URL and ignores
    // assetsInlineLimit entirely. That is why src/ must never import the pdf.js
    // worker — doing so base64-encoded 1.25 MB into the bundle. The worker URL is
    // supplied by the host app via `config.workerSrc`; see utils/worker.js.
    lib: {
      entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
      /*
        ESM only, deliberately.

        A UMD/CJS build was emitted at first, but it could never have loaded: its
        require() branch pulls in `@tabler/icons-react/.../*.mjs` — which Node cannot
        require from CJS — and pdfjs-dist v6 is itself ESM-only (`main: build/pdf.mjs`).
        Publishing a `require` entry that always throws is worse than publishing none,
        because a bundler may pick it and fail somewhere far from the cause.

        Every target that can run pdfjs-dist v6 already handles ESM packages.
      */
      formats: ['es'],
      fileName: 'react-pdf-viewer-stamping',
      // Deterministic stylesheet name so `react-pdf-viewer-stamping/style.css` resolves.
      cssFileName: 'style',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'pdfjs-dist',
        'pdf-lib',
        // Icons are imported via deep paths (@tabler/icons-react/dist/esm/icons/*.mjs),
        // so a bare package name would not match — hence the regex.
        /^@tabler\/icons-react(\/.*)?$/,
      ],
      // No `output.globals`: that only applies to UMD/IIFE, which this no longer builds.
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}', 'tests/**/*.{test,spec}.{js,jsx}'],
  },
}))
