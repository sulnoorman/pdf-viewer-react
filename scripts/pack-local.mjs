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

const tarballPath = resolve(root, stable).replace(/\\/g, '/')

console.log(`
Built ${stable} (v${pkg.version})

Install it in another app:

  bun add ${tarballPath}
  # or: npm install <that path>

Use it exactly as the README describes — this is the published package, not a source
alias, so anything broken about packaging shows up here. Do NOT install the directory
(\`bun add ../pdf-stamper-app\`): that copies the whole repo, node_modules included, and
ignores the \`files\` field.

RE-INSTALLING after a rebuild takes one extra step. Bun caches a tarball by its path, and
on Windows the re-extract fails with ENOTEMPTY because it cannot rename over the existing
cache entry — \`--force\` does not help. Delete the entry instead, and stop the consuming
app's dev server first, or it will keep serving its pre-bundled copy:

  rm -rf ~/.bun/install/cache/@T@*
  rm -rf node_modules/@armsolusi node_modules/.vite
  bun add ${tarballPath}
`)
