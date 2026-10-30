# How Thirsty? — AI water & energy mini-games (build spec for Codex)

> Working title: **How Thirsty?** (alternatives: *Drop by Drop*, *Prompt Drops*, *Gulp*, *Thirsty Bot*). Easy to rename: keep the name in one constant.

## 0. What to build

A static website of small, endless games about how much **water** or **electricity** different AI tasks use. English only. No accounts, no backend, no daily challenge: players can play as many rounds as they want, forever.

Build order for Codex:
1. Project skeleton + shared engine (formatting, ratio/phrase generator, settings).
2. Game 1: Higher or Lower.
3. Game 2: Measure Your Prompt.
4. Game 3: Image Duel (needs `images.json`, see section 7).
5. Game 4: Sort It. Game 5: Guess It.
6. Polish: animations, sound toggle, share buttons, README.

All content lives in **`data.js`** (provided). Never hard-code prompts, references or phrases in game logic.

## 1. Tech and structure

- Plain HTML + CSS + vanilla JS (ES modules). No build step, no dependencies, works by opening a local server (`npx serve` / `python -m http.server`) and can be hosted on GitHub Pages.
- Mobile-first (design at 390 px wide first), then desktop. Big tap targets. Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Suggested layout:

```
index.html
styles.css
data.js                 (provided)
images.json             (section 7, generated later)
/images/                (AI images, later)
/js/
  main.js               router + home menu + settings panel
  engine.js             unit conversion, formatting, phrase generator, RNG helpers
  storage.js            localStorage wrapper (try/catch every access)
  games/higherlower.js
  games/measure.js
  games/imageduel.js
  games/sortit.js
  games/guessit.js
```

- Every game module exports `{ id, title, emoji, blurb, mount(rootEl, ctx), unmount() }`. Adding a game = add a file + one line in `main.js`.
- Look and feel: water theme (deep blue → aqua gradient), rounded cards, droplet motifs, a small animated "water level" that rises with the streak. Electricity mode switches the accent color to yellow/amber and the droplet to a lightning bolt. The theme must visibly change with the toggle.

## 2. Global settings (persist in localStorage, accessible from every screen)

| Setting | Options | Default | Notes |
|---|---|---|---|
| Resource | 💧 Water / ⚡ Electricity | Water | Switches units, reference set, phrase set and theme. |
| Include water from generating electricity | on / off | off | Water mode only. Multiplies every prompt's water by `POWER_GEN_WATER_MULT` (4). Hide the toggle in Electricity mode. |
| Units | Metric / US | Metric | Water: ml/L ↔ fl oz/gallons. Electricity: Wh/kWh stay the same. |
| Sound | on / off | off | Optional tiny blips (WebAudio, no files). |

Values per prompt:
- Electricity mode: `value = prompt.wh`
- Water mode: `value_ml = prompt.wh * WATER_ML_PER_WH * (generationToggle ? POWER_GEN_WATER_MULT : 1)`

Because water ≈ energy, the **ordering of prompts is identical in both modes**; only units, references and flavor text change. That is expected.

## 3. Shared engine (`engine.js`)

### 3.1 Number formatting
- Always round to **2 significant figures**, and say "about" or "~" for large rounded values.
- Use thousands separators below 1 million, then words: `1.4 million`, `3.2 billion`, `7.1 trillion`.
- Tiny values: show ml with up to 2 decimals (`0.3 ml`), and in water mode also show drops (`≈ 6 drops`, 1 drop = 0.05 ml).
- Best-fit unit chooser:
  - Water: `ml` < 1,000 → `L` < 1,000,000 → `m³` (cubic meters) above. US: `fl oz` → `gal`.
  - Electricity: `Wh` < 1,000 → `kWh` < 1,000,000 → `MWh` < 1,000,000 → `GWh`.

### 3.2 Reference picker + phrase generator
Input: a prompt value `v` (in the current resource unit) and the pool of references for the current resource (`WATER_REFS` or `ELEC_REFS`, field `ml` or `wh`).

