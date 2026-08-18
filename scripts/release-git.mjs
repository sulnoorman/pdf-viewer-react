/**
 * Cut a git-installable release, for use before the package is on a registry.
 *
 * A plain `bun add git+https://…` does not work on this repo, and fails in the worst way:
 * it reports success, delivers the whole source tree, and omits `dist/` — which is
 * gitignored — leaving `main` pointing at a file that does not exist. Every import then
 * fails somewhere far from the cause.
 *
 * So this builds the package and commits the result onto a dedicated `release` branch,
 * tagged with the version. Consumers install the tag, which contains exactly what npm
 * would have shipped plus the sources. `master` keeps `dist/` ignored, so day-to-day work
 * is unaffected by build output.
 *
 *   bun run release:git
 *
 * Nothing is pushed. The push commands are printed for you to run, because that is the
 * step that becomes public and irreversible.
 *
 * This is scaffolding for the interim. Once the package is on a registry — npm, or GitHub
 * Packages — delete it and use `npm publish`; see the versioning notes in MAINTAINING.md.
 */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE_BRANCH = 'release'

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const run = (command) => execFileSync(command, { cwd: root, stdio: 'inherit', shell: true })

const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const tag = `v${pkg.version}`

/*
 * A dirty tree would be silently baked into the release commit, so the version people
 * install would not match any commit you could later look at.
 */
if (git('status', '--porcelain')) {
  throw new Error(
    'Working tree is not clean. Commit or stash first — otherwise the release contains ' +
      'changes that exist nowhere in the history.'
  )
}

// Moving an existing tag is how people end up with two different builds under one
// version, and lockfiles that resolve to whichever they happened to fetch first.
const tags = git('tag', '--list').split('\n').filter(Boolean)
if (tags.includes(tag)) {
  throw new Error(
    `Tag ${tag} already exists. Bump the version in package.json first — a published ` +
      'version must never change under people.'
  )
}

const startingBranch = git('rev-parse', '--abbrev-ref', 'HEAD')
const sourceCommit = git('rev-parse', '--short', 'HEAD')

console.log(`\nBuilding ${pkg.name}@${pkg.version} from ${startingBranch} (${sourceCommit})\n`)

// The same gates a real `npm publish` would run, so a git release is not a lesser one.
run('bun run lint')
run('bun run test')
run('bun run build')
run('bunx publint')

console.log(`\nCommitting dist/ onto "${RELEASE_BRANCH}" and tagging ${tag}\n`)

try {
  // Reset rather than merge: the branch is a generated artefact, not a line of history.
  git('checkout', '-B', RELEASE_BRANCH)
  // -f because dist/ is gitignored on purpose, and stays that way on master.
  git('add', '-f', 'dist')
  git('commit', '-m', `release ${tag} (from ${sourceCommit})`, '--no-verify')
  git('tag', '-a', tag, '-m', `${pkg.name} ${pkg.version}`)
} finally {
  // Always land back where you started, even if the commit failed.
  git('checkout', startingBranch)
}

const repo = (pkg.repository?.url ?? '')
  .replace(/^git\+/, '')
  .replace(/\.git$/, '')

console.log(`
Done, locally. Nothing has been pushed.

To publish it:

  git push origin ${startingBranch}
  git push -f origin ${RELEASE_BRANCH}
  git push origin ${tag}

The first one matters as much as the others: without it the tag points at a source commit
nobody else can see, so the release exists but the work behind it does not.

Then your team installs it, either way:

  bun add git+${repo}.git#${tag}
  # or: npm install ${repo}.git#${tag}

  # or put it in package.json and run \`bun install\`
  "${pkg.name}": "git+${repo}.git#${tag}"

Both work. The second is the one to reach for if \`bun add\` fails with ENOTEMPTY: on Windows
bun cannot rename over an entry already in its global cache, which happens when it has
fetched that commit before. \`bun install\` reads the cache instead of re-extracting, so it
is unaffected. Clearing the entry also fixes it: rm -rf ~/.bun/install/cache/@GH@*

Pin the tag, not the branch. A branch reference resolves to whatever it points at now, so
two people installing on different days get different builds with no way to tell.
`)
