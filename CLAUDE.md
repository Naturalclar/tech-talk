# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A collection of Japanese-language tech talk slide decks written in MDX, built with **[ReMDX](https://github.com/nkzw-tech/remdx)** on vite. Each deck is compiled into its own static site, and a generated landing page (`dist/index.html`) links them all. Published at `https://slides.naturalclar.dev`.

**Hosted on GitHub Pages**, built and deployed by `.github/workflows/ci.yml` on every push to `master`. It was on Netlify until #84; nothing in the repository references Netlify any more, and a `_redirects` file would do nothing.

There are no deploy previews. A pull request uploads `dist/` as the `slides` artifact instead — download it and open `dist/index.html` to look at a change.

## Commands

**The package manager is pnpm** (pinned via `packageManager` in `package.json`). There is no `yarn.lock`; don't reintroduce one.

```bash
pnpm install
pnpm run build            # runs scripts/generate-slides.ts src/talks — full site build into dist/
pnpm run lint             # oxlint
pnpm run typecheck        # tsc (noEmit) over scripts/
pnpm run format:check     # prettier --check . (pnpm run format to fix)
pnpm run new              # scaffdog: scaffold src/talks/<slug>/, asking for slug, title and date
pnpm start <slug>         # dev server for one deck; omit the slug to list them
pnpm run clean            # rm -rf dist
```

The remaining `build:*` scripts (`build:screenshot`, `build:meta`, `build:oembed`, `build:index`, `build:assets`, `build:css`) are sub-steps invoked by `generate-slides.ts`, not meant to be run by hand except when debugging one stage.

`pnpm run test` covers one module, `scripts/og-image.ts` — the only code here that depends on servers nobody in this repository controls. Everything else is checked by building it. CI (`.github/workflows/ci.yml`) runs `pnpm run lint` → `pnpm run typecheck` → `pnpm run test` → `pnpm run format:check` → `pnpm run build` on Node 22 and uploads `dist/` as an artifact. On `master` it then packages that same `dist/` and publishes it with `actions/deploy-pages` — one build, deployed, never rebuilt for the deploy.

### `scripts/` is TypeScript that node runs directly

`node ./scripts/generate-slides.ts` — no build step, no `bin/`. Node ≥ 22.18 strips the types itself, which is what `engines` in `package.json` pins and why the workflow asks for Node 22.

Two consequences follow from that, and both are easy to trip over:

- **Nothing type-checks during a build.** Node erases the annotations without reading them, so a type error is invisible until `pnpm run typecheck` runs. That is why CI has its own step for it; `tsconfig.json` is `noEmit` and exists only for that command and the editor.
- **The package is ESM** (`"type": "module"`). `__dirname` does not exist — use `import.meta.dirname` — and **relative imports need the `.ts` extension** (`from './card.ts'`), which is what `allowImportingTsExtensions` is for. Anything node cannot erase (`enum`, `namespace`, parameter properties) fails the build instead of surprising you at runtime, via `erasableSyntaxOnly`.

`"type": "module"` reaches past `scripts/` — a `.js` config file anywhere in the repo is now ESM too, which is why `.prettierrc.js` and `.scaffdog/config.js` are `export default` rather than `module.exports`.

**Do not commit a compiled `vite.config.js`.** Vite resolves `vite.config.js` before `vite.config.ts`, so a stale compiled copy silently wins and edits to the `.ts` source do nothing. One was committed by accident during the ReMDX migration and went unnoticed until the ESM switch broke it.

**Screenshots need a browser that isn't installed by `pnpm install`.** `build:screenshot` drives playwright, whose Chromium comes from `pnpm exec playwright install chromium` (CI uses `--with-deps` so the system libraries come too). Without that step the build fails at the screenshot stage with a missing-executable error.

**The Japanese font that screenshots render with is committed to the repo**, at `fonts/ipag.ttf`. Deck titles are almost all Japanese, and a machine without a Japanese font draws them as tofu boxes; the deployed site is built on a machine nobody here provisions, so the font travels with the repository instead. `generate-screenshot.ts` writes a fontconfig file that _includes_ `/etc/fonts/fonts.conf` and adds `fonts/` to it — replacing the system config instead would discard the distribution's family aliases and quietly change what Latin text renders with. This affects screenshots only; visitors' browsers render the decks with their own fonts.

