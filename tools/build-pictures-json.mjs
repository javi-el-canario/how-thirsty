// Builds realorai.json for "Real or AI?" from the pictures in images/real and images/ai.
// Run: node tools/build-pictures-json.mjs
//
// Pictures are NOT paired: every round the game picks one real and one AI picture at random.
// Files:   images/real/NNN.webp   images/ai/NNN.webp   (also .png / .jpg)
// Details: tools/pictures-info.json
//   { "defaults": { "real": {...}, "ai": {...} },
//     "real": { "007": { "credit": "...", "subject": "..." } },
//     "ai":   { "012": { "prompt": "...", "tries": 3, "tell": "what gives it away" } } }
// Anything missing falls back to "defaults".
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const EXTS = ["webp", "png", "jpg", "jpeg", "avif"];
const FAST_WH = 0.6;                         // assumed Wh per generation (Gemini fast image model): an estimate
const MIN_PER_SIDE = 6;                      // keep in sync with REALAI.minPerSideToShow in data-extra.js

const info = existsSync(new URL("tools/pictures-info.json", root)) ? JSON.parse(readFileSync(new URL("tools/pictures-info.json", root), "utf8")) : {};
const defaults = { real: {}, ai: {}, ...(info.defaults || {}) };

function dims(buf, ext) {
  try {
    if (ext === "png") return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (ext === "jpg" || ext === "jpeg") {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (ext === "webp" && buf.toString("ascii", 0, 4) === "RIFF") {
      const kind = buf.toString("ascii", 12, 16);
      if (kind === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
      if (kind === "VP8L") { const b = buf.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) }; }
      if (kind === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    }
  } catch (e) { /* fall through */ }
  return null;
}

const warnings = [];
function scan(kind) {
  const dir = new URL(`images/${kind}/`, root);
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const out = [];
  for (const f of files.sort()) {
    const m = f.match(/^(\d+)\.(\w+)$/);
    if (!m || !EXTS.includes(m[2].toLowerCase())) continue;
    const nn = m[1].padStart(3, "0");
    const meta = { ...(defaults[kind] || {}), ...((info[kind] || {})[nn] || {}) };
    const ext = m[2].toLowerCase();
    const d = dims(readFileSync(new URL(f, dir)), ext);
    if (d && Math.abs(d.w / d.h - 1) > 0.04) warnings.push(`${kind}/${f}: not square (${d.w}x${d.h}): run tools/prepare-images.py so real and AI pictures have the same shape`);
    const item = { id: `${kind === "real" ? "r" : "a"}${nn}`, file: `images/${kind}/${f}` };
    if (kind === "real") {
      Object.assign(item, ...["subject", "credit", "source", "license", "url"].filter((k) => meta[k]).map((k) => ({ [k]: meta[k] })));
      if (!meta.credit && !meta.source) warnings.push(`real/${f}: no credit (add it to "defaults.real" or to this picture in pictures-info.json)`);
    } else {
      const tries = Number.isFinite(meta.tries) && meta.tries > 0 ? meta.tries : 1;
      Object.assign(item, { tool: meta.tool || "Gemini", tries, wh: Number.isFinite(meta.wh) ? meta.wh : Number((FAST_WH * tries).toFixed(2)) });
      if (meta.prompt) item.prompt = meta.prompt;
      if (meta.tell) item.tell = meta.tell;
      if (meta.subject) item.subject = meta.subject;
    }
    out.push(item);
  }
  return out;
}

const real = scan("real"), ai = scan("ai");
console.log(`real pictures: ${real.length}, AI pictures: ${ai.length}  (a game lasts as many rounds as the smaller number)`);
if (warnings.length) console.log("\nWarnings:\n - " + warnings.join("\n - "));
if (real.length + ai.length === 0) { console.log("\nNo pictures found: realorai.json left unchanged."); process.exit(0); }
writeFileSync(new URL("realorai.json", root), JSON.stringify({ real, ai }, null, 2) + "\n");
const ready = real.length >= MIN_PER_SIDE && ai.length >= MIN_PER_SIDE;
console.log(`\nwrote realorai.json. ${ready ? "The game is visible on the home page." : `The game stays hidden until there are at least ${MIN_PER_SIDE} real and ${MIN_PER_SIDE} AI pictures.`}`);
