import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { devWorkerPlugin } from './scripts/dev-worker-plugin.mjs'

// `vite` (dev/preview) serves the demo app in index.html + src/main.jsx.
// `vite build` produces the distributable library from src/index.js.
//
// Tailwind is used by the DEMO ONLY (src/App.css). The library itself must never
// require the consumer to have Tailwind configured — see docs/ARCHITECTURE.md.
export default defineConfig(({ command }) => ({
  // devWorkerPlugin only applies to `vite`/`vite preview`; the worker lives in dist/ for
  // real consumers, and nowhere in src/. See scripts/dev-worker-plugin.mjs.
  plugins: [react(), tailwindcss(), devWorkerPlugin()],

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
      /*
        Flat, and deliberately NOT derived from the package name.

        The package is scoped (`@armsolusi/pdf-viewer`); using that verbatim would make
        Rollup write dist/@armsolusi/pdf-viewer.js and quietly break `main` and the
        exports map. Keep this in step with both by hand.
      */
      fileName: 'pdf-viewer',
      // Deterministic stylesheet name so `@armsolusi/pdf-viewer/style.css` resolves.
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
        /*
          Kept out of the bundle on purpose, and copied into dist/ verbatim by
          scripts/copy-worker.mjs.

          It holds `new URL('./pdf.worker.min.js', import.meta.url)`. Bundled, Vite would
          resolve that here and inline 1.2 MB as base64 — the bug that once took this
          package from 36 kB to 1.7 MB. External, the expression reaches the consumer's
          bundler intact, where a path relative to the module works on both Vite and
          webpack 5.
        */
        './workerUrl.js',
      ],
      output: {
        /*
          Flatten the one relative external.
          Rollup resolves a relative external to an absolute path and then emits it
          relative to the entry — `./PDFViewer/utils/workerUrl.js`, mirroring src/. The
          published package is flat, so without this the import points at a directory
          that does not exist in dist/ and every consumer build fails to resolve it.
        */
        paths: (id) => (id.endsWith('workerUrl.js') ? './workerUrl.js' : id),
      },
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