**Adding the directory is not enough to make the bundled font the one that gets used**, which is the whole point of carrying it. A Chinese or Korean font covers most of the Japanese a deck uses, so a build machine that has one wins the match: Chinese glyph shapes, and the kana iteration marks `ゝ` and `ゞ` drawn as nothing, because those fonts map them without an outline. That shipped — 「すゝめ」 came out as 「す め」 on the landing page's own `og:image`. The config therefore rejects the families that would shadow it, listed in `SHADOWING_CJK_FONTS`. It is a list of names, so a machine with a CJK font that is not on it falls back to the old behaviour; add the name when that happens. Preferring IPAGothic outright instead was tried and is wrong — fontconfig then hands it the Latin text too, and every screenshot's English turns monospace.

### Calling scripts from `generate-slides.ts`

The orchestrator shells out to the other npm-scripts. One rule that is easy to get wrong:

- **Use `pnpm run --silent` when the output is redirected.** `build:oembed` writes to `dist/<slug>/oembed.json` via shell redirection, and without `--silent` pnpm's `> pkg@version script` banner lands inside the JSON.

Binaries that aren't wrapped in a script (`rimraf`, `cpx`) are invoked with `pnpm exec`.

### HTML is assembled by hand

There is no template engine. Cards and meta tags are string literals in `scripts/`, so anything interpolated into them goes through `escapeAttr` or `escapeText` from `scripts/escape.ts`. Three modules need them — `card.ts`, `generate-meta.ts`, `generate-slides.ts` — and two of them used to carry their own copy.

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

1. Wipe `dist/`, then copy `src/talks/assets/**` into it. **Assets go first** — decks reference shared images as plain `../assets/*` paths, which only resolve once `dist/assets` exists, and the screenshots in stage 3 would otherwise capture broken images.
2. `vite build` → `dist/<slug>/`, decks in parallel. Each is a build of the shared shell in `src/deck`, pointed at that deck's slides by the `DECK` variable that `vite.config.ts` reads. A deck that fails is dropped from the remaining stages and makes the build exit non-zero.

   **Bounded parallel, not all at once.** Every per-deck stage goes through `mapWithLimit`, which runs `CONCURRENCY` — the core count, floored at 2 and capped at 8 — rather than `Promise.all` over the whole list. `Promise.all` started all thirty together, and under that load the build stopped being reproducible: shiki's _dark_ theme fell back to a flat `#919191` for whole code blocks, the light theme always being fine, so which decks lost their syntax colours changed from run to run. Three runs at thirty produced three different sites; three runs bounded produce one, and `dist` now comes out byte-identical across builds. It was not buying speed either — thirty at once took 28s against 21s bounded, on the four cores a GitHub runner also has. The cap matters as much as the floor: a machine with more cores than there are decks would otherwise start all of them at once again.

   **The base is relative (`./`), not `/<slug>/`.** A deck's assets only ever sit beside it, and an absolute base pins the whole site to the root of a domain — which is what makes it servable from `<user>.github.io/tech-talk/` as well as from `slides.naturalclar.dev/`. Do not "fix" this back to an absolute path.

3. `generate-screenshot.ts <slug...>` → `dist/<slug>.png`, one process for every deck. It serves `dist/` and drives one browser for the whole set rather than paying that cost per slide.
4. `generate-meta.ts <slug> <deck-dir>` writes the OG/Twitter/oEmbed tags and the `<title>` into `dist/<slug>/index.html`.
5. `generate-oembed.ts <slug> <deck-dir>` → `dist/<slug>/oembed.json`.
6. `generate-index.ts <slug> <deck-dir>` emits a card `<a>` per deck; the parent collects them, renders a card for each entry in `src/external-talks.json` — fetching each of those pages' `og:image` for its thumbnail — sorts the two kinds together by `publishedAt`, and writes `dist/index.html` once, substituting three markers in `src/index.html`: `<!--REPLACE_STYLESHEET-->` with a link to the content-hashed CSS, `<!--REPLACE_META-->` with the landing page's own `<head>` tags, and `<!--REPLACE_ME-->` with the cards. **This stage reaches the network**, which is the only one that does.
7. `scripts/sitemap.ts` → `dist/sitemap.xml` and `dist/robots.txt`, written straight from the deck list. **Talks hosted elsewhere are deliberately left out** — a sitemap lists this site's own pages, and another site's URLs in it are at best ignored. `lastmod` is the talk's `publishedAt`, not the build time: it is the closest thing to when the page's content changed, and it does not move on every deploy the way a build timestamp would.
8. `generate-screenshot.ts .` → `dist/index.png`, the landing page's `og:image`. The argument is `.` rather than `--index` because **pnpm eats leading-dash arguments on their way to a script**; the same trap once sent every deck's output into the root of `dist/`. This is a second browser launch, which is the price of the image being a screenshot of a page that is only written in stage 6. A failure here is logged and fails the build, but the page itself is already complete.

