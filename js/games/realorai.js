// Game 6 - Real or AI?  Every round: one random real picture vs one random AI picture.
// A picture never comes back in the same game. Data: realorai.json { real: [...], ai: [...] }.
import { REALAI } from "../../data-extra.js";
import { createPhraseGen, whToValue, formatValue, dropsText, isWater, shuffle } from "../engine.js";
import { getBest, saveBest, load, save } from "../storage.js";
import { h, clear, statusBar, resultBanner, shareText, shareUrl, phraseBox } from "../ui.js";

export const id = "realorai";
export const title = "Real or AI?";
export const emoji = "🕵️";
export const blurb = "One picture is real, the other was made by AI. Can you tell which?";

// ------------------------------------------------------------------ pure logic (tested in Node)
export const validPicture = (p) => !!(p && p.id && p.file);

export function newRun(real, ai, livesOn, rng = Math.random) {
  return {
    livesOn, lives: livesOn ? REALAI.lives : 1, score: 0, round: 0, over: false, done: false,
    realQ: shuffle(real.filter(validPicture), rng), aiQ: shuffle(ai.filter(validPicture), rng),
    sides: [],
  };
}
export const totalRounds = (st) => st.round + Math.min(st.realQ.length, st.aiQ.length);

// Draws the next round (one real + one AI picture, none used before) or returns null when a pool is empty.
export function drawRound(st, rng = Math.random) {
  if (!st.realQ.length || !st.aiQ.length) return null;
  const real = st.realQ.pop(), ai = st.aiQ.pop();
  let aiSide = rng() < 0.5 ? "left" : "right";
  const last = st.sides.slice(-REALAI.maxSameSide);
  if (last.length === REALAI.maxSameSide && last.every((s) => s === aiSide)) aiSide = aiSide === "left" ? "right" : "left";
  st.sides.push(aiSide);
  st.round++;
  return { real, ai, aiSide };
}

// ------------------------------------------------------------------ view
let R = null, C = null, off = null, keyHandler = null, gen = null;
let pool = null, st = null, cur = null, phase = "load";
let livesOn = false;
let picked = null, ok = false, newBest = false, revealPhrase = null, anim = false;

const bestKey = () => `ht.best.realorai${livesOn ? "-lives" : ""}`;
const demo = () => { try { return /[?&]demo(=|&|$)/.test(location.search); } catch (e) { return false; } };

