/**
 * Copies the hand-written type declarations into dist/.
 *
 * Vite's library build emits JS and CSS but knows nothing about `.d.ts`, and this
 * project deliberately hand-writes its types rather than generating them — a
 * generator run over JSX produces `any` for most of the config surface, which is
 * exactly the part consumers need help with.
 */
import { copyFile, mkdir, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'src/index.d.ts')
const target = resolve(root, 'dist/index.d.ts')

try {
  await access(source)
} catch {
  console.error('src/index.d.ts is missing — the published package would have no types.')
  process.exit(1)
}

await mkdir(dirname(target), { recursive: true })
await copyFile(source, target)
console.log('Wrote dist/index.d.ts')