1. Compute for each reference `r = ref / v`.
2. **Valid references**: `0.02 ≤ r ≤ 5,000,000` (so we never say "0.0000003 showers").
3. Prefer references **close to the interesting range**: weight candidates by `1 / (1 + |log10(r)|)`, so the player gets plenty of "1 prompt = 3 sips" and "40 prompts = a coffee" but also the occasional wild one like "5 million prompts = a hamburger".
4. Never show the same reference twice in a row; never show the same template twice in a row; avoid repeating a reference more than once every ~6 rounds.
5. Pick a template:
   - `r ≥ 2` → templates with `kind: "many"` (placeholder `{N} = round2(r)`).
   - `r ≤ 0.5` → templates with `kind: "few"` (placeholder `{M} = round2(1/r)`).
   - `0.5 < r < 2` → special case: "That's about the same as {ref}." (or "almost exactly {ref}" if within 10%).
   - `kind: "any"` templates can be mixed in about 25% of the time, in addition to a main phrase.
   - Respect `mode` (`water` / `elec` / `both`) of each template.
6. Fill placeholders (documented at the top of the TEMPLATES block in `data.js`). Capitalize the first letter. If a phrase starts with a number or emoji, don't double-capitalize.
7. Show the reference emoji big next to the phrase.

Pedal math for electricity: a human pedals about 100 W, so `pedalSeconds = wh * 36`. If it's more than 120 seconds show minutes; more than 120 minutes show hours; more than 48 hours show days.

### 3.3 Verdict tier
Use `VERDICTS` to give a quick emoji+label after each reveal (based on the water ml or Wh value).

## 4. Game 1 — Higher or Lower (the main game)

**Layout:** two big cards. Left card (the "anchor") shows emoji, prompt text, and its value (with unit and reference line). Right card shows emoji and prompt text, but its value is hidden. Two buttons: **Higher** / **Lower** ("Does the right one use MORE or LESS than the left?").

**Round flow:**
1. Player chooses. The hidden value counts up/animates like a rising water level, then reveals.
2. Correct → +1 streak, show a reveal strip with the phrase generator output (3.2), then the right card slides left and becomes the new anchor; a new right card enters.
3. Wrong → game over screen: streak, personal best (localStorage), the last two prompts with values, a share button, "Play again".
4. Keep playing forever. No round limit.

**Pair selection rules (important for fun):**
- Draw from `PROMPTS`. Boss items (`boss: true`) are excluded until streak ≥ 12, and then only appear 1 in 5 rounds.
- Never pair two items whose values differ by less than 1.25× (not guessable). Never exact ties.
- **Difficulty ramp:** target ratio range between the two values shrinks as the streak grows:
  - streak 0-4: ratio ≥ 8×
  - streak 5-9: ratio 3×-30×
  - streak 10-19: ratio 1.5×-6×
  - streak 20+: ratio 1.25×-3×
- Don't show an item again for at least 10 rounds (shuffle bag), and never the same category 4 times in a row.
- Optional **sub-modes** (selectable on the start screen): "Classic" (all prompts), "Text only" (chat/writing/docs/code/reasoning), "Wild" (include image/audio/video/agent/training), "Reference duel" (compare prompt vs. a real-world reference: "Does this prompt use more or less than a shower?").

**Lives:** default sudden death. Optional "3 lives" toggle on the start screen.

**Share text** (copy to clipboard / Web Share API):
```
💧 How Thirsty? — Higher or Lower
Streak: 14 🔥  (best: 21)
An 8-minute shower = 140,000 chatbot prompts
Play: <url>
```
In electricity mode use ⚡ and a pedaling line.

## 5. Game 2 — Measure Your Prompt

**Layout:** textarea ("Type any prompt…"), a type selector (Auto-detect, Chat, Writing, Code, Reasoning, Research, Image, Audio, Video, Documents, Agent), a Measure button, and the toggles from section 2.

