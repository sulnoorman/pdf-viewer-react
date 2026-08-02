/**
 * Writes the shared test fixture to disk for the demo app and Storybook.
 *
 * Unit tests do NOT use this file — they call createFixturePdf() directly so there
 * is no build step to forget. Run with:  bun run fixture
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFixturePdf } from '../tests/helpers/fixture.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(root, 'public/sample.pdf')

const bytes = await createFixturePdf()
await mkdir(dirname(target), { recursive: true })
await writeFile(target, bytes)

console.log(`Wrote ${target} (${(bytes.length / 1024).toFixed(1)} KB)`)