The landing page's title, description and image come from `scripts/site.ts` — `SITE_TITLE`, `SITE_DESCRIPTION`, `SITE_IMAGE` — beside the `SITE_URL` everything else already uses. A deck's metadata comes from its own `meta.json`; the page that lists them has no `meta.json`, so it lives there.

### `publishedAt` orders the landing page

Every card shows the date its talk was given, so the listing is sorted by it — newest first, both kinds interleaved. Where a talk happens to be hosted is not something a visitor orders by, and a listing that shows dates in any other order reads as unsorted.

The field is read from two files, a deck's `meta.json` and an entry in `src/external-talks.json`, and `scripts/published-at.ts` is the only thing that parses it. It insists on `YYYY-MM-DD` and rejects a date that does not exist — `2019-02-31` parses fine and silently becomes March 3 otherwise. That check used to be missing because the value only fed an OG tag; now it also decides where a card lands, where a wrong value sorts wrong without complaining.

A talk with no date sorts last rather than being dropped, and ties keep collection order, so the page does not shuffle between builds.

### Talks hosted somewhere else

`src/external-talks.json` lists talks that live outside this repository, as `{ title, url, thumbnail?, publishedAt? }`. They are sorted in among the built decks by date, and **nothing is built for them** — no deck build, no `oembed.json`, since this site does not serve them. Both card kinds come from `renderCard` in `scripts/card.ts`, so an external entry cannot drift into looking like a different component.

The file is validated at the start of the build (`scripts/external-talks.ts`): malformed JSON, a missing title, or a `url` that isn't absolute `http(s)` fails the build rather than emitting a card that links to `undefined`. An empty array is the normal state when there is nothing external to list.

**An entry comes out when the talk moves in.** `code-surfer-v3`, `you-may-not-need-thunk` and `visual-regression-test-with-react-native` were listed here as `*.vercel.app` links until the decks themselves were migrated; leaving them would have put two cards on the page for one talk. Their dates were kept as the entries had them, so the cards did not move.

#### Thumbnails come from the linked page's `og:image`

There is no screenshot in `dist/` for a talk this site does not serve, so `scripts/og-image.ts` fetches the page during stage 6 and reads the `og:image` it already declares for every other link unfurler (`twitter:image` is the fallback, relative values resolve against the page, and redirects resolve against where they landed). An explicit `thumbnail` in the JSON wins, and skips the fetch — that is how to override a page whose `og:image` is wrong or missing.

**A tag that exists is not an image that loads**, so the address is checked with a `HEAD` before it is used (a `405` is retried as a cancelled `GET`, since some hosts refuse the method). Decks bake an _absolute_ `og:image` into their HTML at build time, so one that later moved host still advertises the address it had then — all three talks listed today point at `now.sh` from pages now served off `vercel.app`. When the advertised image does not load, the filename is tried again where the deck actually lives now — **beside the page first, then at the root of the host** — because the image is almost always an asset of the deck itself. The directory comes first because it is what survives a move into a sub-path; the root is what a deck with a subdomain to itself looks like, which is the shape of the older talks. If both fail, the card falls back to the placeholder rather than shipping a broken `<img>`.

**Every failure has to end in a card, never a failed deploy.** These are hosts nobody here controls, so a timeout, a 404, a moved page or a missing tag all return `null` and the card falls back to the same reserved-space placeholder as before, with the reason on stdout as `[og] <url>: …`. Nothing about this is allowed to throw.

