# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A collection of Japanese-language tech talk slide decks written in MDX, built with **[ReMDX](https://github.com/nkzw-tech/remdx)** on vite. Each deck is compiled into its own static site, and a generated landing page (`dist/index.html`) links them all. Published at `https://slides.naturalclar.dev` (Netlify — see `src/_redirects`).

## Commands

**The package manager is pnpm** (pinned via `packageManager` in `package.json`). There is no `yarn.lock`; don't reintroduce one.

```bash
pnpm install              # also runs prepare (tsc)
pnpm run prepare          # tsc: compiles scripts/*.ts -> bin/*.js (bin/ is gitignored)
pnpm run build            # runs ./bin/generate-slides.js src/talks — full site build into dist/
pnpm run lint             # oxlint
pnpm run format:check     # prettier --check . (pnpm run format to fix)
pnpm run new              # scaffdog: scaffold src/talks/<slug>/, asking for slug, title and date
pnpm start <slug>         # dev server for one deck; omit the slug to list them
pnpm run clean            # rm -rf dist
```

`pnpm run build` executes the **compiled** script in `bin/`, so run `pnpm run prepare` first after any change to `scripts/`. `bin/` is not committed, so a fresh clone must install (or run prepare) before building.

The remaining `build:*` scripts (`build:screenshot`, `build:meta`, `build:oembed`, `build:index`, `build:assets`, `build:css`) are sub-steps invoked by `generate-slides.ts`, not meant to be run by hand except when debugging one stage.

There is no test suite. CI (`.github/workflows/ci.yml`) runs `pnpm run lint` → `pnpm run build` on Node 22 and uploads `dist/` as an artifact.

**Screenshots need a browser that isn't installed by `pnpm install`.** `build:screenshot` drives playwright, whose Chromium comes from `pnpm exec playwright install chromium` (CI uses `--with-deps` so the system libraries come too). Without that step the build fails at the screenshot stage with a missing-executable error.

**The Japanese font that screenshots render with is committed to the repo**, at `fonts/ipag.ttf`. Deck titles are almost all Japanese, and a machine without a Japanese font draws them as tofu boxes; Netlify builds the deployed site and takes no system packages, so the font travels with the repository instead. `generate-screenshot.ts` writes a fontconfig file that _includes_ `/etc/fonts/fonts.conf` and adds `fonts/` to it — replacing the system config instead would discard the distribution's family aliases and quietly change what Latin text renders with. This affects screenshots only; visitors' browsers render the decks with their own fonts.

### Calling scripts from `generate-slides.ts`

The orchestrator shells out to the other npm-scripts. One rule that is easy to get wrong:

- **Use `pnpm run --silent` when the output is redirected.** `build:oembed` writes to `dist/<slug>/oembed.json` via shell redirection, and without `--silent` pnpm's `> pkg@version script` banner lands inside the JSON.

Binaries that aren't wrapped in a script (`rimraf`, `cpx`) are invoked with `pnpm exec`.

## Architecture

### The slug convention holds everything together

A talk lives at `src/talks/<slug>/`, holding `slides.re.mdx` and `meta.json`. The **directory name is the slug**. That single string is used for:

- output directory `dist/<slug>/`
- screenshot `dist/<slug>.png` (also the og:image)
- `dist/<slug>/oembed.json`
- the `slug` field in the deck's `meta.json`

If `meta.json`'s `slug` doesn't match the folder name, the OG image, oEmbed link, and canonical URL all point at nonexistent files. Renaming a talk means renaming the folder _and_ the field — `generate-slides.ts` checks the two agree before it builds anything and fails the build if they don't, so this cannot slip through unnoticed.

### Build pipeline (`scripts/generate-slides.ts`)

Collects the directories under `src/talks` that contain `slides.re.mdx`, then runs these stages. Everything is `async`/`await` over promisified `exec`, and the ordering between stages is load-bearing:

1. Wipe `dist/`, then copy `src/talks/assets/**` and `src/_redirects` into it. **Assets go first** — decks reference shared images as plain `../assets/*` paths, which only resolve once `dist/assets` exists, and the screenshots in stage 3 would otherwise capture broken images.
2. `vite build` → `dist/<slug>/`, all decks in parallel. Each is a build of the shared shell in `src/deck`, pointed at that deck's slides by the `DECK` variable that `vite.config.ts` reads. A deck that fails is dropped from the remaining stages and makes the build exit non-zero.
3. `generate-screenshot.ts <slug...>` → `dist/<slug>.png`, one process for every deck. It serves `dist/` and drives one browser for the whole set rather than paying that cost per slide.
4. `generate-meta.ts <slug> <deck-dir>` writes the OG/Twitter/oEmbed tags and the `<title>` into `dist/<slug>/index.html`.
5. `generate-oembed.ts <slug> <deck-dir>` → `dist/<slug>/oembed.json`.
6. `generate-index.ts <slug> <deck-dir>` emits a card `<a>` per deck; the parent collects them, appends a card for each entry in `src/external-talks.json`, and writes `dist/index.html` once, substituting the `<!--REPLACE_ME-->` marker in `src/index.html`.

### Talks hosted somewhere else

