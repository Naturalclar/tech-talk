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
pnpm run new              # scaffdog: scaffold src/talks/<slug>/index.mdx, asking for slug, title and date
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

**Screenshots need a browser that isn't installed by `pnpm install`.** `build:screenshot` drives playwright, whose Chromium comes from `pnpm exec playwright install chromium` (CI uses `--with-deps` so the system libraries come too). Without that step the build fails at the screenshot stage with a missing-executable error. `mdx-deck` still drags puppeteer in as a transitive dependency, but its 2019 Chromium is deliberately never downloaded — pnpm blocks the postinstall and nothing allows it. The one casualty is `pnpm run pdf` (`mdx-deck pdf`), which needs that Chromium; run `pnpm rebuild puppeteer` first if you ever want it.

**The Japanese font that screenshots render with is committed to the repo**, at `fonts/ipag.ttf`. Deck titles are almost all Japanese, and a machine without a Japanese font draws them as tofu boxes; Netlify builds the deployed site and takes no system packages, so the font travels with the repository instead. `generate-screenshot.ts` writes a fontconfig file that *includes* `/etc/fonts/fonts.conf` and adds `fonts/` to it — replacing the system config instead would discard the distribution's family aliases and quietly change what Latin text renders with. This affects screenshots only; visitors' browsers render the decks with their own fonts.

### Calling scripts from `generate-slides.ts`

The orchestrator shells out to the other npm-scripts. Two rules that are easy to get wrong:

- **Never insert `--` before the arguments.** pnpm forwards the literal `--` into the script, and `mdx-deck` then treats it as a positional argument, silently ignoring `--out-dir` and dumping every deck into `dist/` root. Write `pnpm run build:mdx <file> --out-dir <dir>`; flags forward fine without a separator.
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

Walks `src/talks` recursively for `.mdx` files, then runs these stages. Everything is `async`/`await` over promisified `exec`, and the ordering between stages is load-bearing:

1. Wipe `dist/`, then copy `src/talks/assets/**` and `src/_redirects` into it. **Assets go first** — decks reference shared images as plain `../assets/*` paths, which only resolve once `dist/assets` exists, and the screenshots in stage 3 would otherwise capture broken images.
2. `mdx-deck build` → `dist/<slug>/`, all decks in parallel. If a deck errors, `buildDeck` wipes that folder and retries with `--no-html` (several decks fail static HTML generation; the no-html fallback is the escape hatch). A deck whose fallback also fails is dropped from the remaining stages and makes the build exit non-zero.
3. `generate-screenshot.ts <slug...>` → `dist/<slug>.png`, one process for every deck. It serves `dist/` and drives one browser for the whole set rather than paying that cost per slide.
4. `generate-meta.ts <slug> <mdx>` injects OG/Twitter/oEmbed tags into `dist/<slug>/index.html`, but only when the markup has none — see below.
5. `generate-oembed.ts <slug> <mdx>` → `dist/<slug>/oembed.json`.
6. `generate-index.ts <slug>` emits a Bootstrap card `<div>` per deck; the parent collects them and writes `dist/index.html` once, substituting the `<!--REPLACE_ME-->` marker in `src/index.html`.

**Stages 3–6 must not start before stage 2 has settled for that deck.** The `--no-html` retry deletes `dist/<slug>/` wholesale, so anything written there earlier goes with it — that is what used to leave half the decks without an `oembed.json`.

### `<CodeSurfer>` decks cannot be server rendered

Any deck that renders a `<CodeSurfer>` slide fails `mdx-deck build` and falls back to `--no-html`. The component reads mdx-deck's deck context, which is null under `renderToString`; guarding one access just moves the crash to the next one, so treat this as a property of `mdx-deck-code-surfer` rather than something to fix in the deck. Four of the eight decks are in this state, and `create-your-own-slides-page` additionally trips over Node trying to import Monaco's `.css`.

The consequence is that their static markup contains no `<Head>` output at all — no title, no OG tags, no oEmbed link. `generate-meta.ts` exists for that reason: it parses the `<Meta />` props straight out of the MDX (`scripts/deck-meta.ts`) and writes the tags into the built HTML, so metadata does not depend on SSR working. It skips decks whose markup already has `og:image`, which is how server rendered decks avoid getting a duplicate set.

That parser is also what gives `oembed.json` its title. Because it reads what the deck declares, a deck whose `<Meta title>` is just its slug gets a slug for a title — the fix for that is in the decks, not here.

The published origin lives in `scripts/site.ts` for everything under `scripts/`, but `src/components/Meta.tsx` hardcodes it separately for the client-side render; change both together.

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
