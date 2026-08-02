import '@testing-library/jest-dom/vitest'

/**
 * pdfjs-dist touches a handful of canvas-related globals at import time. jsdom does
 * not implement them, so merely `import 'pdfjs-dist'` throws ReferenceError before a
 * single test runs. These stubs exist only to make the module importable — no test
 * should depend on their behaviour. Anything that needs real rasterisation belongs in
 * a Storybook interaction test running in a real browser.
 */

if (!globalThis.DOMMatrix) {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      const [a, b, c, d, e, f] = Array.isArray(init) ? init : [1, 0, 0, 1, 0, 0]
      Object.assign(this, { a, b, c, d, e, f })
    }
    // pdf.js only ever composes matrices; identity behaviour is enough for import.
    multiply() {
      return this
    }
    invertSelf() {
      return this
    }
    translate() {
      return this
    }
    scale() {
      return this
    }
  }
}

if (!globalThis.Path2D) {
  globalThis.Path2D = class Path2D {
    addPath() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    rect() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
  }
}

if (!globalThis.Worker) {
  // pdf.js validates `workerPort instanceof Worker` before accepting one.
  globalThis.Worker = class Worker {
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    terminate() {}
  }
}

if (!globalThis.ImageData) {
  globalThis.ImageData = class ImageData {
    constructor(width, height) {
      this.width = width
      this.height = height
      this.data = new Uint8ClampedArray(width * height * 4)
    }
  }
}
