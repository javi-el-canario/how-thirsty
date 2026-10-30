// Game 3 - Image Duel (reads images.json)
import { IMG } from "../../data-extra.js";
import { createPhraseGen, whToValue, formatValue, dropsText, verdictFor, isWater, fmtNum, round2, shuffle, pick } from "../engine.js";
import { getBest, saveBest } from "../storage.js";
import { h, clear, statusBar, resultBanner, shareText, shareUrl, phraseBox, reducedMotion } from "../ui.js";
import { rampFor } from "./higherlower.js";

export const id = "imageduel";
export const title = "Image Duel";
export const emoji = "🖼️";
export const blurb = "Two AI images. Which one cost more? (Hint: it's not about how fancy they look.)";

const BEST_KEY = "ht.best.imageduel";

// ------------------------------------------------------------------ pure logic (tested)
export const isBoss = (e) => e.boss === true || e.kind === "video";

// Wh for one image: explicit `wh`, else a tier (T0..T4), else the formula from SPEC 7.4 option C.
export function whOf(e) {
  if (typeof e.wh === "number" && e.wh > 0) return e.wh;
  if (e.tier && IMG.tiers[e.tier] !== undefined) return IMG.tiers[e.tier];
  const k = IMG.kModel[e.model] ?? IMG.kDefault;
  const mp = ((e.width || 1024) * (e.height || 1024)) / 1e6;
  return k * mp * (e.steps || 20) + IMG.formulaBase;
}

// images of the same subject (e.g. one concept drawn in four styles) pair as "same prompt"
const concept = (e) => e.concept || e.prompt;
const sameSettings = (a, b) => a.model === b.model && a.width === b.width && a.height === b.height && a.steps === b.steps && (a.batch || 1) === (b.batch || 1) && (a.tries || 1) === (b.tries || 1);

export function classify(a, b) {
  const ratio = Math.max(whOf(a), whOf(b)) / Math.min(whOf(a), whOf(b));
  if (ratio <= 1 + IMG.sameBand) return { kind: "same", ratio };
  if (ratio >= IMG.minRatio) return { kind: "diff", ratio };
  return { kind: "skip", ratio };
}

export function correctAnswer(left, right) {
  const c = classify(left, right);
  if (c.kind === "same") return "same";
  return whOf(right) > whOf(left) ? "more" : "less";
}

export function newRun() { return { score: 0, recent: [], round: 0 }; }

// Returns { left, right, type } or null.
export function pickPair(images, st, rng = Math.random) {
  if (images.length < 2) return null;
  const ramp = rampFor(st.score);
  const wantBoss = st.score >= IMG.bossMinStreak && rng() < IMG.bossChance && images.some(isBoss);
  const types = [pick(IMG.pairTypes, rng), ...shuffle(IMG.pairTypes, rng)];
  if (rng() < IMG.sameChance) types.unshift("sameSettings");
  const keepRecent = Math.min(IMG.recentItems, Math.floor(images.length / 3));
  const recent = st.recent.slice(-keepRecent);

  const typeOk = (type, a, b, c) => {
    if (type === "samePrompt") return concept(a) === concept(b) && c.kind !== "skip";
    if (type === "sameSettings") return concept(a) !== concept(b) && sameSettings(a, b) && c.kind === "same";
    return c.kind !== "skip";
  };
  const levels = [
    { ramp: true, recent: true, boss: true },
    { ramp: false, recent: true, boss: true },
    { ramp: false, recent: false, boss: true },
    { ramp: false, recent: false, boss: false },
  ];
  for (const lvl of levels) {
    // boss rounds pair clips with clips; normal rounds never contain a clip (until the last fallback level)
    const pool = images.filter((e) => (!lvl.boss || isBoss(e) === wantBoss) && (!lvl.recent || !recent.includes(e.id)));
    for (const type of types) {
      const cands = [];
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          const a = pool[i], b = pool[j];
          const c = classify(a, b);
          if (!typeOk(type, a, b, c)) continue;
          if (lvl.ramp && c.kind === "diff" && (c.ratio < ramp.min || c.ratio > ramp.max)) continue;
          cands.push([a, b]);
        }
      }
      if (cands.length) {
        const [a, b] = pick(cands, rng);
        return rng() < 0.5 ? { left: a, right: b, type } : { left: b, right: a, type };
      }
    }
  }
  return null;
}