This is the one part of the build with a test, `scripts/og-image.test.ts`, run by `pnpm run test` — precisely because it depends on other people's servers. It serves its own fixtures on localhost and never leaves it, and it covers the failure paths as deliberately as the parsing.

### The landing page's CSS is Tailwind, built by the pipeline

`build:css` compiles `src/index.css` into `dist/index.css`, which the build then renames to `dist/index-<hash>.css` and links from the page. The decks' own assets are content-hashed by vite; this one was not, so a returning visitor kept the previous stylesheet until their cache expired — new markup styled by an old sheet. `dist/index.html` cannot carry a hash of its own, and how long Pages lets it be cached is not ours to set. It runs in stage 1, but only because `dist/` is wiped there — the landing page markup is written last, and Tailwind reads the _sources_, not the output, so the ordering does not matter beyond the directory existing.

Tailwind only emits utilities it finds by scanning, and the card markup lives in a template literal inside `scripts/card.ts` rather than in any HTML. `src/index.css` names both that file and `src/index.html` with `@source` for that reason. **Adding a class in either place without it being scannable produces no error — the element just renders unstyled**, so never build a class name by concatenation.

This applies to the landing page only. The decks are styled by ReMDX's stylesheet and `src/deck/Themes.tsx`, and never see this one.

### Decks render in the browser

A deck's built `index.html` is a shell — vite emits the slides as JavaScript, and nothing is pre-rendered. Metadata therefore cannot come from the deck itself, which is why `generate-meta.ts` writes the tags and the `<title>` in afterwards, and why `meta.json` exists separately from the slides.

`src/deck` holds the shell every deck shares: `index.html`, `main.tsx`, and `Themes.tsx`. A deck that exports no theme renders black text on ReMDX's black backdrop, so every `slides.re.mdx` re-exports the shared one.

**Module-level `import` and `export` lines in a `.re.mdx` file must end with a semicolon.** The plugin lifts them out with `/^(?:import|export)[^;]+;/`; without the semicolon the line is left in the slide body, and whatever it exported silently never takes effect.

### Most of the decks came from `Naturalclar/talks`

Twenty-two of the thirty decks here were presented between 2019 and 2022 out of `Naturalclar/talks`, a lerna monorepo of mdx-deck decks deployed one Vercel project each. They were converted in one pass; the rules are worth knowing, because they are what a reader is looking at:

