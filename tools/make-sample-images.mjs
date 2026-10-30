// Generates colored SVG placeholders in /images and a sample images.json (18 entries).
// Run: node tools/make-sample-images.mjs
// Replace the output with real AI images (see README) when you have them.
import { writeFileSync, mkdirSync } from "node:fs";
import { IMG } from "../data-extra.js";

mkdirSync(new URL("../images/", import.meta.url), { recursive: true });

const S = (model, width, height, steps) => ({ model, width, height, steps });
const specs = [
  // fox: same prompt, three settings
  { prompt: "a red fox sitting in a snowy forest at golden hour", ...S("sdxl-base", 1024, 1024, 30), measured: true,  colors: ["#ff9a4d", "#7a3b1d"], shape: "fox", complexity: "complex" },
  { prompt: "a red fox sitting in a snowy forest at golden hour", ...S("sdxl-turbo", 512, 512, 2),   measured: true,  colors: ["#ffb877", "#9a5a35"], shape: "fox", complexity: "complex", note: "Same prompt as the other fox, but far fewer steps and a quarter of the pixels." },
  { prompt: "a red fox sitting in a snowy forest at golden hour", ...S("flux-dev", 1536, 1536, 28), measured: false, colors: ["#ff8a3c", "#5b2a14"], shape: "fox", complexity: "complex" },
  // circle: the "trap" (simple but expensive)
  { prompt: "a single red circle on a white background",         ...S("flux-dev", 1536, 1536, 28), measured: false, colors: ["#ffffff", "#e53935"], shape: "circle", complexity: "simple", note: "A plain circle, yet it cost far more than a busy scene on a small, fast model." },
  { prompt: "a single red circle on a white background",         ...S("sdxl-turbo", 512, 512, 1),   measured: false, colors: ["#f5f5f5", "#ef5350"], shape: "circle", complexity: "simple" },
  { prompt: "a blue square on a gray background",                ...S("sdxl-base", 1024, 1024, 50), measured: true,  colors: ["#cfd8dc", "#1e66d0"], shape: "square", complexity: "simple", note: "Fifty steps for a square." },
  // crowd + others on identical settings (sdxl-base 1024 30): about the same
  { prompt: "a huge crowd at a music festival, every face detailed", ...S("sdxl-base", 1024, 1024, 30), measured: true,  colors: ["#6a4cff", "#ff4ca8"], shape: "crowd", complexity: "complex", note: "Hundreds of faces, but identical settings to the fox: about the same energy." },
  { prompt: "an owl reading a book in a library",                ...S("sdxl-base", 1024, 1024, 30), measured: true,  colors: ["#8d6e63", "#3e2723"], shape: "stripes", complexity: "complex" },
  { prompt: "a bowl of ramen with a soft-boiled egg",            ...S("sdxl-base", 1024, 1024, 30), measured: true,  colors: ["#ffcc80", "#bf360c"], shape: "sun", complexity: "complex" },
  // flux-schnell 1024 4: about the same
  { prompt: "a futuristic city with flying trains",              ...S("flux-schnell", 1024, 1024, 4), measured: false, colors: ["#00bcd4", "#1a237e"], shape: "city", complexity: "complex" },
  { prompt: "a stormy sea with a lone lighthouse",               ...S("flux-schnell", 1024, 1024, 4), measured: false, colors: ["#546e7a", "#102027"], shape: "wave", complexity: "complex" },
  // sdxl-turbo 512 4
  { prompt: "a hedgehog in a rain jacket holding an umbrella",   ...S("sdxl-turbo", 512, 512, 4),   measured: true,  colors: ["#81c784", "#1b5e20"], shape: "sun", complexity: "complex" },
  { prompt: "a hummingbird hovering next to a hibiscus flower",  ...S("sdxl-turbo", 512, 512, 4),   measured: true,  colors: ["#f06292", "#880e4f"], shape: "sun", complexity: "complex" },
  // big / batch
  { prompt: "a sprawling steampunk city, highly detailed, wide shot", ...S("sdxl-base", 1536, 1024, 50), measured: true, colors: ["#a1887f", "#3e2723"], shape: "city", complexity: "complex" },
  { prompt: "swirling pastel watercolors",                       ...S("flux-dev", 1024, 1024, 20),  measured: false, colors: ["#f8bbd0", "#b39ddb"], shape: "wave", complexity: "simple" },
  { prompt: "a minimalist line drawing of a mountain",           ...S("sdxl-base", 1024, 1024, 20), measured: true,  colors: ["#fafafa", "#90a4ae"], shape: "mountain", complexity: "simple" },
  { prompt: "a vintage sign reading \"OPEN\"",                   ...S("sdxl-turbo", 512, 512, 4),   measured: false, colors: ["#ffe082", "#c62828"], shape: "square", complexity: "simple" },
  // tier-only entry (no wh): batch of 4 images generated together = tier T4
  { prompt: "a tower of colorful macarons",                      ...S("flux-dev", 1024, 1024, 28),  measured: false, colors: ["#ffab91", "#7e57c2"], shape: "stripes", complexity: "complex", batch: 4, tier: "T4", note: "A batch of four generated together, estimated with the T4 tier." },
];