`src/external-talks.json` lists talks that live outside this repository, as `{ title, url, thumbnail? }`. They appear on the landing page after the built decks, in file order, and **nothing is generated for them** — no deck build, no screenshot, no `oembed.json`, since this site does not serve them. `thumbnail` is optional; a card without one reserves the same space rather than collapsing the grid row. Both card kinds come from `renderCard` in `scripts/card.ts`, so an external entry cannot drift into looking like a different component.

The file is validated at the start of the build (`scripts/external-talks.ts`): malformed JSON, a missing title, or a `url` that isn't absolute `http(s)` fails the build rather than emitting a card that links to `undefined`. An empty array is the normal state when there is nothing external to list.

### The landing page's CSS is Tailwind, built by the pipeline

`build:css` compiles `src/index.css` into `dist/index.css`, which `src/index.html` links relatively. It runs in stage 1, but only because `dist/` is wiped there — the landing page markup is written last, and Tailwind reads the _sources_, not the output, so the ordering does not matter beyond the directory existing.

Tailwind only emits utilities it finds by scanning, and the card markup lives in a template literal inside `scripts/card.ts` rather than in any HTML. `src/index.css` names both that file and `src/index.html` with `@source` for that reason. **Adding a class in either place without it being scannable produces no error — the element just renders unstyled**, so never build a class name by concatenation.

This applies to the landing page only. The decks are styled by ReMDX's stylesheet and `src/deck/Themes.tsx`, and never see this one.

### Decks render in the browser

A deck's built `index.html` is a shell — vite emits the slides as JavaScript, and nothing is pre-rendered. Metadata therefore cannot come from the deck itself, which is why `generate-meta.ts` writes the tags and the `<title>` in afterwards, and why `meta.json` exists separately from the slides.

`src/deck` holds the shell every deck shares: `index.html`, `main.tsx`, and `Themes.tsx`. A deck that exports no theme renders black text on ReMDX's black backdrop, so every `slides.re.mdx` re-exports the shared one.

**Module-level `import` and `export` lines in a `.re.mdx` file must end with a semicolon.** The plugin lifts them out with `/^(?:import|export)[^;]+;/`; without the semicolon the line is left in the slide body, and whatever it exported silently never takes effect.

### Deck authoring conventions

Every deck starts with the same preamble (see `.scaffdog/template.md`): `export { Themes } from '../../deck/Themes.tsx';`. Slides are separated by `---`, and a slide may open with a `--` block of per-slide data (`image:`, `theme:`).

**Don't use `<CodeSurfer>` in a new deck.** It is what breaks static HTML generation, and a deck that falls back to `--no-html` ships a bare shell — no title, no OG tags, no slide content for anything that doesn't run JavaScript. Show code in a plain fenced block instead; the scaffold includes one. This is a deliberate convention rather than a limitation of the syntax: the four existing decks that use `<CodeSurfer>` are in that broken state and are left as they are, while a deck scaffolded today renders its metadata and its slides into the HTML properly.

`meta.json` is what produces all OG/Twitter/oEmbed metadata — a deck without it fails the build.

Shared React components live in `src/components` (`Layout`, `Page`, `Avatar`) and are imported as `from '../../components'`.

Assets are shared across decks from `src/talks/assets/` and referenced as plain relative paths:

```jsx
<img src="../assets/cat.jpg" height="250" />
```

That resolves against the deck's own URL (`/<slug>/`), which is why `dist/assets` has to exist before the screenshots run. Code is shown in fenced blocks — the plugin highlights them with shiki, and `\`\`\`js {5-7}` highlights a line range.

### Lint scope

`pnpm run lint` is oxlint, configured by `.oxlintrc.json`. It runs the `correctness` category over `src/` and `scripts/`; `src/talks` is in `ignorePatterns`, so deck MDX files and their code snippets are never linted. `scripts/` is additionally type-checked by `tsc` (strict).

**oxlint does not format.** ESLint used to report formatting through `eslint-plugin-prettier`, so a single `lint` run covered both. Formatting is now its own command — `pnpm run format:check`, with `pnpm run format` to fix — and CI runs it as a separate step. `.prettierignore` excludes `src/talks` too: the decks have never been formatted, and reflowing MDX is an easy way to break it.

## Style

Prettier: no semicolons, single quotes, 2-space tabs, ES5 trailing commas. `no-console` is off — the scripts print to stdout by design.

## Dependency situation

The stack is current: ReMDX 20, React 19, vite, TypeScript 7, oxlint, prettier 3, Tailwind 4.

Because pnpm does not hoist, everything the repo's own files import has to be declared in `package.json` — `rimraf` and `cpx2` are shelled out to by `generate-slides.ts`, and `@types/node` is needed by `tsc` for `scripts/`.

`pnpm.overrides` in `package.json` pins three transitive packages (`path-parse`, `hosted-git-info@2`, `ini@1`) past their advisories. They are pulled in deep in the tree by build tooling, so no direct dependency bump reaches them; the overrides are the only lever. Remove an entry once nothing resolves to the vulnerable range anymore — `pnpm why <pkg>` says who is still asking for it.

`.github/dependabot.yml` declares the `npm` ecosystem — that is the name Dependabot uses for the whole npm registry family, there is no separate `pnpm` value, and it reads `pnpm-lock.yaml` from it. It was added after the 21 PRs Dependabot had opened from the repository's security settings alone all turned out to edit the deleted `yarn.lock`, which made every one of them unmergeable. Minor and patch bumps are grouped into a single weekly PR; majors come one at a time.