function remember(st, pair) {
  st.recent.push(pair.left.id, pair.right.id);
  while (st.recent.length > IMG.recentItems * 2) st.recent.shift();
}

// One-liner shown on the reveal card.
export function oneLiner(left, right) {
  const wl = whOf(left), wr = whOf(right);
  const hi = wl >= wr ? left : right, lo = hi === left ? right : left;
  const ratio = Math.max(wl, wr) / Math.min(wl, wr);
  const x = fmtNum(ratio);
  if (left.complexity && right.complexity && left.complexity !== right.complexity) {
    const simple = left.complexity === "simple" ? left : right;
    const complex = simple === left ? right : left;
    if (whOf(simple) > whOf(complex) * IMG.minRatio) {
      return `Plot twist: the simple-looking picture cost ${fmtNum(whOf(simple) / whOf(complex))}× more. Cost depends on model, resolution and steps, not on how detailed the image is.`;
    }
  }
  if (ratio <= 1 + IMG.sameBand) {
    return sameSettings(left, right)
      ? "Different pictures, identical settings: about the same energy. Content doesn't change the bill, settings do."
      : "Different settings, but they happen to land on about the same cost.";
  }
  const pix = (hi.width * hi.height) / (lo.width * lo.height);
  const steps = (hi.steps || 1) / (lo.steps || 1);
  const bits = [];
  if (steps >= 1.25 || steps <= 0.8) bits.push(`${fmtNum(steps)}× the steps`);
  if (pix >= 1.25 || pix <= 0.8) bits.push(`${fmtNum(pix)}× the pixels`);
  if (hi.model !== lo.model) bits.push(`a different model (${hi.model} vs ${lo.model})`);
  if ((hi.batch || 1) !== (lo.batch || 1)) bits.push(`batch of ${hi.batch || 1} vs ${lo.batch || 1}`);
  if ((hi.tries || 1) !== (lo.tries || 1)) bits.push(`${hi.tries || 1} tries vs ${lo.tries || 1}`);
  const why = bits.length ? ` (${bits.join(", ")})` : "";
  if (left.concept && left.concept === right.concept && left.style && right.style) {
    return `Same subject, ${hi.style} vs ${lo.style}: the ${hi.style} one used ${x}× more${why}. Style matters mostly because harder looks need more retries.`;
  }
  return concept(left) === concept(right)
    ? `Same prompt, different settings: one used ${x}× more${why}.`
    : `One used ${x}× more than the other${why}. The picture's content doesn't matter much; the settings do.`;
}

// ------------------------------------------------------------------ view
let R = null, C = null, off = null, keyHandler = null, gen = null;
let images = null, loadError = null, st = null, pair = null;
let phase = "load", guess = null, ok = false, over = false, newBest = false, revealPhrase = null, anim = false;

