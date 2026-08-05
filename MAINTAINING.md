# Maintaining `@armsolusi/pdf-viewer`

Notes for whoever releases this package. Consumer documentation is in [README.md](README.md).

## Versioning

Semantic versioning, with the caveat that **`0.x` treats minor as breaking**. That is the
published convention for pre-1.0 packages and it is what the README tells consumers.

| Change | While `0.x` | After `1.0` |
| --- | --- | --- |
| Breaking API change | `0.1.0` → `0.2.0` | `1.4.2` → `2.0.0` |
| New feature, nothing breaks | `0.1.0` → `0.1.1` | `1.4.2` → `1.5.0` |
| Bug fix | `0.1.0` → `0.1.1` | `1.4.2` → `1.4.3` |

**What counts as breaking** — anything a consumer could be relying on:

- removing or renaming a `config` key, a `viewer` method, or a toolbar action id
- changing what an existing key *means* (`onSpecimenChange` did this; it was in the
  changelog for that reason)
- removing a CSS custom property, or the `.rpvs-viewer` class name
- changing the shape of `getAnnotations()` output
- raising the minimum React version

**What does not**: adding a `config` key with a default that preserves current behaviour,
adding a toolbar action to `DEFAULT_TOOLBAR_ACTIONS`, adding a label key, adding a method
to the handle. Consumers who filter `DEFAULT_TOOLBAR_ACTIONS` rather than writing their own
list get new controls automatically — which is why the README pushes them towards that.

### Reaching 1.0

Go to `1.0.0` when the API has been used in more than one application without needing a
breaking change. Until then `0.x` is an honest signal, and the README says so in its first
paragraph. Do not stay on `0.x` out of habit once it is settled: it tells people the
package is unfinished.

## Distributing before it is on a registry

The package is not published yet. Teams install it from a git tag instead.

**A plain `bun add git+https://…` does not work, and fails in the worst possible way**: it
reports success, delivers the entire source tree, and omits `dist/` — which is gitignored —
so `main` points at a file that does not exist and every import fails somewhere far from
the cause. Verified, not assumed.

`bun run release:git` is the way round it. It runs the same gates as a real publish, then
commits `dist/` onto a `release` branch and tags it. `master` keeps `dist/` ignored, so
everyday work is unaffected by build output.

```bash
bun run release:git          # builds, verifies, commits and tags locally
git push -f origin release   # it prints these two for you
git push origin v0.1.0
```

Consumers then pin the **tag**, never the branch:

```bash
bun add git+https://github.com/sulnoorman/pdf-viewer-react.git#v0.1.0
```

A branch reference resolves to whatever it points at today, so two people installing on
different days silently get different builds.

### Its limits, and when to stop using it

- **The repository is public, so this is not private distribution.** It exposes strictly
  more than npm would: all of `src/`, every branch, and the whole commit history. Anyone
  choosing this route for privacy has the wrong tool.
- Build output lives in git on the `release` branch. Tolerable for an interim; not
  something to keep for years.
- There is no `npm deprecate`, no download stats, no provenance.

Move to a registry once the API has settled. **npm** if public is fine — only `dist/` is
distributed. **GitHub Packages** if it must be private: free with a private repository, but
the scope has to match the repository owner, so it needs a GitHub organisation actually
named `armsolusi`. Either way, delete `scripts/release-git.mjs` and use the flow below.

## Releasing

```bash
# 1. Everything green, from a clean tree on master
bun run lint && bun run test && bun run build && bunx publint

# 2. Write the changelog entry FIRST, while you still remember why
#    CHANGELOG.md — group under Added / Changed / Fixed, and say *why* for anything breaking

# 3. Bump. This also creates the git tag.
npm version patch    # or minor / major

# 4. Publish. prepublishOnly re-runs lint, test, build and publint.
npm publish

# 5. Push the commit and the tag
git push --follow-tags
```

`npm version` refuses to run on a dirty tree, which is the check you want.

### Before the very first publish

- [ ] **`LICENSE` still says `<COMPANY LEGAL NAME — REPLACE BEFORE PUBLISHING>`.** Put the
      exact registered name in. It is the one thing here that is awkward to correct after
      the fact, because the licence text is what people rely on.
- [ ] The npm organisation `armsolusi` must exist, and you must be a member of it. A
      scoped package cannot be published to an organisation that does not exist.
- [ ] `npm login`, then confirm with `npm whoami`.
- [ ] `publishConfig.access` is already `public`; without it npm defaults scoped packages
      to restricted and the publish fails with a paywall error.
- [ ] `repository`, `homepage` and `bugs` point at `sulnoorman/pdf-viewer-react`. Fine for
      now — GitHub redirects if the repo is later moved to a company organisation — but
      updating them then means another release, since npm renders whatever was published.

### Verify what you are about to ship

```bash
npm pack --dry-run          # the exact file list
bun run pack:local          # a tarball to install into a real app
```

A published version can never be replaced — `npm publish` on an existing version is
rejected. `npm unpublish` is only allowed within 72 hours and only if nothing depends on
it; after that the version is permanent. So the tarball test is not ceremony.

`npm deprecate @armsolusi/pdf-viewer@0.1.0 "message"` is the tool for a bad release: it
leaves the version installable but warns on install. That is almost always the right
response, not unpublishing.

## The pdfjs-dist pin

`pdfjs-dist` is pinned to an **exact** version, not a range. pdf.js throws when the worker
and the API versions differ, and the package ships the worker — so a range would let npm
install a mismatched pair. `scripts/copy-worker.mjs` fails the build if the pin and the
installed version drift apart.

The consequence is that upgrading pdf.js is a release here:

```bash
bun add pdfjs-dist@<exact version>   # no caret
bun run build                        # copy-worker.mjs verifies the pin
bun run test
```

Then check rendering, the text layer, and export by hand — pdf.js minor versions have
changed viewport and rotation behaviour before. Ship it as a patch unless the pdf.js
change is itself breaking for consumers.

## What CI covers, and what it cannot

`.github/workflows/ci.yml` runs lint, tests, build, `publint`, a strict-mode typecheck of
the hand-written declarations, and a bundle-size guard.

The size guard matters more than it looks: Vite library mode inlines referenced assets and
ignores `assetsInlineLimit`, so a single `?url` import would base64 the 1.2 MB worker into
the published bundle. It has happened once, and the only symptom is a package fifteen
times too large.

**Not covered, and needs a human before any release touching them:**

- rendering, text selection, and the annotation layer in a real browser
- drag, resize, rotate, and the coordinate maths that puts annotations in the right place
  in the exported file — especially on a rotated page
- trackpad pinch zoom
- installing the tarball into a real app, which is where every packaging bug so far has
  actually surfaced (see the gotchas below)

## Packaging traps that have already cost time

- **Never `import x from '…?url'` in `src/`.** See the size guard above.
- **`import.meta.env.PROD` is substituted at *this package's* build time**, not the
  consumer's, so guarding dev-only warnings on it deletes them before anyone sees them.
- **`vite build` passing does not mean `vite dev` passes.** The dev server pre-bundles
  dependencies into `node_modules/.vite/deps`, which relocates `import.meta.url` — that
  broke the bundled worker while every production build was green.
- **Test with a tarball, never `npm install <dir>` or `bun add <dir>`.** A directory
  install copies or symlinks the whole repo, `node_modules` included, and ignores `files`.
- **Re-installing the same tarball with bun on Windows** fails with `ENOTEMPTY`; delete
  `~/.bun/install/cache/@T@*` first. `bun run pack:local` prints the whole procedure.