export function mount(root, ctx) {
  R = root; C = ctx; gen = createPhraseGen(undefined, { unit: "photo" });
  const saved = load("ht.cfg.realorai", null);
  if (saved) livesOn = !!saved.lives;
  off = ctx.subscribe(() => { if (R && phase !== "load" && phase !== "start" && cur) render(); });
  keyHandler = onKey;
  document.addEventListener("keydown", keyHandler);
  phase = "load";
  renderMessage("Loading pictures…");
  fetch(demo() ? "realorai.demo.json" : "realorai.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(`realorai.json: HTTP ${r.status}`); return r.json(); })
    .then((data) => {
      if (!R) return;
      const real = (data.real || []).filter(validPicture), ai = (data.ai || []).filter(validPicture);
      if (real.length < 2 || ai.length < 2) throw new Error("realorai.json needs at least 2 real and 2 AI pictures");
      pool = { real, ai };
      renderStart();
    })
    .catch((err) => {
      if (!R) return;
      renderMessage("Couldn't load the pictures. Make sure realorai.json exists next to index.html and that you're running a local server.", String(err.message || err));
    });
}

export function unmount() {
  if (off) off();
  if (keyHandler) document.removeEventListener("keydown", keyHandler);
  R = C = off = keyHandler = gen = cur = st = null;
}

function renderMessage(msg, detail) {
  clear(R);
  R.append(h("section", { class: "panel" }, h("h2", null, `${emoji} ${title}`), h("p", null, msg), detail ? h("p", { class: "muted" }, detail) : null));
}

function onKey(e) {
  if (!R || phase === "load" || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  const t = e.target && e.target.tagName;
  if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
  if (phase === "ask") {
    if (e.key === "ArrowLeft") { e.preventDefault(); pick("left"); }
    else if (e.key === "ArrowRight") { e.preventDefault(); pick("right"); }
  } else if (phase === "revealed" && e.key === "Enter" && t !== "BUTTON" && t !== "A") {
    e.preventDefault(); next();
  }
}

// ---- start screen
function renderStart() {
  phase = "start"; cur = null;
  clear(R);
  const rounds = Math.min(pool.real.length, pool.ai.length);
  const best = h("p", { class: "muted" });
  const updateBest = () => { best.textContent = `Your best: ${getBest(bestKey())} in a row`; };
  R.append(h("section", { class: "panel" },
    h("h2", null, `${emoji} ${title}`),
    h("p", null, "Two pictures, one of them made by AI. Tap the one you think is ", h("strong", null, "AI-generated"),
      `. No picture comes back in the same game: ${rounds} rounds if you survive that long.`),
    h("label", { class: "switch-row" },
      h("input", { type: "checkbox", checked: livesOn, onchange: (e) => { livesOn = e.target.checked; save("ht.cfg.realorai", { lives: livesOn }); updateBest(); } }),
      h("span", null, `Give me ${REALAI.lives} lives`)),
    best,
    h("button", { class: "btn btn-primary btn-big", onclick: start }, "Start"),
    h("p", { class: "hint" }, "Keys: ← left picture · → right picture · Enter continues")));
  updateBest();
}

function start() {
  gen.reset();
  st = newRun(pool.real, pool.ai, livesOn);
  newBest = false;
  nextRound();
}

function nextRound() {
  cur = drawRound(st);
  if (!cur) return renderOver(true);
  phase = "ask"; picked = null; revealPhrase = null; anim = true;
  render();
}

function pick(side) {
  if (phase !== "ask") return;
  picked = side;
  ok = side === cur.aiSide;
  if (ok) { st.score++; C.sound("ok"); }
  else { C.sound("bad"); if (st.livesOn) st.lives--; if (!st.livesOn || st.lives <= 0) st.over = true; }
  if (saveBest(bestKey(), st.score)) newBest = st.score > 0;
  const v = whToValue(cur.ai.wh || 0, C.s);
  revealPhrase = v > 0 ? gen.phrase(v, C.s) : null;
  phase = "revealed";
  C.announce(`${ok ? "Correct." : "Wrong."} The ${cur.aiSide} picture was the AI one.${cur.ai.tell ? " " + cur.ai.tell : ""}`);
  render();
}

function next() {
  if (phase !== "revealed") return;
  if (st.over) return renderOver(false);
  nextRound();
}

// ---- play
function credit(real) {
  const bits = [real.credit, real.source].filter((x, i, a) => x && a.indexOf(x) === i).join(" · ");
  return bits ? `Real picture: ${bits}${real.license ? ` (${real.license})` : ""}` : "Real picture";
}

function render() {
  if (!cur) return;
  clear(R);
  const s = C.s;
  const revealed = phase === "revealed";
  const aiValue = whToValue(cur.ai.wh || 0, s);

  const card = (side) => {
    const isAi = cur.aiSide === side;
    const src = isAi ? cur.ai : cur.real;
    const state = revealed ? (picked === side ? (ok ? " halo-hi" : " halo-lo") : "") : "";
    return h("button", {
      type: "button", class: `card pick-card${revealed ? " revealed" : ""}${state}${anim ? (side === "left" ? " enter-left" : " enter-right") : ""}`,
      disabled: revealed, onclick: () => pick(side), "aria-label": `Pick the ${side} picture as the AI one`,
    },
      h("img", { class: "duel-media", src: src.file, alt: `${side === "left" ? "Left" : "Right"} picture`, loading: "eager", decoding: "async" }),
      revealed ? h("span", { class: `badge-real-ai ${isAi ? "is-ai" : "is-real"}` }, isAi ? "🤖 AI" : "📷 Real") : null,
      revealed
        ? h("span", { class: "pick-caption" }, isAi
          ? `Made with ${src.tool || "AI"}${src.tries ? ` · ${src.tries} ${src.tries === 1 ? "try" : "tries"}` : ""} · ≈ ${formatValue(aiValue, s)}${isWater(s) && aiValue <= 100 ? ` (${dropsText(aiValue)})` : ""}`
          : credit(src))
        : null);
  };

  const actions = h("div", { class: "actions" });
  const last = !st.realQ.length || !st.aiQ.length;
  if (revealed) {
    actions.append(...[
      resultBanner(ok, ok ? "Correct!" : (st.over ? "Wrong — game over." : `Not quite — ${st.lives} ${st.lives === 1 ? "life" : "lives"} left.`)),
      cur.ai.tell ? h("p", { class: "one-liner" }, `🔎 ${cur.ai.tell}`) : null,
      phraseBox(revealPhrase),
      h("button", { class: "btn btn-primary btn-big", id: "ra-next", onclick: next }, st.over || last ? "See results ▶" : "Next ▶"),
    ].filter(Boolean));
  } else {
    actions.append(h("p", { class: "hint" }, "Keys: ← left · → right"));
  }

  R.append(h("section", { class: "game realorai" },
    statusBar({ score: st.score, best: Math.max(getBest(bestKey()), st.score), lives: st.livesOn ? st.lives : null, maxLives: REALAI.lives, level: st.score / REALAI.gaugeMax }),
    h("p", { class: "question one-line" }, window.innerWidth < 640
      ? ["Which one is ", h("strong", null, "AI"), "?"]
      : ["Which picture was made by ", h("strong", null, "AI"), "?"],
    h("span", { class: "round-count" }, ` ${st.round}/${totalRounds(st)}`)),
    h("div", { class: "duel images" }, card("left"), h("div", { class: "vs", "aria-hidden": "true" }, "VS"), card("right")),
    actions));
  anim = false;
  const b = document.getElementById("ra-next");
  if (b) b.focus({ preventScroll: true });
}

// ---- game over (or all pictures seen)
function renderOver(finished) {
  phase = "over";
  clear(R);
  const status = h("p", { class: "muted", role: "status" });
  const msg = [
    `${isWater(C.s) ? "💧" : "⚡"} How Thirsty? — Real or AI?`,
    `${st.score} correct${finished ? ` out of ${st.round}` : " in a row"} 🔥  (best: ${getBest(bestKey())})`,
    `Play: ${shareUrl()}`,
  ].join("\n");
  const all = finished && st.score === st.round;
  R.append(h("section", { class: "panel over" },
    h("h2", null, finished ? "You saw every picture" : "Game over"),
    h("div", { class: "big-score" }, h("span", { class: "big-n" }, String(st.score)), h("span", null, finished ? `of ${st.round} 🔥` : "in a row 🔥")),
    h("p", null, all ? "🏆 Perfect: you never got fooled!" : newBest ? "🏆 New personal best!" : `Personal best: ${getBest(bestKey())}`),
    h("div", { class: "row-buttons" },
      h("button", { class: "btn btn-primary btn-big", onclick: start }, "Play again"),
      h("button", { class: "btn btn-big", onclick: async () => { const r = await shareText(msg); status.textContent = r === "copied" ? "Copied!" : r === "shared" ? "Shared!" : "Couldn't share here."; } }, "Share"),
      h("button", { class: "btn", onclick: renderStart }, "Back")),
    status));
  C.announce(finished ? `All pictures seen. You got ${st.score} of ${st.round}.` : `Game over. Your streak was ${st.score}.`);
}
