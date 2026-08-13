# fonts

`ipag.ttf` is IPAGothic (IPAゴシック), bundled so that deck screenshots render
Japanese text the same way everywhere.

The thumbnails on the landing page are produced by screenshotting each deck in
a headless browser, and nearly every deck title is in Japanese. A machine with
no Japanese font draws those titles as tofu boxes instead — which is what the
published thumbnails looked like. Netlify builds the deployed site and offers
no way to install system packages, so the font travels with the repository
rather than being installed into the build image.

`scripts/generate-screenshot.ts` points fontconfig at this directory before
launching the browser. Nothing else uses it: the published decks are rendered
by the visitor's own browser with their own fonts, so this affects screenshots
only.

- Upstream: https://ipafont.ipa.go.jp/old/
- License: IPA Font License Agreement v1.0 — see `LICENSE-IPA.txt`

The license permits redistribution. It also forbids distributing a modified
font under the same name, so replace the file wholesale rather than subsetting
it in place.
