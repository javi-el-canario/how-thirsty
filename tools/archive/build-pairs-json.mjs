// Builds pairs.json for "Real or AI?" from the pictures in images/pairs and tools/pairs-info.json.
// Run: node tools/build-pairs-json.mjs
//
// How pairs are found: any number NN that has BOTH images/pairs/NN-real.<ext> and images/pairs/NN-ai.<ext>.
// What each pair says about itself (difficulty, tell, credit...) lives in tools/pairs-info.json, keyed by NN.
// The script also writes tools/PAIRS-STATUS.md: a table of every number it found, so you always know where you are.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const dir = new URL("images/pairs/", root);
const EXTS = ["webp", "png", "jpg", "jpeg", "avif"];
const FAST_WH = 0.6;                       // assumed Wh per generation (Gemini fast image model), an estimate
const MIN_TO_SHOW = 6;                     // keep in sync with REALAI.minPairsToShow in data-extra.js

const readJson = (rel, fallback) => (existsSync(new URL(rel, root)) ? JSON.parse(readFileSync(new URL(rel, root), "utf8")) : fallback);
const info = readJson("tools/pairs-info.json", {});
const oldCredits = readJson("tools/pairs-credits.json", {});     // legacy file, still honoured

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

// ---- scan the folder
const files = existsSync(dir) ? readdirSync(dir) : [];
const found = {};                                           // NN -> { real, ai }
for (const f of files) {
  const m = f.match(/^(\d+)-(real|ai)\.(\w+)$/i);
  if (!m || !EXTS.includes(m[3].toLowerCase())) continue;
  const nn = m[1].padStart(2, "0");
  (found[nn] ||= {})[m[2].toLowerCase()] = f;
}
const ids = [...new Set([...Object.keys(found), ...Object.keys(info).filter((k) => !k.startsWith("_"))])].sort((a, b) => Number(a) - Number(b));

const out = [], rows = [], warnings = [];
for (const nn of ids) {
  const f = found[nn] || {};
  const meta = info[nn] || {};
  const old = oldCredits[nn] || {};
  const complete = !!(f.real && f.ai);
  const notes = [];
  if (!f.real) notes.push("real picture missing");
  if (!f.ai) notes.push("AI picture missing");
  if (complete) {
    if (!info[nn]) notes.push("no entry in pairs-info.json (defaults used)");
    const credit = meta.credit || old.credit, source = meta.source || old.source;
    if (!credit && !source) notes.push("no credit");
    const dr = dims(readFileSync(new URL(f.real, dir)), f.real.split(".").pop().toLowerCase());
    const da = dims(readFileSync(new URL(f.ai, dir)), f.ai.split(".").pop().toLowerCase());
    if (dr && da && Math.abs(dr.w / dr.h - da.w / da.h) > 0.04) notes.push(`different shapes (${dr.w}x${dr.h} vs ${da.w}x${da.h})`);
    const difficulty = [1, 2, 3].includes(meta.difficulty) ? meta.difficulty : 2;
    const tries = Number.isFinite(meta.tries) && meta.tries > 0 ? meta.tries : 1;
    const wh = Number.isFinite(meta.wh) ? meta.wh : Number((FAST_WH * tries).toFixed(2));
    out.push({
      id: `p${nn}`, subject: meta.subject || `Picture ${nn}`, category: meta.category === "art" ? "art" : "photo", difficulty,
      ...(meta.tell ? { tell: meta.tell } : {}),
      real: {
        file: `images/pairs/${f.real}`,
        ...(credit ? { credit } : {}), ...(source ? { source } : {}),
        ...((meta.license || old.license) ? { license: meta.license || old.license } : {}),
        ...((meta.url || old.url) ? { url: meta.url || old.url } : {}),
      },
      ai: { file: `images/pairs/${f.ai}`, tool: meta.tool || "Gemini", ...(meta.prompt ? { prompt: meta.prompt } : {}), tries, wh },
    });
    rows.push({ nn, state: "ready", meta, difficulty, tries, wh, notes });
  } else {
    rows.push({ nn, state: "incomplete", meta, difficulty: meta.difficulty, tries: meta.tries, wh: meta.wh, notes });
  }
}

// ---- status table
const cnt = (d) => out.filter((x) => x.difficulty === d).length;
const md = [
  "# Real or AI? - status", "",
  `Ready pairs: **${out.length}** (easy ${cnt(1)}, medium ${cnt(2)}, hard ${cnt(3)}). The game appears on the home page from ${MIN_TO_SHOW} ready pairs.`, "",
  "| # | State | Type | Difficulty | Subject | Tries | Wh | Notes |", "|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.nn} | ${r.state} | ${r.meta.category || "photo"} | ${r.difficulty ?? "-"} | ${r.meta.subject || ""} | ${r.tries ?? "-"} | ${r.wh ?? "-"} | ${r.notes.join("; ")} |`),
  "", "Difficulty: 1 = easy (the AI picture gives itself away), 2 = medium, 3 = hard (very convincing).", "",
];
writeFileSync(new URL("tools/PAIRS-STATUS.md", root), md.join("\n"));

console.log(`pairs found: ${rows.length}, ready: ${out.length} (easy ${cnt(1)}, medium ${cnt(2)}, hard ${cnt(3)})`);
for (const r of rows) if (r.notes.length) console.log(`  ${r.nn}: ${r.notes.join("; ")}`);
if (!out.length) { console.log("\nNo complete pair yet: pairs.json left unchanged. (see tools/PAIRS-STATUS.md)"); process.exit(0); }
writeFileSync(new URL("pairs.json", root), JSON.stringify(out, null, 2) + "\n");
console.log(`\nwrote pairs.json. Status table: tools/PAIRS-STATUS.md${out.length < MIN_TO_SHOW ? `  (the game stays hidden until ${MIN_TO_SHOW} pairs are ready)` : ""}`);