const shapes = {
  fox:     (c) => `<polygon points="200,330 140,170 230,230 300,170 270,330" fill="${c}" opacity=".85"/><circle cx="200" cy="250" r="48" fill="${c}"/>`,
  circle:  (c) => `<circle cx="200" cy="200" r="90" fill="${c}"/>`,
  square:  (c) => `<rect x="110" y="110" width="180" height="180" rx="6" fill="${c}"/>`,
  crowd:   (c) => Array.from({ length: 40 }, (_, i) => `<circle cx="${30 + (i % 8) * 48}" cy="${70 + Math.floor(i / 8) * 60}" r="16" fill="${c}" opacity="${0.45 + (i % 5) * 0.1}"/>`).join(""),
  city:    (c) => Array.from({ length: 9 }, (_, i) => `<rect x="${20 + i * 40}" y="${340 - (60 + (i * 47) % 160)}" width="30" height="${60 + (i * 47) % 160}" fill="${c}" opacity=".8"/>`).join(""),
  wave:    (c) => `<path d="M0 260 Q 50 200 100 260 T 200 260 T 300 260 T 400 260 V400 H0 Z" fill="${c}" opacity=".8"/><path d="M0 310 Q 50 250 100 310 T 200 310 T 300 310 T 400 310 V400 H0 Z" fill="${c}" opacity=".6"/>`,
  mountain:(c) => `<polygon points="40,320 160,140 220,230 270,170 360,320" fill="${c}" opacity=".9"/>`,
  stripes: (c) => Array.from({ length: 8 }, (_, i) => `<rect x="0" y="${30 + i * 44}" width="400" height="22" fill="${c}" opacity="${0.25 + (i % 4) * 0.15}"/>`).join(""),
  sun:     (c) => `<circle cx="200" cy="170" r="70" fill="${c}" opacity=".9"/><circle cx="200" cy="170" r="110" fill="none" stroke="${c}" stroke-width="8" opacity=".5"/>`,
};

const out = specs.map((sp, i) => {
  const id = `img-${String(i + 1).padStart(3, "0")}`;
  const file = `images/${id}.svg`;
  const dark = ["circle", "mountain"].includes(sp.shape);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${sp.colors[0]}"/><stop offset="1" stop-color="${sp.colors[1]}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/>${shapes[sp.shape](dark ? sp.colors[1] : "#ffffff")}<text x="200" y="384" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#000" opacity=".45">placeholder</text></svg>`;
  writeFileSync(new URL(`../${file}`, import.meta.url), svg);
  const mp = (sp.width * sp.height) / 1e6;
  const e = { id, file, prompt: sp.prompt, model: sp.model, width: sp.width, height: sp.height, steps: sp.steps, batch: sp.batch || 1 };
  if (sp.tier) e.tier = sp.tier;
  else e.wh = Number((IMG.kModel[sp.model] * mp * sp.steps + IMG.formulaBase).toPrecision(2));
  e.measured = sp.measured;
  e.complexity = sp.complexity;
  if (sp.note) e.note = sp.note;
  return e;
});

writeFileSync(new URL("../images.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(out.map((e) => `${e.id} ${e.model} ${e.width}x${e.height} ${e.steps}st -> ${e.wh ?? e.tier}`).join("\n"));