export function mount(root, ctx) {
  R = root; C = ctx; gen = createPhraseGen(undefined, { unit: "photo" });
  off = ctx.subscribe(() => { if (R && phase !== "load") render(); });
  keyHandler = onKey;
  document.addEventListener("keydown", keyHandler);
  phase = "load"; images = null; loadError = null;
  renderMessage("Loading images…");
  fetch("images.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(`images.json: HTTP ${r.status}`); return r.json(); })
    .then((data) => {
      if (!R) return;
      if (!Array.isArray(data)) throw new Error("images.json must be a list");
      images = data.filter((e) => e && e.id && e.file && e.model);
      if (images.length < 2) throw new Error("images.json needs at least 2 entries");
      start();
    })
    .catch((err) => {
      if (!R) return;
      loadError = err;
      renderMessage("Couldn't load images.json. Make sure it exists next to index.html and that you're running a local server.", String(err.message || err));
    });
}

export function unmount() {
  if (off) off();
  if (keyHandler) document.removeEventListener("keydown", keyHandler);
  R = C = off = keyHandler = gen = pair = st = null;
}

function renderMessage(msg, detail) {
  clear(R);
  R.append(h("section", { class: "panel" }, h("h2", null, `${emoji} ${title}`), h("p", null, msg), detail ? h("p", { class: "muted" }, detail) : null));
}

function start() {
  gen.reset();
  st = newRun(); over = false; newBest = false;
  nextPair(true);
}

function nextPair(first) {
  pair = pickPair(images, st);
  if (!pair) { renderMessage("Not enough comparable images in images.json to build a pair (need two within 10% or at least 1.25× apart)."); return; }
  remember(st, pair);
  phase = "ask"; guess = null; revealPhrase = null; anim = true;
  render();
}

function onKey(e) {
  if (!R || phase === "load" || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  const t = e.target && e.target.tagName;
  if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
  if (phase === "ask") {
    const k = e.key.toLowerCase();
    if (e.key === "ArrowUp" || k === "m") { e.preventDefault(); answer("more"); }
    else if (e.key === "ArrowDown" || k === "l") { e.preventDefault(); answer("less"); }
    else if (e.key === "ArrowRight" || e.key === "=" || k === "s") { e.preventDefault(); answer("same"); }
  } else if (phase === "revealed" && e.key === "Enter" && t !== "BUTTON" && t !== "A") {
    e.preventDefault(); next();
  }
}

function answer(g) {
  if (phase !== "ask") return;
  guess = g;
  ok = g === correctAnswer(pair.left, pair.right);
  if (ok) { st.score++; C.sound("ok"); } else { over = true; C.sound("bad"); }
  newBest = saveBest(BEST_KEY, st.score) && st.score > 0;
  const bigger = whOf(pair.left) >= whOf(pair.right) ? pair.left : pair.right;
  revealPhrase = gen.phrase(whToValue(whOf(bigger), C.s), C.s);
  phase = "revealed";
  C.announce(`${ok ? "Correct." : "Wrong."} Left: ${formatValue(whToValue(whOf(pair.left), C.s), C.s)}. Right: ${formatValue(whToValue(whOf(pair.right), C.s), C.s)}. ${oneLiner(pair.left, pair.right)}`);
  render();
}

function next() {
  if (phase !== "revealed") return;
  if (over) { renderOver(); return; }
  st.round++;
  nextPair();
}

function media(e, label) {
  const alt = e.prompt || e.id;
  if (e.kind === "video" || /\.(webm|mp4)$/i.test(e.file)) {
    return h("video", { class: "duel-media", src: e.file, muted: true, loop: true, playsInline: true, autoplay: !reducedMotion(), controls: reducedMotion(), "aria-label": alt });
  }
  return h("img", { class: "duel-media", src: e.file, alt, loading: "eager", decoding: "async", width: 400, height: 400 });
}

function infoCard(e, side) {
  const s = C.s;
  const wh = whOf(e);
  const v = whToValue(wh, s);
  return h("div", { class: "img-info" },
    h("div", { class: "info-top" },
      h("strong", null, `${side}: ${formatValue(v, s)}`),
      h("span", { class: `badge ${e.measured ? "measured" : "estimated"}` }, e.measured ? "Measured" : "Estimated")),
    isWater(s) && v <= 100 ? h("div", { class: "val-sub" }, `≈ ${dropsText(v)}`) : null,
    h("dl", { class: "info-dl" },
      h("dt", null, "Model"), h("dd", null, e.model),
      h("dt", null, "Resolution"), h("dd", null, `${e.width}×${e.height}`),
      e.steps ? [h("dt", null, "Steps"), h("dd", null, `${e.steps}${(e.batch || 1) > 1 ? ` · batch of ${e.batch}` : ""}`)] : null,
      e.style ? [h("dt", null, "Style"), h("dd", null, e.style)] : null,
      e.tries ? [h("dt", null, "Tries"), h("dd", null, `${e.tries} ${e.tries === 1 ? "generation" : "generations"}`)] : null,
      h("dt", null, "Energy"), h("dd", null, `${fmtNum(wh)} Wh`)),
    e.note ? h("p", { class: "info-note" }, `💡 ${e.note}`) : null);
}

function render() {
  clear(R);
  const s = C.s;
  const revealed = phase === "revealed";
  const wl = whOf(pair.left), wr = whOf(pair.right);
  const same = Math.max(wl, wr) / Math.min(wl, wr) <= 1 + IMG.sameBand;
  // green halo on the bigger one, red on the smaller one (whatever the player picked)
  const halo = (w) => (!revealed ? "" : same ? " halo-same" : w === Math.max(wl, wr) ? " halo-hi" : " halo-lo");
  const card = (e, side, cname, w) => h("article", { class: `card duel-card img-card ${cname}${anim ? (side === "Left" ? " enter-left" : " enter-right") : ""}${halo(w)}` },
    h("div", { class: "card-tag" }, side),
    media(e, side),
    revealed ? infoCard(e, side) : null);

  // the three answers stay on screen after the reveal: the right one lights up
  const correct = revealed ? correctAnswer(pair.left, pair.right) : null;
  const answerBtn = (value, label, cls, aria) => {
    const state = !revealed ? "" : value === correct ? " is-correct" : value === guess ? " is-wrong" : " is-dim";
    const mark = revealed && value === correct ? "✔ " : revealed && value === guess ? "✖ " : "";
    return h("button", { class: `btn btn-big ${cls}${state}`, disabled: revealed, onclick: () => answer(value), "aria-label": aria }, mark + label);
  };
  const triple = h("div", { class: "triple" },
    answerBtn("less", "▼ Less", "btn-down", "Less: the right image uses less"),
    answerBtn("more", "▲ More", "btn-up", "More: the right image uses more"),
    answerBtn("same", "＝ About the same", "btn-same", "About the same, within 10 percent"));

  const actions = h("div", { class: "actions" }, triple);
  if (revealed) {
    actions.append(
      resultBanner(ok, ok ? "Correct!" : "Wrong — game over."),
      h("p", { class: "one-liner" }, oneLiner(pair.left, pair.right)),
      phraseBox(revealPhrase),
      h("button", { class: "btn btn-primary btn-big", id: "img-next", onclick: next }, over ? "See results ▶" : "Next ▶"));
  } else {
    actions.append(h("p", { class: "hint" }, "Keys: ↑ more · ↓ less · → about the same"));
  }

  R.append(h("section", { class: "game imageduel" },
    statusBar({ score: st.score, best: Math.max(getBest(BEST_KEY), st.score), level: st.score / 25 }),
    h("p", { class: "question one-line" }, window.innerWidth < 640
      ? ["Is the ", h("strong", null, "right"), ` one more, less or the same ${isWater(s) ? "water" : "electricity"}?`]
      : ["Does the ", h("strong", null, "right"), ` image use more, less, or the same ${isWater(s) ? "water" : "electricity"} as the left?`]),
    h("div", { class: "duel images" }, card(pair.left, "Left", "anchor", wl), h("div", { class: "vs", "aria-hidden": "true" }, "VS"), card(pair.right, "Right", "challenger", wr)),
    actions));
  anim = false;
  const b = document.getElementById("img-next");
  if (b) b.focus({ preventScroll: true });
}

function renderOver() {
  phase = "over";
  clear(R);
  const s = C.s;
  const status = h("p", { class: "muted", role: "status" });
  const msg = [
    `${isWater(s) ? "💧" : "⚡"} How Thirsty? — Image Duel`,
    `Streak: ${st.score} 🔥  (best: ${getBest(BEST_KEY)})`,
    "Image cost depends on model, resolution and steps — not on how fancy the picture looks.",
    `Play: ${shareUrl()}`,
  ].join("\n");
  R.append(h("section", { class: "panel over" },
    h("h2", null, "Game over"),
    h("div", { class: "big-score" }, h("span", { class: "big-n" }, String(st.score)), h("span", null, "in a row 🔥")),
    h("p", null, newBest ? "🏆 New personal best!" : `Personal best: ${getBest(BEST_KEY)}`),
    h("p", { class: "one-liner" }, oneLiner(pair.left, pair.right)),
    h("div", { class: "row-buttons" },
      h("button", { class: "btn btn-primary btn-big", onclick: start }, "Play again"),
      h("button", { class: "btn btn-big", onclick: async () => { const r = await shareText(msg); status.textContent = r === "copied" ? "Copied!" : r === "shared" ? "Shared!" : "Couldn't share here."; } }, "Share")),
    status));
  C.announce(`Game over. Streak ${st.score}.`);
}