**Estimator** (all numbers in `data.js` → `CATEGORY_RULES`, `ESTIMATOR`):
1. Count tokens: `inputTokens = ceil(chars / 4)`.
2. Category: user selection, else keyword detection (case-insensitive, first matching rule from top to bottom in `CATEGORY_RULES`; default chat).
3. Parse hints from the text and apply:
   - "N words" → `outputTokens = N * 1.33`; "N pages" (output) → `N * 500 words`; "N pages" of **input** (e.g. "summarize this 40-page PDF") → add `N * perInputPageWh`.
   - "N images" / "N logos" / "N variations" → multiply image cost by N.
   - "N seconds" / "N-second" with a video word → `baseWh + N * perSecondWh`; "N minute(s)" → 60·N seconds.
   - Reasoning cues ("step by step", "prove", "think hard", "olympiad") → multiply total by `deepThinkingMult` (10) unless category is already reasoning (then ×1.5).
4. `wh = baseWh + inputTokens * inputPerTokenWh + outputTokens * outputPerTokenWh` (+ other hints). Clamp to `[minWh, maxWh]`.
5. Easter eggs from `ESTIMATOR.easterEggs` ("please" / "thank you" → +0.05 Wh and a friendly note).
6. Convert to ml with the settings in section 2.

**Result card:**
- Big number (value + unit; in water mode also drops).
- Verdict tier (emoji + label).
- **Three comparisons**, chosen by the phrase generator (3.2), always different references. In water mode force at least one of: a shower / a coffee / an animal drinking. In electricity mode force at least one of: phone charge / pedaling / LED bulb.
- "If you did this 1,000 times: …", "10 a day for a year: …", "If all 8 billion people did this once: …" (from `any` templates).
- A small bar showing where the prompt sits on a log scale between "a Google search" and "a 5-second video".
- Disclaimer line (always visible): *"Rough estimates with large uncertainty — they depend on the model, hardware, data center and how you count. Treat them as orders of magnitude."*
- Share button.

Also add 6 clickable **example prompts** under the textarea (e.g. "Write a haiku", "Make a 5-second video of a dog surfing", "Build me a web app").

## 6. Games 4 and 5 (small extras, same data)

**Sort It:** show 5 random prompts (mix of categories, values spread at least 2× apart). Player drags/taps to order them from lowest to highest. Score = number in the correct position; perfect order gives a streak. Endless: "Next set".

**Guess It:** show one prompt; a log-scale slider from 0.1 to 100,000 (ml or Wh depending on mode). Score by distance in orders of magnitude: within 1.3× = 3 stars, within 3× = 2 stars, within 10× = 1 star. Show the real value + a phrase. Endless: 10-round sessions with a running total, then "Play again".

Optional later: **Equals What?** (multiple choice: "How many of these prompts equal a shower?").

## 7. Game 3 — Image Duel (images generated by AI)

Same idea as Higher or Lower but both cards show **an AI-generated image**; the player picks **More**, **Less**, or **About the same** for the right image vs. the left image (the third button is only a valid answer when the values are within 10%).

### 7.1 Why this needs a twist
Image generators cost roughly the same for a simple doodle and for a spectacular scene. Cost depends on **model, resolution, number of steps, and number of images**, not on how complex the picture looks. So the game teaches that. After each answer, reveal an **info card** for both images: model, resolution, steps (and batch size), the energy/water, and a one-liner (e.g. "A 4-step turbo model at 512 px uses ~25× less than a 50-step model at 2048 px — even though the picture looks simpler"). Include "trap" pairs on purpose where the simpler-looking image cost more.

### 7.2 Data format: `images.json`
```json
[
  {
    "id": "img-001",
    "file": "images/img-001.webp",
    "prompt": "a red fox sitting in a snowy forest, golden hour",
    "model": "sdxl-base",
    "width": 1024,
    "height": 1024,
    "steps": 30,
    "batch": 1,
    "wh": 1.6,
    "measured": true,
    "note": "optional fun fact shown on reveal"
  }
]
```
`wh` is the electricity per image; water = `wh * WATER_ML_PER_WH` (+ toggle), same as everywhere else.

