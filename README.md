# 💧⚡ How Thirsty?

Endless mini-games about how much **water** or **electricity** different AI tasks use. Plain HTML + CSS + vanilla JS (ES modules), no build step, no dependencies, English only, mobile-first (designed at 390 px). No accounts, no backend, no daily challenge.

| # | Game | What you do |
|---|------|-------------|
| 1 | **Higher or Lower** | Does the right prompt use more or less than the left? Difficulty ramps with your streak; boss prompts appear from streak 12. Modes: Classic, Text only, Wild, Reference duel. Optional 3 lives. |
| 2 | **Measure Your Prompt** | Type any prompt, get an estimate, three comparisons, 1,000× / a year / 8 billion people lines, and a log-scale bar. |
| 3 | **Image Duel** (hidden) | Two AI images: more, less or about the same? Reveals model, resolution, steps and measured vs estimated. Reads `images.json`. |
| 4 | **Sort It** | Put 5 prompts in order, lowest to highest. |
| 5 | **Guess It** | Log-scale slider, 10 rounds, up to 3 stars each. |

## Run it

ES modules need a web server (opening `index.html` as a `file://` URL will not work):

```bash
python server.py 8080
```

(`server.py` is `python -m http.server` plus a no-cache header, so edits show up on a normal reload.)

then open <http://localhost:8080>. (`npx serve` works too.) It can be hosted as-is on GitHub Pages. A small network-first service worker (`sw.js`) caches files as you play, so the game keeps working offline once loaded.

Self-test (engine, estimator, game rules; needs Node 18+):

```bash
node tests/selftest.mjs
```

## Project layout

```
index.html  styles.css  sw.js
data.js            ALL prompts, references, phrase templates, verdicts, estimator rules (provided; not edited)
data-extra.js      tunables + the few bits of content SPEC.md needs that data.js doesn't have
images.json        Image Duel data (sample: 18 placeholder entries, one using a tier instead of wh)
images/            the images (sample: generated SVG placeholders)
js/main.js         router, home menu, settings + "About these numbers" panels, theme
js/engine.js       number formatting, best-fit units, reference picker, phrase generator
js/estimator.js    Measure Your Prompt estimator
js/storage.js      localStorage wrapper (every access in try/catch, in-memory fallback)
js/settings.js     persisted settings (resource, ×4 toggle, units, sound)
js/toggles.js  js/ui.js  js/sound.js     shared UI helpers
js/games/*.js      one module per game: export { id, title, emoji, blurb, mount, unmount }
tests/selftest.mjs     tools/make-sample-images.mjs
```

The app name lives in one constant: `APP_NAME` in `data-extra.js` (also edit the `<title>` and header in `index.html`).

**Adding a game:** create `js/games/mygame.js` exporting `id, title, emoji, blurb, mount(rootEl, ctx), unmount()`, then add one `import` and one entry in the `GAMES` array in `js/main.js`. `ctx` gives you `ctx.s` (current settings), `ctx.subscribe(fn)` (re-render on settings change), `ctx.announce(text)` (aria-live), `ctx.sound(kind)`.

## How to add content

Everything is data. Game code never contains prompts, references or phrases.

### A prompt (`data.js` → `PROMPTS`)
```js
{ id: "haiku", emoji: "🌸", cat: "writing", text: "Write a haiku about Monday mornings", wh: 0.3 }
```
`wh` is the electricity in watt-hours; water (ml) is `wh × WATER_ML_PER_WH` (×`POWER_GEN_WATER_MULT` if the toggle is on). Add `boss: true` for extreme prompts that should only appear at high streaks. Categories used by the "Text only" / "Wild" modes are listed in `HL.modes` (`data-extra.js`).

### A reference (`WATER_REFS` / `ELEC_REFS`)
```js
{ id: "coffee", emoji: "☕", one: "a cup of coffee", many: "cups of coffee", ml: 250, tag: "household" }
```
(`wh` instead of `ml` for electricity.) References are only ever used when the ratio to the prompt is inside the **0.02 – 5,000,000** window (`REF_WINDOW`), so adding very small or very large references is safe.

### A phrase template (`TEMPLATES`)
```js
{ kind: "many", mode: "both", text: "{N} prompts like this = {ref}." }
```
- `kind`: `many` (reference > prompt, uses `{N}`), `few` (prompt > reference, uses `{M}`), `any` (always valid).
- `mode`: `water`, `elec` or `both`.
- Placeholders: `{N} {M} {ref} {refs} {emoji} {value} {drops} {year} {thousand} {world} {pedal} {pedalMin} {led}`. The unit words after `{pedal}`/`{pedalMin}`/`{led}` ("seconds"/"minutes") are swapped for an automatic unit (seconds → minutes → hours → days).

