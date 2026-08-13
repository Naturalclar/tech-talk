# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A collection of Japanese-language tech talk slide decks written in MDX, built with **mdx-deck v1**. Each deck is compiled into its own static site, and a generated landing page (`dist/index.html`) links them all. Published at `https://slides.naturalclar.dev` (Netlify — see `src/_redirects`).

## Commands

**The package manager is pnpm** (pinned via `packageManager` in `package.json`). There is no `yarn.lock`; don't reintroduce one.

```bash
pnpm install              # also runs prepare (tsc)
pnpm run prepare          # tsc: compiles scripts/*.ts -> bin/*.js (bin/ is gitignored)
pnpm run build            # runs ./bin/generate-slides.js src/talks — full site build into dist/
pnpm run lint             # eslint ./src --ext .ts,.tsx
pnpm run new              # scaffdog: scaffold a new talk from .scaffdog/template.md
pnpm start                # dev server — HARDCODED to src/talks/create-touchbar-app-with-js/index.mdx
pnpm run clean            # rm -rf dist
```

`pnpm run build` executes the **compiled** script in `bin/`, so run `pnpm run prepare` first after any change to `scripts/`. `bin/` is not committed, so a fresh clone must install (or run prepare) before building.

To preview a deck other than the one wired into `start`:

```bash
npx mdx-deck src/talks/<slug>/index.mdx
```

The remaining `build:*` scripts (`build:mdx`, `build:screenshot`, `build:oembed`, `build:index`, `build:assets`) are sub-steps invoked by `generate-slides.ts`, not meant to be run by hand except when debugging one stage.

There is no test suite. CI (`.github/workflows/ci.yml`) runs `pnpm run lint` → `pnpm run build` on Node 22 and uploads `dist/` as an artifact.

**`pnpm run build` requires `NODE_OPTIONS=--openssl-legacy-provider` on Node 17+.** webpack 4 hashes with md4, which OpenSSL 3 refuses; without the flag the build dies with `ERR_OSSL_EVP_UNSUPPORTED`. CI sets it on the build step.

`build:screenshot` passes `--no-sandbox` so the Chromium that puppeteer 1.13 bundles can launch as root and inside containers. That Chromium is from 2019 and needs the pre-t64 shared libraries (`libasound2`, `libatk1.0-0`, `libxss1`, …), which is why CI pins `ubuntu-22.04` rather than `ubuntu-latest`. Downloading it depends on puppeteer's postinstall, which pnpm 10 blocks unless the package is listed under `pnpm.onlyBuiltDependencies` in `package.json` — if screenshots start failing with a missing Chromium, check that list first.

### Calling scripts from `generate-slides.ts`

The orchestrator shells out to the other npm-scripts. Two rules that are easy to get wrong:

- **Never insert `--` before the arguments.** pnpm forwards the literal `--` into the script, and `mdx-deck` then treats it as a positional argument, silently ignoring `--out-dir`/`--out-file` and dumping every deck into `dist/` root. Write `pnpm run build:mdx <file> --out-dir <dir>`; flags forward fine without a separator.
- **Use `pnpm run --silent` when the output is redirected.** `build:oembed` writes to `dist/<slug>/oembed.json` via shell redirection, and without `--silent` pnpm's `> pkg@version script` banner lands inside the JSON.

Binaries that aren't wrapped in a script (`rimraf`, `cpx`) are invoked with `pnpm exec`.

## Architecture

### The slug convention holds everything together

A talk lives at `src/talks/<slug>/index.mdx`. The **directory name is the slug**, and `generate-slides.ts` derives it via `path.basename(path.dirname(mdxPath))`. That single string is used for:

- output directory `dist/<slug>/`
- screenshot `dist/<slug>.png` (also the og:image)
- `dist/<slug>/oembed.json`
- the `slug` prop passed to `<Meta>` inside the deck

If the `slug` prop in the MDX doesn't match the folder name, the OG image, oEmbed link, and canonical URL all point at nonexistent files. Renaming a talk means renaming the folder *and* the `slug` prop.

### Build pipeline (`scripts/generate-slides.ts`)

