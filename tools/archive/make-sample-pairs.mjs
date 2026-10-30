// Writes 8 placeholder pairs (colored SVGs) + a sample pairs.json so "Real or AI?" can be tried at index.html?demo
// Run: node tools/make-sample-pairs.mjs   (only needed to regenerate the sample)
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync(new URL("../images/pairs/", import.meta.url), { recursive: true });
const shapes = [
  (c) => `<circle cx="200" cy="190" r="90" fill="${c}"/>`,
  (c) => `<rect x="110" y="110" width="180" height="180" rx="10" fill="${c}"/>`,
  (c) => `<polygon points="40,320 160,140 220,230 270,170 360,320" fill="${c}"/>`,
  (c) => `<path d="M0 250 Q 50 190 100 250 T 200 250 T 300 250 T 400 250 V400 H0 Z" fill="${c}"/>`,
];
const palettes = [["#ffb88c", "#de6262"], ["#a1c4fd", "#2f66dc"], ["#c3ec52", "#0ba29d"], ["#fbc2eb", "#a6c1ee"], ["#fddb92", "#d1fdff"], ["#84fab0", "#8fd3f4"], ["#f6d365", "#fda085"], ["#cfd9df", "#e2ebf0"]];
const svg = (i, label, flip) => {
  const [a, b] = palettes[i % palettes.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${flip ? b : a}"/><stop offset="1" stop-color="${flip ? a : b}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/>${shapes[i % shapes.length]("#ffffff")}<text x="200" y="384" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#000" opacity=".45">${label}</text></svg>`;
};

const subjects = ["a quiet lake", "a stone bridge", "a bowl of fruit", "a lighthouse", "a snowy cabin", "a harbor painting", "a pencil tree", "a garden path"];
const out = subjects.map((s, i) => {
  const id = `sample-${i + 1}`;
  writeFileSync(new URL(`../images/pairs/${id}-real.svg`, import.meta.url), svg(i, "placeholder", false));
  writeFileSync(new URL(`../images/pairs/${id}-ai.svg`, import.meta.url), svg(i, "placeholder", true));
  return {
    id, placeholder: true, subject: s, category: i < 5 ? "photo" : "art", difficulty: (i % 3) + 1,
    tell: "Placeholder pair: replace it with real pictures (see tools/PAIRS-PLAN.md).",
    real: { file: `images/pairs/${id}-real.svg`, credit: "Sample", source: "placeholder" },
    ai: { file: `images/pairs/${id}-ai.svg`, tool: "Gemini", tries: (i % 3) + 1, wh: Number((0.6 * ((i % 3) + 1)).toFixed(2)) },
  };
});
writeFileSync(new URL("../pairs.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${out.length} placeholder pairs and pairs.json`);
