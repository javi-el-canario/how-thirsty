# Real or AI? - 30 pairs

Each pair = one **real** picture and one **AI** picture of the same subject. Save them as `images/pairs/NN-real.webp` and `images/pairs/NN-ai.webp`, then run `node tools/build-pairs-json.mjs`. You can add pairs in batches.

## Rules so the game is fair
- **Crop both pictures to the same shape** (square 1:1 is simplest, about 1000 px, exported as WebP ~80-150 KB). A different shape gives the answer away.
- **Remove the Gemini sparkle watermark** (visible in the corner of some Gemini images): crop it out.
- No people's faces, logos, brand names or visible watermarks, in either picture. Real photos must be from sources with a license that allows reuse; keep the author and source.
- Prefer real pictures **uploaded before 2022** (stock sites now contain AI images too).
- `Look` tells you what kind of real picture to choose: that's how difficulty works (an amateur real photo against a glossy AI one is easy; a very polished real photo against a candid AI one is hard).
- **Tries** = how many times Gemini computed the image until you were happy (first result = 1, every retry or edit +1). Expected values below: replace with the real ones.

| # | Subject | Type | Diff | Prompt for Gemini | Tries | Wh | Real: search + look |
|---|---|---|---|---|---|---|---|
| 01 | a mountain lake at sunrise with pine trees | photo | 1 | a mountain lake at sunrise with pine trees | 1 | 0.6 | "mountain lake sunrise pine trees": an ordinary, slightly imperfect amateur-looking photo (not too polished) |
| 02 | a bowl of ramen with a soft-boiled egg | photo | 2 | a candid photo of a bowl of ramen with a soft-boiled egg, natural light, shot on a phone | 2 | 1.2 | "bowl of ramen soft boiled egg": a normal good photo |
| 03 | a red fox in the snow | photo | 2 | a candid photo of a red fox in the snow, natural light, shot on a phone | 2 | 1.2 | "red fox in snow": a normal good photo |
| 04 | an old stone bridge over a river | photo | 2 | a candid photo of an old stone bridge over a river, natural light, shot on a phone | 2 | 1.2 | "old stone bridge river": a normal good photo |
| 05 | a vegetable stall at a street market, with a hand-painted sign | photo | 3 | a candid, slightly imperfect snapshot of a vegetable stall at a street market, with a hand-painted sign, natural light, subtle film grain | 3 | 1.8 | "vegetable market stall": a very polished, professional, vivid photo that looks "too perfect" (this makes the pair hard) |
| 06 | a cup of coffee on a wooden table | photo | 1 | a cup of coffee on a wooden table | 1 | 0.6 | "cup of coffee wooden table": an ordinary, slightly imperfect amateur-looking photo (not too polished) |
| 07 | sand dunes at sunset | photo | 1 | sand dunes at sunset | 1 | 0.6 | "sand dunes sunset": an ordinary, slightly imperfect amateur-looking photo (not too polished) |
| 08 | a cat sitting on a windowsill | photo | 2 | a candid photo of a cat sitting on a windowsill, natural light, shot on a phone | 2 | 1.2 | "cat sitting on windowsill": a normal good photo |
| 09 | a close-up of a dewy green leaf | photo | 2 | a candid photo of a close-up of a dewy green leaf, natural light, shot on a phone | 2 | 1.2 | "dew drops green leaf macro": a normal good photo |
| 10 | a bicycle leaning on a brick wall | photo | 2 | a candid photo of a bicycle leaning on a brick wall, natural light, shot on a phone | 2 | 1.2 | "bicycle leaning brick wall": a normal good photo |
| 11 | a bowl of fresh strawberries | photo | 1 | a bowl of fresh strawberries | 1 | 0.6 | "bowl of strawberries": an ordinary, slightly imperfect amateur-looking photo (not too polished) |
| 12 | a lighthouse on a rocky coast in stormy weather | photo | 2 | a candid photo of a lighthouse on a rocky coast in stormy weather, natural light, shot on a phone | 2 | 1.2 | "lighthouse stormy coast": a normal good photo |
| 13 | a forest path in autumn | photo | 1 | a forest path in autumn | 1 | 0.6 | "forest path autumn": an ordinary, slightly imperfect amateur-looking photo (not too polished) |
| 14 | a small bakery shop front, with its name painted above the door | photo | 3 | a candid, slightly imperfect snapshot of a small bakery shop front, with its name painted above the door, natural light, subtle film grain | 3 | 1.8 | "bakery shop front": a very polished, professional, vivid photo that looks "too perfect" (this makes the pair hard) |
| 15 | a pair of worn leather boots | photo | 2 | a candid photo of a pair of worn leather boots, natural light, shot on a phone | 2 | 1.2 | "worn leather boots": a normal good photo |
| 16 | a flock of birds flying at sunset | photo | 3 | a candid, slightly imperfect snapshot of a flock of birds flying at sunset, natural light, subtle film grain, no text | 3 | 1.8 | "flock of birds sunset": a very polished, professional, vivid photo that looks "too perfect" (this makes the pair hard) |
| 17 | a modern glass skyscraper seen from below | photo | 3 | a candid, slightly imperfect snapshot of a modern glass skyscraper seen from below, natural light, subtle film grain, no text | 3 | 1.8 | "glass skyscraper from below": a very polished, professional, vivid photo that looks "too perfect" (this makes the pair hard) |
| 18 | a bowl of steaming soup, close-up | photo | 2 | a candid photo of a bowl of steaming soup, close-up, natural light, shot on a phone | 2 | 1.2 | "bowl of soup steam close-up": a normal good photo |
| 19 | a snowy village street at dusk with no people | photo | 3 | a candid, slightly imperfect snapshot of a snowy village street at dusk with no people, natural light, subtle film grain, no text | 3 | 1.8 | "snowy village street dusk": a very polished, professional, vivid photo that looks "too perfect" (this makes the pair hard) |
| 20 | a wooden cabin beside a lake | photo | 2 | a candid photo of a wooden cabin beside a lake, natural light, shot on a phone | 2 | 1.2 | "wooden cabin lake": a normal good photo |
| 21 | an oil painting of a harbor with sailboats | art | 2 | an oil painting of a harbor with sailboats, looks like a scan of a real artwork | 2 | 1.2 | "oil painting harbor sailboats 19th century": a genuine artwork scan from a museum collection |
| 22 | a pencil sketch of an old tree | art | 2 | a pencil sketch of an old tree, looks like a scan of a real artwork | 2 | 1.2 | "pencil sketch old tree": a genuine artwork scan from a museum collection |
| 23 | a watercolor landscape of rolling hills | art | 3 | a watercolor landscape of rolling hills, looks like a scan of a real artwork with visible paper texture and small imperfections | 3 | 1.8 | "watercolor landscape hills": a genuine, high-quality museum scan with soft, blended technique (this makes the pair hard) |
| 24 | a vintage botanical illustration of a flower | art | 2 | a vintage botanical illustration of a flower, looks like a scan of a real artwork | 2 | 1.2 | "botanical illustration flower vintage": a genuine artwork scan from a museum collection |
| 25 | an ink drawing of a medieval village | art | 3 | an ink drawing of a medieval village, looks like a scan of a real artwork with visible paper texture and small imperfections | 3 | 1.8 | "ink drawing medieval village": a genuine, high-quality museum scan with soft, blended technique (this makes the pair hard) |
| 26 | an impressionist painting of a garden path | art | 3 | an impressionist painting of a garden path, looks like a scan of a real artwork with visible paper texture and small imperfections | 3 | 1.8 | "impressionist painting garden path": a genuine, high-quality museum scan with soft, blended technique (this makes the pair hard) |
| 27 | a woodblock print of a wave and a boat | art | 2 | a woodblock print of a wave and a boat, looks like a scan of a real artwork | 2 | 1.2 | "woodblock print wave boat": a genuine artwork scan from a museum collection |
| 28 | an oil still life with fruit and a jug | art | 3 | an oil still life with fruit and a jug, looks like a scan of a real artwork with visible paper texture and small imperfections | 3 | 1.8 | "oil painting still life fruit jug": a genuine, high-quality museum scan with soft, blended technique (this makes the pair hard) |
| 29 | a children's book illustration of a fox | art | 2 | a children's book illustration of a fox, looks like a scan of a real artwork | 2 | 1.2 | "children's book illustration fox vintage": a genuine artwork scan from a museum collection |
| 30 | a charcoal sketch of a mountain | art | 1 | a charcoal sketch of a mountain | 1 | 0.6 | "charcoal drawing mountain": a genuine drawing or sketch (a plain scan is fine) |

Sources for real photos: Pexels, Unsplash, Wikimedia Commons (filter: public domain / CC0), Openverse.
Sources for real art / drawings: The Met Open Access, Rijksmuseum, Art Institute of Chicago (CC0), Wikimedia Commons, Biodiversity Heritage Library (botanical).