Walks `src/talks` recursively for `.mdx` files and, per deck:

1. `mdx-deck build` → `dist/<slug>/`. If it errors, it wipes that folder and retries with `--no-html` (some decks fail SSR/static HTML generation; the no-html fallback is the escape hatch).
2. `mdx-deck screenshot` → `<slug>.png` (the only `execSync` step — the rest are fire-and-forget `exec`).
3. `generate-oembed.ts <slug>` → `dist/<slug>/oembed.json`.
4. `generate-index.ts <slug>` emits a Bootstrap card `<div>`; the parent script splices it into `src/index.html` by replacing the `<!--REPLACE_ME-->` marker with `card + <!--REPLACE_ME-->`, keeping the marker so subsequent decks append. Result is written to `dist/index.html`.

Finally it copies `src/talks/assets/**` and `src/_redirects` into `dist/`.

Because steps 1, 3, and 4 use async `exec` inside a `forEach`, the build is racy by construction — the index HTML is rewritten from a shared `template` variable in overlapping callbacks. Treat intermittent missing cards or partial output as a known property of this pipeline, not necessarily a new bug. Observed on a clean build: all 8 cards make it into `index.html`, but only about half the decks end up with an `oembed.json`, because step 3 writes into a directory that step 1 is still recreating.

The hardcoded domain `https://slides.naturalclar.dev` appears in both `scripts/generate-oembed.ts` and `src/components/Meta.tsx`; change both together.

### Deck authoring conventions

Every deck starts with the same preamble (see `.scaffdog/template.md`): imports for `CodeSurfer`, `Head`, the shared `Meta` component, and `export { swiss as theme } from 'mdx-deck/themes'`. Slides are separated by `---`.

`<Head><Meta title slug description publishedAt /></Head>` is what produces all OG/Twitter/oEmbed metadata — a deck without it gets no thumbnail or social card.

Shared React components live in `src/components` (`Meta`, `Layout`, `Page`, `Avatar`) and are imported as `from '../../components'`.

Assets are shared across decks from `src/talks/assets/` and are referenced through webpack loader syntax, because `webpack.config.js` (picked up by mdx-deck) wires up `file-loader`, `raw-loader`, `css-loader`, and the Monaco plugin:

```jsx
<img src={require('file-loader!../assets/cat.jpg')} height="250" />

<CodeSurfer code={require('!raw-loader!./my-snippet.js')} lang="javascript" ... />
```

Code shown via CodeSurfer is kept as a real sibling file in the deck folder (e.g. `storybook-web-and-circleci/webpack.js`, `create-touchbar-app-with-js/touchbar.ts`) and pulled in with `raw-loader` rather than pasted into a fenced block.

`deck.mdx` at the repo root is a leftover standalone deck; it is outside `src/talks` and is not part of the build.

### Lint scope

`.eslintignore` contains `src/talks`, so deck MDX files and their code snippets are never linted. `pnpm run lint` effectively covers only `src/components`. `scripts/` is type-checked by `tsc` (strict) but not linted.

## Style

Prettier: no semicolons, single quotes, 2-space tabs, ES5 trailing commas. `react/prop-types` and `no-console` are off (the components are untyped-props JSX and the scripts print to stdout by design).

## Dependency situation

This project is pinned to an old stack: mdx-deck v1, ESLint 5, TypeScript 3.4, webpack 4. The dependencies still install and build under Node 22, but only with the OpenSSL workaround above. Upgrading any one of them is a breaking change to the deck syntax or build pipeline — don't casually bump versions while making unrelated changes.

Because pnpm does not hoist, everything the repo's own files import has to be declared in `package.json`. Several packages that used to resolve only transitively under yarn are now explicit dependencies for that reason: `react`, `react-dom`, `styled-components`, `@mdx-js/tag` and `babel-loader` (imported by the decks, `src/components`, and `webpack.config.js`), `react-syntax-highlighter` (imported by every deck's preamble), `rimraf` (shelled out to by `generate-slides.ts`), and `@types/node` (needed by `tsc` for `scripts/`). Their versions are matched to what mdx-deck v1 resolves — don't bump them independently of mdx-deck.