- **Speaker notes are kept, as `{/* … */}`.** `<Notes>` was mdx-deck's presenter view and ReMDX has nothing like it, but the script the talk was given from is worth more in the repository than deleted. They render as nothing. A note is a JSX expression, so `{`, `}` and `*/` inside one are replaced with lookalikes rather than left to end the comment early.
- **Each CodeSurfer step became its own slide**, except in the decks since rewritten around `<CodeSteps>` — see below. The steps are all here, in order, with the focus range handed to shiki instead (` ```ts {2-20} `), and the step's `subtitle` as an `####` heading above it.
- **`<Appear>` is unwrapped.** mdx-deck revealed its children one at a time; they all show at once now.
- **`require('file-loader!./x.png')` became `../assets/x.png`.** Same-named images across the packages were byte-identical, so they share one copy, and `logo-js.png`/`logo-ts.png` were dropped in favour of the identical `logo-javascript.png`/`logo-typescript.png`.

**`publishedAt` for these is close but not authoritative.** Each deck carried a `<Meta publishedAt>` written when it was scaffolded, a day or so before the talk, as a UTC timestamp — read in Asia/Tokyo it moves eight of them onto the following day, which is what is recorded. Two were cross-checked against the commit that added the deck and taken from that instead: `react-native-rearchitecture`, whose `<Meta>` was copy-pasted from `future-of-react-native` and still carried its date, and `release-automation`. The connpass event pages would settle all of them exactly and are linked from the first slide of most decks.

`storybook-with-react-native` was **not** brought over: it is the same talk as `storybook-web-and-circleci`, which has been here since the start — RNStartup #2, 2019-02-21, the same slides down to the section order. The version in `talks` is a different revision (it has a section on `klank`, and lacks the `artifact-report.png` screenshot), not a different talk.

### A slide's links sit above whatever is behind them

A deck that wants a watermark parks an image behind the text with `position: absolute` and a low opacity — `react-native-rearchitecture-2021` opens with the Matsuri logo at 900px and `opacity: 0.2`. Taking an element out of the flow also takes it out of paint order: a positioned element paints over its in-flow siblings whatever the source order says. The logo therefore lay on top of the link beneath it and swallowed every click, and nothing looked wrong, because the thing on top was almost invisible.

`deck.css` gives `#root a` `position: relative; z-index: 1` so the links win that contest. Raising the links rather than dropping the image out of hit-testing is what makes it hold for slides nobody has written yet — whatever a deck parks behind its text, the text stays reachable. `position: relative` with no offsets moves nothing, and a deck that really does want something over a link can still say so, since an inline style outranks the sheet.

### A named line range dims the rest of the block

ReMDX's stylesheet points at a highlighted range by setting it bold on a pale blue band and leaving the rest of the file at full strength; CodeSurfer did the opposite, taking the rest back so the eye lands on the range. `deck.css` adds the dimming — `opacity: 0.35`, no blur, since these render at `0.5em` and even `blur(1px)` costs the surrounding lines the legibility that is the reason they are still on the slide.

**The `:has()` in that rule is load-bearing.** shiki marks the lines it was told to highlight and nothing else, so there is no flag saying "this block names a range" — without the guard, `.line:not(.highlighted)` is every line of every plain code block and they all render dimmed. A browser too old for `:has()` gets the undimmed behaviour, which is what the decks looked like before.

### `<CodeSteps>` is what CodeSurfer did

`src/components/CodeSteps.tsx` steps through versions of the same code without leaving the slide, so the code holds still and only the highlight moves. A deck wraps its steps in it and writes each one the way it would write a single code slide; **a step ends at each code block**, so the heading or the prose above one belongs to it, and the fenced blocks are untouched — shiki still highlights them from the same ` ```lang {a-b} `. `react-redux-new-api` is the deck rewritten around it so far (35 slides became 18); the rest still have a slide per step, and converting one is a matter of collapsing those slides back into one `<CodeSteps>`.

Three things about it are less obvious than they look, and all three were bugs first:

- **ReMDX's own `stepIndex` is of no use.** The reducer has `STEP_FORWARD`, but `Slide` turns any pending step past the first into a slide change, so a slide can never hold more than one step. The stepper therefore takes the key itself, from a **capture-phase** `keydown` on `document` — ReMDX binds `left`/`right` through Mousetrap on the same element in the bubble phase, so capture runs first and `stopPropagation` keeps the deck from advancing underneath it. When there is no step left in that direction the key is left alone and ReMDX changes the slide as usual.
- **Being on screen is not the same as being the live slide.** ReMDX animates the slide it is leaving out of view and leaves it displayed for the better part of a second, so `offsetParent` says two slides are visible for that whole window and the one being left goes on claiming keys — a press vanishing every time the presenter walks out of a stepper. What decides it is the `slideIndex` ReMDX puts in the query string, compared against the stepper's own position among the slide wrappers.
- **A stepper does not survive being left.** ReMDX unmounts a slide once it has animated out, so component state is gone by the time the presenter comes back and there is nothing to restore a step from. Which end to open on is instead taken from a module-level record of the direction the last arrow key moved the deck: entered from the right, a stepper opens on its last step.

### Deck authoring conventions

Every deck starts with the same preamble (see `.scaffdog/template.md`): `export { Themes } from '../../deck/Themes.tsx';`. Slides are separated by `---`, and a slide may open with a `--` block of per-slide data (`image:`, `theme:`).

`<CodeSurfer>` was an mdx-deck component and has no equivalent here; the ReMDX migration removed the last use of it. The one mention left in a deck is a heading in `create-your-own-slides-page` that talks _about_ the library, not a component. Code goes in a fenced block — see below.

**MDX 3 is stricter than the MDX 1 these decks were written against**, in two ways that bite when a deck is brought over from elsewhere:

- **There are no HTML comments.** `<!-- … -->` is a parse error (`Unexpected character !`), not a comment. Use `{/* … */}`.
- **An unknown capitalised tag is a runtime error, not markup.** MDX 1 left `<Note>` — a typo for mdx-deck's `<Notes>` — on the page; MDX 3 compiles it to a component reference and the deck renders nothing at all, with `Expected component 'Note' to be defined` on the console. The build does not catch this; only opening the deck does.

Because ReMDX draws every slide into the DOM at once, opening a deck and looking for `pageerror` and for `img.naturalWidth === 0` checks the whole deck, not just the slide on screen. **`generate-screenshot.ts` does both**, on the page it already has open: a deck that names an undefined component or points at an image the site does not have fails the build there. Nothing earlier has an opinion about either — vite never resolves `../assets/*`, because those are plain strings in the markup, not imports.

The `pageerror` check is **raced against** the wait for `#root`, not read after it. A deck that throws while rendering never paints, so the wait would spend its full thirty seconds first and report its own timeout instead of the error that caused it — the migration's `<Note>` typo surfaced that way. Raced, it fails in about three seconds and names the component.

Neither check runs for the landing page. Its thumbnails for talks hosted elsewhere come from servers nobody here controls, and the rule there is that every failure ends in a card and never a failed deploy; `og-image.ts` already checks those addresses load.

`meta.json` is what produces all OG/Twitter/oEmbed metadata — a deck without it fails the build.

Shared React components live in `src/components` and are imported as `from '../../components'`: `Layout`, `Page`, `Avatar`, `CodeSteps`, and — added with the talks migration — `Profile`, `Logo`, `Title`, `Header`, `Center`, `AlignLeft`, `Link`.

`Profile` is one component shared by decks given years apart, so they all name the same employer; it was edited in place in the repository they came from, and that is carried over rather than guessed at per deck. A deck scaffolded by `pnpm run new` starts with `<Profile />` rather than its own copy of the text, which is what stopped the two from drifting — the template still said CureApp long after the component said stand.fm. Its rules were `white` there, where the decks ran on code-surfer's dark theme — here they follow `currentColor`, because these render on the shared light one.

**The affiliation is a prop** — `<Profile company="Engineer at CureApp" />` — for the deck that wants to say what was true when the talk was given. It defaults to the current one, so all thirty decks render exactly as before and the default stays the single place to edit when it changes again; **do not turn the default into a per-deck copy of the string**, which is the drift the shared component exists to prevent. Nothing else about the component is configurable: the name and the links are the same person in every deck, and the employer was the only field that ever went stale.

`Layout` wraps every slide of `review-efficiently-with-artifact`, and is used by nothing else. **It measured its heights in `vw`** — `height: 100vw` on the container, `20vw`/`30vw`/`20vw` for a header band, the body and a footer band — which is a width, so on a 1280x720 slide the container came out 1024px tall and the content ran to 1005px in a viewport that does not scroll. All fifteen slides lost their bottom third, the title slide's link was cut in half at the edge, and that slide is the deck's `og:image`. `vh` is almost certainly what was meant; `%` against the slide is what it uses now.

**The two bands are gone rather than resized, and should stay gone.** They were empty divs painted `aquamarine` — a named colour with no relation to the shared theme, and nothing was ever rendered inside them. At 20% each they took 288px off a 720px slide, and this deck's slides carry a heading, a rule and a screenshot up to 400px tall, which does not fit in what is left. Restoring them is two divs if they turn out to have been deliberate.

Assets are shared across decks from `src/talks/assets/` and referenced as plain relative paths:

```jsx
<img src="../assets/cat.jpg" height="250" />
```

That resolves against the deck's own URL (`/<slug>/`), which is why `dist/assets` has to exist before the screenshots run. Code is shown in fenced blocks — the plugin highlights them with shiki, and `\`\`\`js {5-7}` highlights a line range.

**The dev server puts a deck at `/`, not `/<slug>/`,** so the same `../assets/*` reference normalises to `/assets/*` and points a directory above the deck. `vite.config.ts` therefore carries a `serveSharedAssets` plugin that answers `/assets/` out of `src/talks/assets` — dev only, since the built site already has the copy `build:assets` makes. Without it every deck's images were invisible for the whole time a deck was being written, and silently: the request fell through to the SPA fallback and came back `200 text/html`, so there was no 404 and no console error, only a picture that never drew. It is a middleware rather than `publicDir` because `publicDir` serves a directory's _contents_ at the root — it would have to be `src/talks`, which would put every deck's source on the dev server and copy all 14MB of it into every deck's build output.

**The whole directory is copied into `dist/`, referenced or not**, so a file nothing points at still ships. Three were: they were 525KB of the 1.9MB the folder held. `grep -rl <name> src/talks` before assuming a file is in use, and delete it when it isn't.

The folder is 14MB now — the talks migration brought 69 files and 11.6MB of it, `mac-catalyst.png` (1.8MB), `react-devtools.gif` (1.8MB) and `catalyst-support.png` (1.2MB) being a third of that on their own. Every one of them is referenced by a deck; the note above is about files nothing points at, which is a different problem from files that are simply large.

Sizes are otherwise close to what they need to be — most of these images render at more than half their pixel width, so there is nothing to reclaim by resizing. The exception was a 2762px-wide screenshot shown at 742px. **Re-encoding a PNG through a canvas usually makes it bigger**, not smaller: two of the three tried that way grew, because downscaling anti-aliases a palette image into a full-colour one. Shrinking the rest needs a real optimiser (`pngquant`, `sharp`), which is a dependency this repository does not have.

### Lint scope

`pnpm run lint` is oxlint, configured by `.oxlintrc.json`. It runs the `correctness` category over `src/` and `scripts/`; `src/talks` is in `ignorePatterns`, so deck MDX files and their code snippets are never linted. `scripts/` is additionally type-checked by `tsc` (strict).

**oxlint does not format.** ESLint used to report formatting through `eslint-plugin-prettier`, so a single `lint` run covered both. Formatting is now its own command — `pnpm run format:check`, with `pnpm run format` to fix — and CI runs it as a separate step. `.prettierignore` excludes `src/talks` too: the decks have never been formatted, and reflowing MDX is an easy way to break it.

## Style

Prettier: no semicolons, single quotes, 2-space tabs, ES5 trailing commas. `no-console` is off — the scripts print to stdout by design.

## Dependency situation

The stack is current: ReMDX 20, React 19, vite, TypeScript 7, oxlint, prettier 3, Tailwind 4.

TypeScript 7 is the native (Go) compiler — `node_modules/typescript/bin/tsc` is a thin wrapper that executes a statically linked binary from `@typescript/typescript-<platform>-<arch>`. `skipLibCheck` is on because playwright-core's `protocol.d.ts` uses the old `declare module Protocol` spelling, which TypeScript 7 rejects as a grammar error (TS1540).

Because pnpm does not hoist, everything the repo's own files import has to be declared in `package.json` — `rimraf` and `cpx2` are shelled out to by `generate-slides.ts`, and `@types/node` is needed by `tsc` for `scripts/`.

`pnpm.overrides` in `package.json` pins two transitive packages past their advisories: `ini@1` (scaffdog → update-notifier → rc) and `minimist` (both cpx2 and that same scaffdog chain). They are pulled in deep in the tree, so no direct dependency bump reaches them; the overrides are the only lever. Remove an entry once nothing resolves to the vulnerable range anymore — `pnpm why <pkg>` says who is still asking for it, and `path-parse` and `hosted-git-info@2` were dropped that way when the package that wanted them left.

**Check whether a dependency is used before assuming it is.** `npm-run-all` sat in `devDependencies` unreferenced by any script, and was on its own responsible for 13 of the 21 advisories `pnpm audit` reported — including a critical one — plus the entire subtree those two removed overrides existed for.

What `pnpm audit` still reports comes through `@nkzw/vite-plugin-remdx`'s MDX toolchain (`kind-of`, `js-yaml`, `debug`). The plugin is current, so there is nothing to bump; it runs at build time over this repository's own MDX.

`.github/dependabot.yml` declares the `npm` ecosystem — that is the name Dependabot uses for the whole npm registry family, there is no separate `pnpm` value, and it reads `pnpm-lock.yaml` from it. It was added after the 21 PRs Dependabot had opened from the repository's security settings alone all turned out to edit the deleted `yarn.lock`, which made every one of them unmergeable. Minor and patch bumps are grouped into a single weekly PR; majors come one at a time.
