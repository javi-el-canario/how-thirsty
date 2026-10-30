// Builds images.json from tools/image-plan.json + the files you put in /images.
// Run: node tools/build-images-json.mjs
//  - only images whose file exists are included (so you can add them in batches)
//  - width/height are read from the file itself (png, jpg, webp)
//  - images.json is left untouched until at least 2 real images are found
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const plan = JSON.parse(readFileSync(new URL("tools/image-plan.json", root), "utf8"));
const EXTS = ["webp", "png", "jpg", "jpeg", "avif"];

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

const found = [], missing = [];
for (const e of plan.images) {
  const ext = EXTS.find((x) => existsSync(new URL(`images/${e.id}.${x}`, root)));
  if (!ext) { missing.push(e.id); continue; }
  const file = `images/${e.id}.${ext}`;
  const d = dims(readFileSync(new URL(file, root)), ext);
  found.push({ ...e, file, width: d ? d.w : 1024, height: d ? d.h : 1024, batch: 1 });
}

console.log(`found ${found.length} images, missing ${missing.length}${missing.length ? ` (${missing.join(", ")})` : ""}`);
if (found.length < 2) {
  console.log("Not enough real images yet: images.json left unchanged.");
  process.exit(0);
}
// key order: tidy file
const out = found.map((e) => ({
  id: e.id, file: e.file, prompt: e.prompt, ...(e.concept ? { concept: e.concept } : {}), ...(e.style ? { style: e.style } : {}), model: e.model, width: e.width, height: e.height,
  tries: e.tries, batch: e.batch, wh: e.wh, measured: e.measured,
  complexity: e.complexity, ...(e.note ? { note: e.note } : {}),
}));
writeFileSync(new URL("images.json", root), JSON.stringify(out, null, 2) + "\n");
console.log(`wrote images.json with ${out.length} entries`);