### 7.3 Pair rules
- Pair types, mixed randomly: (a) **same prompt, different settings** (clearly teaches steps/resolution), (b) **different prompts, same settings** (correct answer: About the same), (c) **random** pair.
- "About the same" is correct when values are within 10%. Otherwise require ≥ 1.25× difference between the two images, otherwise skip the pair.
- Ramp difficulty like Higher or Lower (section 4).
- Hide metadata until the answer is given; the player only sees images.
- Add 5-10 **video clip** entries (short looping WebM/MP4 or a GIF) as "boss rounds" (their Wh is 100× bigger).

### 7.4 How to produce the images (three options, can be mixed)

**Option A — local generation with measured energy (recommended, gives real numbers).**
Use Python + `diffusers` and `codecarbon` (or read GPU watts via `nvidia-smi` and multiply by seconds):
1. For each of the prompts in 7.5, generate with a grid of settings: models `sdxl-turbo` (1-4 steps), `sdxl-base` (20/30/50 steps), `flux-schnell` (4 steps), `flux-dev` (20/28 steps); resolutions 512, 768, 1024, 1536; batch 1.
2. Wrap each generation with an energy tracker and record: seconds, average GPU watts, `Wh = watts × seconds / 3600` (add the idle baseline subtraction if you like). Save results to `images.json`.
3. Convert to WebP at about 800 px for the web (the displayed size does NOT have to match the generated resolution; the metadata does).
4. Target at least **60 images** for launch (≈1,700 possible pairs), **150+** for a good endless feeling.

**Option B — generate images with other AI tools (ChatGPT, Gemini, Midjourney, etc.) and assign estimated energy.**
Those services don't publish per-image energy, so mark `"measured": false` and use a **tier** table (to be labelled "estimate" in the UI):

| Tier | Typical situation | Wh/image (estimate) |
|---|---|---|
| T0 | tiny/turbo model, 512 px, a few steps | 0.1 |
| T1 | fast model, ~1 MP | 0.5 |
| T2 | standard model, ~1 MP, 20-30 steps | 2 |
| T3 | large model or HD / 2K, 30-50 steps | 5 |
| T4 | 4K upscale, multi-pass, or batch of 4 images generated together | 10+ |

Add a visible badge ("Estimated" vs. "Measured") on the reveal card.

