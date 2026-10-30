# Image plan: 10 concepts x 4 styles = 40 images (Gemini fast model)

Paste the prompt into Gemini and save the result as `images/img-NNN.webp` (or .png / .jpg), `NNN` being the number below. Then run `node tools/build-images-json.mjs`.

**Tries** = how many times Gemini has to compute the image until you are happy with it. The first result is 1; every "generate again", retry or edit request ("fix the hands", "make it darker") adds 1. Each one costs energy because the model calculates the whole image again.
The numbers below are my *expectation* (minimalist and flat styles usually work first time; photorealism, faces, hands and crowds need more). **Replace them with what really happened** (tell me, e.g. "006 took 5", or edit `tools/image-plan.json`).

Energy = 0.6 Wh x tries (estimate). Water in the game = Wh x 1 ml (x4 with the power-generation toggle).

| # | Concept | Style | Prompt (paste into Gemini) | Expected tries | Wh |
|---|---|---|---|---|---|
| 001 | sailor-portrait | minimalist | a portrait of an old sailor with a white beard, minimalist line art, a single continuous line, lots of white space | 1 | 0.6 |
| 002 | sailor-portrait | comic | a portrait of an old sailor with a white beard, comic book style with bold outlines and halftone shading | 1 | 0.6 |
| 003 | sailor-portrait | anime film | a portrait of an old sailor with a white beard, hand-painted anime film style, soft pastel watercolor backgrounds, gentle light | 3 | 1.8 |
| 004 | sailor-portrait | photorealistic | a portrait of an old sailor with a white beard, photorealistic, ultra-detailed, natural lighting | 5 | 3.0 |
| 005 | windowsill-cat | flat vector | a tabby cat sleeping on a sunny windowsill, flat vector illustration with only a few colors | 1 | 0.6 |
| 006 | windowsill-cat | claymation | a tabby cat sleeping on a sunny windowsill, stop-motion claymation figures, soft studio light | 2 | 1.2 |
| 007 | windowsill-cat | oil painting | a tabby cat sleeping on a sunny windowsill, oil painting with visible brush strokes | 3 | 1.8 |
| 008 | windowsill-cat | photorealistic | a tabby cat sleeping on a sunny windowsill, photorealistic, ultra-detailed, natural lighting | 4 | 2.4 |
| 009 | rainy-street | comic | a rainy city street at night with glowing signs, comic book style with bold outlines and halftone shading | 1 | 0.6 |
| 010 | rainy-street | retro synthwave | a rainy city street at night with glowing signs, retro 80s synthwave style, neon grid, purple and orange sunset | 2 | 1.2 |
| 011 | rainy-street | futuristic | a rainy city street at night with glowing signs, futuristic sci-fi concept art, glowing details, intricate machinery | 3 | 1.8 |
| 012 | rainy-street | photorealistic | a rainy city street at night with glowing signs, photorealistic, ultra-detailed, natural lighting | 4 | 2.4 |
| 013 | mountain-lake | pixel art | a mountain lake at sunrise with pine trees, 16-bit pixel art | 2 | 1.2 |
| 014 | mountain-lake | watercolor | a mountain lake at sunrise with pine trees, loose watercolor painting on textured paper | 2 | 1.2 |
| 015 | mountain-lake | anime film | a mountain lake at sunrise with pine trees, hand-painted anime film style, soft pastel watercolor backgrounds, gentle light | 2 | 1.2 |
| 016 | mountain-lake | oil painting | a mountain lake at sunrise with pine trees, oil painting with visible brush strokes | 3 | 1.8 |
| 017 | fruit-bowl | minimalist | a ceramic bowl full of ripe fruit on a wooden table, minimalist line art, a single continuous line, lots of white space | 1 | 0.6 |
| 018 | fruit-bowl | pencil sketch | a ceramic bowl full of ripe fruit on a wooden table, detailed graphite pencil sketch | 2 | 1.2 |
| 019 | fruit-bowl | stained glass | a ceramic bowl full of ripe fruit on a wooden table, stained glass window with lead lines and jewel colors | 3 | 1.8 |
| 020 | fruit-bowl | photorealistic | a ceramic bowl full of ripe fruit on a wooden table, photorealistic, ultra-detailed, natural lighting | 4 | 2.4 |
| 021 | waving-robot | pixel art | a friendly robot waving hello in a garden, 16-bit pixel art | 2 | 1.2 |
| 022 | waving-robot | low-poly 3D | a friendly robot waving hello in a garden, low-poly 3D render with flat shaded facets | 2 | 1.2 |
| 023 | waving-robot | futuristic | a friendly robot waving hello in a garden, futuristic sci-fi concept art, glowing details, intricate machinery | 3 | 1.8 |
| 024 | waving-robot | claymation | a friendly robot waving hello in a garden, stop-motion claymation figures, soft studio light | 2 | 1.2 |
| 025 | station-crowd | minimalist | a busy train station platform full of commuters, minimalist line art, a single continuous line, lots of white space | 1 | 0.6 |
| 026 | station-crowd | comic | a busy train station platform full of commuters, comic book style with bold outlines and halftone shading | 2 | 1.2 |
| 027 | station-crowd | pencil sketch | a busy train station platform full of commuters, detailed graphite pencil sketch | 4 | 2.4 |
| 028 | station-crowd | photorealistic | a busy train station platform full of commuters, photorealistic, ultra-detailed, natural lighting | 6 | 3.6 |
| 029 | paper-boat | flat vector | two hands holding a small paper boat, flat vector illustration with only a few colors | 1 | 0.6 |
| 030 | paper-boat | watercolor | two hands holding a small paper boat, loose watercolor painting on textured paper | 3 | 1.8 |
| 031 | paper-boat | low-poly 3D | two hands holding a small paper boat, low-poly 3D render with flat shaded facets | 3 | 1.8 |
| 032 | paper-boat | photorealistic | two hands holding a small paper boat, photorealistic, ultra-detailed, natural lighting | 5 | 3.0 |
| 033 | spaceship | pixel art | a spaceship flying over a ringed planet, 16-bit pixel art | 2 | 1.2 |
| 034 | spaceship | flat vector | a spaceship flying over a ringed planet, flat vector illustration with only a few colors | 1 | 0.6 |
| 035 | spaceship | futuristic | a spaceship flying over a ringed planet, futuristic sci-fi concept art, glowing details, intricate machinery | 3 | 1.8 |
| 036 | spaceship | retro synthwave | a spaceship flying over a ringed planet, retro 80s synthwave style, neon grid, purple and orange sunset | 2 | 1.2 |
| 037 | snow-cabin | flat vector | a small wooden cabin in a snowy forest at dusk, flat vector illustration with only a few colors | 1 | 0.6 |
| 038 | snow-cabin | anime film | a small wooden cabin in a snowy forest at dusk, hand-painted anime film style, soft pastel watercolor backgrounds, gentle light | 2 | 1.2 |
| 039 | snow-cabin | stained glass | a small wooden cabin in a snowy forest at dusk, stained glass window with lead lines and jewel colors | 3 | 1.8 |
| 040 | snow-cabin | oil painting | a small wooden cabin in a snowy forest at dusk, oil painting with visible brush strokes | 3 | 1.8 |

Numbers come in groups of four per concept (e.g. 001-004 is the sailor portrait in four different styles).
Note on the anime style: the prompt describes the look (hand-painted anime film, soft pastel watercolor backgrounds) instead of naming a studio, which also avoids refusals.
