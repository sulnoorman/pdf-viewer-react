/**
 * Build a tarball and print how to install it in another app.
 *
 * This is the faithful way to try the package before publishing: a tarball contains
 * exactly what npm would deliver, so it catches the mistakes a monorepo alias or a
 * source import would hide — a missing `files` entry, a broken exports map, a
 * stylesheet that never made it into dist.
 *
 *   bun run pack:local
 */
import { execFileSync } from 'node:child_process'
import { readFile, readdir, rename } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))

execFileSync('npm', ['pack'], { cwd: root, stdio: 'inherit', shell: true })

/*
 * npm flattens a scoped name into the tarball filename: `@armsolusi/pdf-viewer` packs
 * as `armsolusi-pdf-viewer-0.1.0.tgz`. Matching on `pkg.name` directly therefore finds
 * nothing for a scoped package — and, because the rename is guarded by `if (generated)`,
 * it would have failed silently and left the versioned filename in place.
 */
const flatName = pkg.name.replace(/^@/, '').replace(/\//g, '-')

// npm names the tarball after the version; drop it so consuming apps can keep one
// stable path in their package.json while iterating.
const generated = (await readdir(root)).find(
  (name) => name.startsWith(`${flatName}-`) && name.endsWith('.tgz')
)
if (!generated) {
  throw new Error(
    `npm pack produced no ${flatName}-*.tgz in ${root}. ` +
      'If the package name changed, check that this script still derives the same ' +
      'filename npm does.'
  )
}

const stable = `${flatName}.tgz`
if (generated !== stable) {
  await rename(resolve(root, generated), resolve(root, stable))
}

console.log(`
Built ${stable} (v${pkg.version})

Install it in another app:

  bun add ${resolve(root, stable).replace(/\\/g, '/')}
  # or: npm install <that path>

Then use it exactly as the README describes — this is the published package, not a
source alias, so anything broken about packaging shows up here.

Re-run this after every change; the consuming app needs a reinstall to pick it up:

  bun add ${stable} --force
`)