**Option C — formula fallback** (when something wasn't measured): `Wh ≈ k_model × megapixels × steps + 0.05`, where `k_model` ≈ 0.05 (SDXL-class), 0.12 (Flux-dev-class), 0.10 (Flux-schnell-class, but only 4 steps), 0.05 (turbo-class). Replace with measured values as soon as you have them. A 1 MP SDXL image at 30 steps ≈ 1.6 Wh, which matches published ballpark figures.

### 7.5 Image prompt list (60, all original and brand-free)
Mix of subjects so that visual complexity does not correlate with cost. Generate each prompt at **at least two** different settings so same-prompt pairs exist.

**Animals (8):**
1. a red fox sitting in a snowy forest at golden hour
2. a sleepy corgi wearing a tiny knitted hat
3. a jellyfish glowing in a dark ocean
4. a flock of flamingos at sunrise
5. a grumpy cat sitting in a cardboard box
6. a hummingbird hovering next to a hibiscus flower
7. an owl reading a book in a library
8. a hedgehog in a rain jacket holding an umbrella

**Landscapes (8):**
9. a misty mountain valley with a winding river
10. a desert with giant dunes under two moons
11. a field of lavender with a small farmhouse
12. a stormy sea with a lone lighthouse
13. a autumn forest path covered in orange leaves
14. a tropical beach with turquoise water, aerial view
15. a frozen lake with northern lights above
16. a terraced rice field in the fog

**Cities and architecture (6):**
17. a rainy neon city street at night
18. a cozy cobblestone alley in a small European town
19. a futuristic city with flying trains
20. a brutalist concrete library at dusk
21. a floating market on a river in the morning
22. an old lighthouse converted into a house

**People and portraits, fictional (6):**
23. an elderly fisherman with a weathered smile, studio portrait
24. a child blowing dandelion seeds in a sunny field
25. a street musician playing violin in the subway
26. a chef plating a dessert in a busy kitchen
27. an astronaut sitting on a bench on Mars
28. a pair of dancers mid-spin in an empty ballroom

**Food (5):**
29. a rustic loaf of bread with steam rising
30. a tower of colorful macarons
31. a bowl of ramen with a soft-boiled egg
32. a messy breakfast table with pancakes and berries
33. a perfect scoop of pistachio ice cream melting

**Sci-fi and fantasy (7):**
34. a tiny dragon sleeping on a pile of books
35. a robot gardener watering plants in a greenhouse
36. a castle floating on a cloud
37. a spaceship docking at a ringed planet
38. a wizard's cluttered potion shop
39. a bioluminescent forest at night
40. an underwater city with glass domes

**Simple on purpose (the "trap" images, 6):**
41. a single red circle on a white background
42. a blue square on a gray background
43. a stick-figure doodle of a cat
44. a plain yellow smiley face
45. a black-and-white checkerboard
46. a minimalist line drawing of a mountain

**Dense and complex on purpose (6):**
47. a huge crowd at a music festival, every face detailed
48. a bustling medieval market with hundreds of stalls
49. an ultra-detailed clockwork machine with thousands of gears
50. a library with endless shelves, M.C. Escher-like perspective (original composition)
51. a coral reef with hundreds of fish species
52. a sprawling steampunk city, highly detailed, wide shot

**Abstract and graphic (4):**
53. swirling pastel watercolors
54. a geometric pattern of overlapping translucent triangles
55. a glitchy cyberpunk gradient
56. paper-cut layers forming a sunset

**Text-in-image (4, handy for showing complexity does not matter):**
57. a vintage sign reading "OPEN"
58. a chalkboard menu with the word "COFFEE"
59. a neon sign reading "HELLO"
60. a poster with the words "SAVE WATER" in big letters

(Keep prompts free of real brand names, living artists, famous characters and real people, to stay clear of copyright and likeness issues.)

## 8. Persistence

`storage.js`: wrap every `localStorage` read/write in try/catch (it can throw or be empty in private windows). Keys: `ht.settings`, `ht.best.higherlower.<mode>`, `ht.best.imageduel`, `ht.best.guessit`, `ht.best.sortit`. The game must run correctly without storage.

## 9. Accessibility and quality bar

- Keyboard: arrow keys for Higher/Lower (↑ higher, ↓ lower), Enter to continue.
- Buttons ≥ 44 px tall; contrast AA in both themes; images have `alt` = prompt text; announce the result via an `aria-live` region.
- Never use red/green as the only signal (add ✔ / ✖ icons).
- Every game has an always-visible link/toggle to the "About these numbers" panel: where figures come from (rough estimates), why water ≈ energy in this game (≈1 ml of cooling water per Wh), what the ×4 toggle means, and that real values vary a lot by model, hardware, data center and region.
- Keep the tone neutral: informative and playful, no preaching for or against AI.

## 10. Acceptance checklist

- [ ] All content comes from `data.js` / `images.json`; no hard-coded numbers in game modules.
- [ ] Resource toggle switches units, references, phrases and theme instantly, in every game.
- [ ] Higher or Lower never shows an unguessable pair (<1.25×) and respects the ramp and boss gating.
- [ ] No phrase ever shows an absurd count (outside 0.02-5,000,000 ratio window); numbers rounded to 2 significant figures.
- [ ] No immediate repeats of reference or template.
- [ ] Measure Your Prompt gives sensible answers: "What is the capital of France?" ≈ 0.3 Wh; "Write a 1,000-word essay" ≈ 1 Wh; "Make a 5-second video of a dog surfing" ≈ 500 Wh; "Do a deep research report with sources on coffee" ≈ 60 Wh.
- [ ] Works offline once loaded, on a 390 px wide screen, with no console errors.
- [ ] README explains how to add prompts, references, templates, and images.