### Verdict tiers, estimator rules
`VERDICTS`, `CATEGORY_RULES` and `ESTIMATOR` in `data.js`. Extra keywords for the estimator live in `MEASURE.extraWords` (`data-extra.js`), and the six example prompts in `MEASURE.examples`.

### Images for Image Duel (`images.json`)
```json
{
  "id": "img-001",
  "file": "images/img-001.webp",
  "prompt": "a red fox sitting in a snowy forest, golden hour",
  "model": "sdxl-base", "width": 1024, "height": 1024, "steps": 30, "batch": 1,
  "wh": 1.6, "measured": true,
  "note": "optional fun fact shown on reveal"
}
```
- `wh` is Wh **per image**. If you leave it out, the game uses `"tier": "T0".."T4"` (the SPEC 7.4 estimate table, `IMG.tiers`) or, failing that, the formula `k_model × megapixels × steps + 0.05` (`IMG.kModel`).
- `measured: false` shows an **Estimated** badge instead of **Measured**.
- Optional `"complexity": "simple" | "complex"` powers the "plot twist" line when a simple-looking image cost more than a detailed one.
- **Video boss rounds:** set `"kind": "video"` (or a `.webm`/`.mp4` file) and/or `"boss": true`. They only appear from streak 12, clip vs. clip.
- Pair rules are automatic: same prompt/different settings, different prompts/same settings (answer: about the same), and random pairs. A pair is only served if the values are within 10% ("about the same") or at least 1.25× apart.
- Target 60+ images for launch, 150+ for an endless feel. SPEC section 7.4–7.5 describes how to generate and measure them (diffusers + codecarbon, or tier estimates). To regenerate the placeholder sample: `node tools/make-sample-images.mjs`.

## Decisions I made (no questions asked)

- **Same ordering in both modes.** Water ≈ energy in the data, so only units, references, phrases and theme change. The ×4 toggle multiplies every water value.
- **Higher or Lower:** the left prompt's reference line is the phrase from its reveal. Value count-up animation lasts ~0.9 s (instant with reduced motion). There is a *Next* button instead of auto-advance so you can read the phrase. In 3-lives mode, the score is total correct answers and the best score is stored separately (`ht.best.higherlower.<mode>-lives`). "Reference duel" shows a fresh (reference, prompt) pair each round. If a mode has no pair that satisfies the ramp, the ramp is relaxed first, then repeat avoidance; the 1.25× minimum, boss gating and "no 4 same categories in a row" are never relaxed.
- **Never repeat a reference back-to-back:** when a value is so big or small that only one reference fits the window, the game shows a scale line (e.g. "1,000 times = …") instead of repeating it or showing an absurd count.
- **Measure Your Prompt:** video with no stated length assumes 5 s and audio assumes 30 s. "N pages" is treated as output when the prompt says write/draft/compose/… (or the type is Writing) and as input otherwise. "Build me a web app" is detected as Agent via `MEASURE.extraWords`.
- **Sort It** uses tap-to-select-and-swap plus ▲▼ buttons (no drag-and-drop, which is unreliable on touch and not keyboard-accessible).
- **Guess It** prompts whose value falls outside the slider range (0.1 – 100,000) are skipped (this removes a few big ones when "include water from generating electricity" is on).
- **Sound** is three tiny WebAudio blips; off by default.
- Keyboard: Higher or Lower `↑`/`↓` (or `H`/`L`), Image Duel `↑` more / `↓` less / `→` same, `Enter` to continue, `Ctrl+Enter` to measure.

## Storage keys

`ht.settings`, `ht.best.higherlower.<mode>[-lives]`, `ht.best.imageduel`, `ht.best.guessit`, `ht.best.sortit`, `ht.cfg.higherlower`. Every read/write is in try/catch with an in-memory fallback, so everything works with storage blocked.

## Known data quirks (data.js is untouched)

- The template "Doing this daily for a year = {year}." uses the `{year}` placeholder as defined in `data.js` (10 prompts a day × 365), so "daily" there really means ten a day.
- Electricity references top out at 700 kWh (a Bitcoin transaction), so the GPT-3-class and frontier training bosses have no reference inside the 0.02–5,000,000 window in electricity mode; they get scale lines only.
- "Measure": a 5-second video comes out at 600 Wh with the data.js formula (`baseWh 100 + 5 × 100`), versus 500 Wh in the SPEC's acceptance list. Same order of magnitude.

## Content in the box (round 2)

`data.js` now holds 340 prompts (a bell curve in log space, most of them between about 1 and 60 Wh, so rounds have real difficulty), 108 water references, 88 electricity references and 108 phrase templates. (Earlier text: 138 prompts (every category, plus two more training bosses), 94 water references, 73 electricity references (including big ones such as a nuclear reactor hour or a town for a year, so the training bosses get comparisons in electricity mode too) and 88 phrase templates. Measure Your Prompt keeps a pool of 16 example prompts and shows 6 random ones each time. `images.json` has 18 placeholder entries; re-run `node tools/make-sample-images.mjs` to regenerate them.

## Look and feel

Colour-block interface: solid colour cards and chunky buttons with a bottom edge (mint = more, coral = less, sun = about the same, blue = primary). Sizes on wide screens follow the window height (`clamp()` with `vh`), so each game screen fills the window; phones get a compact layout that avoids scrolling. The stylesheet link in `index.html` carries a version (`styles.css?v=N`): bump it when you edit the CSS so browsers don't serve a cached copy. `start.bat` starts the local server on Windows.

## Appearance

Settings → Appearance (or the toggle on the home page): Auto follows the system, Light and Dark force a mode. The mode is applied as `data-mode` on `<html>` (an inline script in `index.html` sets it before first paint). Each mini-game also has its own colour scheme (`body[data-view]`, set in `js/main.js`; see the end of `styles.css`).

## Adding your own AI images (Gemini batch)

1. Open `tools/IMAGE-PLAN.md`: 40 numbered prompts = 10 concepts x 4 styles (flat vector, comic, painting, photoreal), each with the expected number of tries and the estimated Wh (water in the game = Wh x 1 ml).
2. Generate each prompt and save the result as `images/img-NNN.webp` (or .png / .jpg), `NNN` being the number in the plan. About 800 px wide is plenty.
3. Run `node tools/build-images-json.mjs`. It includes only the images that exist, reads their real size, and rewrites `images.json` once at least 2 images are found. Add images in batches whenever you like.
4. Replace the expected tries with the real ones (edit `tools/image-plan.json`, field `tries`, and `wh` = 0.6 x tries) and run the script again.

Energy per image = 0.6 Wh x tries (an estimate for Gemini's fast image model, not a measurement; the game labels it "Estimated"). Style changes the cost mostly through the number of retries it needs. The old placeholder SVGs in `images/` can be deleted once the real images are in.

## Hidden game: Image Duel

Image Duel (`js/games/imageduel.js`, `images.json`, `tools/image-plan.*`) is still in the project but hidden from the app: `HIDDEN_GAMES` in `js/main.js` lists it. To bring it back, delete `"imageduel"` from that set. Reason it is hidden: with proprietary image generators the energy of an image depends on retries the player cannot see, so the duel is mostly guesswork (a settings-based redesign would fix that).

## Game 6: Real or AI?

Every round shows one random **real** picture against one random **AI** picture (tap the AI one). A picture never comes back in the same game, so a game lasts as many rounds as the smaller of the two pools; one wrong answer ends it (or you use 3 lives). After each answer it shows which was which, the credit of the real picture and the estimated energy/water of the AI one.

- **Pictures:** real photos in `images/real/NNN.webp`, AI pictures in `images/ai/NNN.webp`. They are *not* paired.
- **Preparing:** `python tools/prepare-images.py <folder> --kind real` (or `--kind ai`) makes 1000 px square WebP files with no GPS/EXIF and numbers them after the last existing one. Needs `pip install pillow` (and `pillow-heif` for HEIC). For AI pictures it also trims 6% from the edges to remove the Gemini sparkle.
- **Details:** `tools/pictures-info.json`: `defaults` (credit/license for all real pictures, tool/tries for all AI ones) plus optional per-picture entries (`real: { "007": { "subject": ... } }`, `ai: { "012": { "tries": 3, "tell": "what gives it away" } }`). AI energy = 0.6 Wh x tries (an estimate).
- **Build:** `node tools/build-pictures-json.mjs` writes `realorai.json` (the game reads it) and warns about pictures that are not square.
- **Numbering of AI pictures:** files named `1.png`, `2.png`... keep their number, which is the prompt number in `tools/AI-PROMPTS.md` (the script natural-sorts, so 10 comes after 9). Numbers 101-110 are the older first batch of ten pictures.
- **Prompts:** `tools/AI-PROMPTS.md` has 60 scenes (18 kinds of photo, casual and professional) with full prompts that keep the photographer out of the picture.
- **Visibility:** the game appears on the home page once there are at least 6 real AND 6 AI pictures (`REALAI.minPerSideToShow` in `data-extra.js`). Until then you can try it with placeholders at `index.html?demo=1` (`node tools/make-sample-pictures.mjs` regenerates them).
- The old paired version (pairs, difficulty, per-pair prompts) is archived in `tools/archive/`.

Note on caching: the script tag in `index.html` and the stylesheet link carry a version (`main.js?v=N`, `styles.css?v=N`). Bump it when you change those files so browsers don't keep an old copy.
