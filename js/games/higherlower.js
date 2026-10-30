// Game 1 - Higher or Lower
import { PROMPTS } from "../../data.js";
import { HL } from "../../data-extra.js";
import {
  createPhraseGen, promptValue, refsFor, formatValue, dropsText, verdictFor, capFirst, isWater,
  pick, shuffle, exchangeRate, pedalText,
} from "../engine.js";
import { load, save, getBest, saveBest } from "../storage.js";
import { h, clear, animate, shareText, shareUrl, statusBar, resultBanner, phraseBox } from "../ui.js";

export const id = "higherlower";
export const title = "Higher or Lower";
export const emoji = "⚖️";
export const blurb = "Does the next prompt use more or less than this one? How long can you last?";

// ------------------------------------------------------------------ pure game logic (tested in Node)
export const rampFor = (streak) => HL.ramp.find((r) => streak <= r.upTo) || HL.ramp[HL.ramp.length - 1];
export const ratioOf = (a, b) => Math.max(a, b) / Math.min(a, b);
const modeCats = (modeId) => (HL.modes.find((m) => m.id === modeId) || {}).cats || null;

export function promptItem(p, s) {
  return { id: p.id, emoji: p.emoji, text: p.text, cat: p.cat, boss: !!p.boss, wh: p.wh, val: promptValue(p, s) };
}
export function refItem(r) {
  return { id: "ref:" + r.id, refId: r.id, emoji: r.emoji, text: capFirst(r.one), cat: "ref", val: r.v, isRef: true };
}

export function newRun(mode, livesOn) {
  return {
    mode, livesOn, lives: livesOn ? HL.lives : 1, score: 0, round: 0,
    recent: [], recentRefs: [], cats: [], anchor: null, challenger: null, over: false,
  };
}

function poolFor(st, wantBoss) {
  const cats = modeCats(st.mode);
  return PROMPTS.filter((p) => (!cats || cats.includes(p.cat)) && !!p.boss === wantBoss);
}

function wantsBoss(st, rng) {
  return st.score >= HL.bossMinStreak && rng() < HL.bossChance && poolFor(st, true).length > 0;
}

function catOk(st, cat) {
  const last = st.cats.slice(-HL.maxSameCat);
  return !(last.length === HL.maxSameCat && last.every((c) => c === cat));
}

// Picks the next challenger for a fixed anchor (all modes except "reference").
export function pickChallenger(st, s, rng = Math.random) {
  const a = st.anchor.val;
  const ramp = rampFor(st.score);
  const boss = wantsBoss(st, rng);
  const pools = [];
  if (boss) pools.push(poolFor(st, true));
  pools.push(poolFor(st, false));
  const levels = [
    // the category rule is a hard rule, the ramp is a target: relax the ramp first
    (p, r) => !st.recent.includes(p.id) && catOk(st, p.cat) && r >= ramp.min && r <= ramp.max,
    (p, r) => !st.recent.includes(p.id) && catOk(st, p.cat) && r >= HL.minRatio,
    (p, r) => catOk(st, p.cat) && r >= HL.minRatio,
    (p, r) => !st.recent.includes(p.id) && r >= HL.minRatio,
    (p, r) => r >= HL.minRatio,
  ];
  const preferUp = rng() < 0.5;
  for (const ok of levels) {
    for (const pool of pools) {
      const c = pool
        .filter((p) => p.id !== st.anchor.id)
        .map((p) => ({ p, v: promptValue(p, s) }))
        .filter((x) => ok(x.p, ratioOf(x.v, a)));
      if (!c.length) continue;
      const dir = c.filter((x) => (x.v > a) === preferUp);
      return promptItem(pick(dir.length ? dir : c, rng).p, s);
    }
  }
  // Last resort (the mode's own pool has nothing guessable): any non-boss prompt, then anything.
  for (const pool of [PROMPTS.filter((p) => !p.boss), PROMPTS]) {
    const c = pool.filter((p) => p.id !== st.anchor.id && ratioOf(promptValue(p, s), a) >= HL.minRatio);
    if (c.length) return promptItem(pick(c, rng), s);
  }
  return null;
}

// "Reference duel": a fresh (reference, prompt) pair every round.
export function pickRefPair(st, s, rng = Math.random) {
  const ramp = rampFor(st.score);
  const boss = wantsBoss(st, rng);
  const pools = [];
  if (boss) pools.push(poolFor(st, true));
  pools.push(poolFor(st, false));
  const refs = refsFor(s);
  const levels = [
    (p, rf, r) => !st.recent.includes(p.id) && !st.recentRefs.includes(rf.id) && catOk(st, p.cat) && r >= ramp.min && r <= ramp.max,
    (p, rf, r) => !st.recent.includes(p.id) && !st.recentRefs.includes(rf.id) && catOk(st, p.cat) && r >= HL.minRatio,
    (p, rf, r) => !st.recent.includes(p.id) && catOk(st, p.cat) && r >= HL.minRatio,
    (p, rf, r) => !st.recent.includes(p.id) && r >= HL.minRatio,
    (p, rf, r) => r >= HL.minRatio,
  ];
  const preferUp = rng() < 0.5;       // prompt higher than the reference?
  for (const ok of levels) {
    for (const pool of pools) {
      const options = [];
      for (const p of shuffle(pool, rng)) {
        const v = promptValue(p, s);
        const rs = refs.filter((rf) => ok(p, rf, ratioOf(v, rf.v)));
        if (rs.length) options.push({ p, v, rs });
      }
      if (!options.length) continue;
      const o = pick(options, rng);
      const dir = o.rs.filter((rf) => (o.v > rf.v) === preferUp);
      const rf = pick(dir.length ? dir : o.rs, rng);
      return { anchor: refItem(rf), challenger: promptItem(o.p, s) };
    }
  }
  return null;
}

function remember(st, item) {
  if (item.isRef) {
    st.recentRefs.push(item.refId);
    while (st.recentRefs.length > 6) st.recentRefs.shift();
    return;
  }
  st.recent.push(item.id);
  st.cats.push(item.cat);
  while (st.recent.length > HL.recentItems) st.recent.shift();
  while (st.cats.length > HL.maxSameCat) st.cats.shift();
}

// Sets st.anchor / st.challenger for the first round.
export function startRun(st, s, rng = Math.random) {
  if (st.mode === "reference") {
    const pair = pickRefPair(st, s, rng);
    st.anchor = pair.anchor; st.challenger = pair.challenger;
    remember(st, st.anchor); remember(st, st.challenger);
    return st;
  }
  const cats = modeCats(st.mode);
  const first = pick(PROMPTS.filter((p) => !p.boss && (!cats || cats.includes(p.cat))), rng);
  st.anchor = promptItem(first, s);
  remember(st, st.anchor);
  st.challenger = pickChallenger(st, s, rng);
  remember(st, st.challenger);
  return st;
}

// Moves on after a round.
export function advance(st, s, rng = Math.random) {
  st.round++;
  if (st.mode === "reference") {
    const pair = pickRefPair(st, s, rng);
    st.anchor = pair.anchor; st.challenger = pair.challenger;
    remember(st, st.anchor); remember(st, st.challenger);
  } else {
    st.anchor = st.challenger;
    st.challenger = pickChallenger(st, s, rng);
    remember(st, st.challenger);
  }
  return st;
}

// Re-computes values after a settings change (units, resource, x4 toggle).
function refreshValues(st, s, rng) {
  const re = (it) => {
    if (!it) return it;
    if (it.isRef) {
      const r = refsFor(s).find((x) => x.id === it.refId);
      return r ? refItem(r) : null;
    }
    return { ...it, val: promptValue({ wh: it.wh }, s) };
  };
  st.anchor = re(st.anchor);
  st.challenger = re(st.challenger);
  if (!st.anchor || !st.challenger) {            // reference vanished (resource switched)
    const pair = pickRefPair(st, s, rng);
    st.anchor = pair.anchor; st.challenger = pair.challenger;
  }
}

// ------------------------------------------------------------------ view
let R = null, C = null, st = null, gen = null, phase = "start";
let cancelAnim = null, offSettings = null, keyHandler = null;
let cfg = { mode: "classic", lives: false };
let anim = false;
let revealPhrase = null, anchorPhrase = null, lastGuess = null, wasCorrect = false, newBest = false;
let valEl = null;

const bestKey = () => `ht.best.higherlower.${cfg.mode}${cfg.lives ? "-lives" : ""}`;
const resWord = (s) => (isWater(s) ? "water" : "electricity");

export function mount(root, ctx) {
  R = root; C = ctx; gen = createPhraseGen(); phase = "start"; st = null;
  const saved = load("ht.cfg.higherlower", null);
  if (saved && HL.modes.some((m) => m.id === saved.mode)) cfg = { mode: saved.mode, lives: !!saved.lives };
  offSettings = ctx.subscribe(onSettings);
  keyHandler = onKey;
  document.addEventListener("keydown", keyHandler);
  renderStart();
}

export function unmount() {
  if (cancelAnim) cancelAnim();
  if (offSettings) offSettings();
  if (keyHandler) document.removeEventListener("keydown", keyHandler);
  R = C = st = gen = null; cancelAnim = offSettings = keyHandler = null;
}

function onSettings() {
  if (!R) return;
  if (phase === "start") return renderStart();
  if (phase === "over") return renderOver();
  if (st) {
    if (cancelAnim) { cancelAnim(); cancelAnim = null; if (phase === "revealing") phase = "ask"; }
    refreshValues(st, C.s);
    revealPhrase = phase === "revealed" ? gen.phrase(st.challenger.val, C.s) : null;
    anchorPhrase = st.anchor.isRef ? null : gen.phrase(st.anchor.val, C.s, { noExtra: true });
    anim = false;
    renderPlay();
  }
}

function onKey(e) {
  if (!R || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  const t = e.target && e.target.tagName;
  if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
  if (phase === "ask") {
    if (e.key === "ArrowUp" || e.key.toLowerCase() === "h") { e.preventDefault(); choose("higher"); }
    else if (e.key === "ArrowDown" || e.key.toLowerCase() === "l") { e.preventDefault(); choose("lower"); }
  } else if ((phase === "revealed") && e.key === "Enter" && t !== "BUTTON" && t !== "A") {
    e.preventDefault(); next();
  }
}

// ---- start screen
function renderStart() {
  phase = "start";
  clear(R);
  const modeList = h("div", { class: "choice-list", role: "radiogroup", "aria-label": "Game mode" },
    HL.modes.map((m) => h("label", { class: "choice" },
      h("input", {
        type: "radio", name: "hl-mode", value: m.id, checked: cfg.mode === m.id,
        onchange: () => { cfg.mode = m.id; save("ht.cfg.higherlower", cfg); updateBest(); },
      }),
      h("span", null, h("strong", null, m.label), h("small", null, m.blurb)))));
  const best = h("p", { class: "muted", id: "hl-best" });
  const updateBest = () => { best.textContent = `Your best in this mode: ${getBest(bestKey())}`; };
  R.append(h("section", { class: "panel" },
    h("h2", null, `${emoji} ${title}`),
    h("p", null, "Two prompts. The left one shows its cost. Does the right one use ",
      h("strong", null, "more"), " or ", h("strong", null, "less"), "? One wrong answer and it's over."),
    modeList,
    h("label", { class: "switch-row" },
      h("input", {
        type: "checkbox", checked: cfg.lives,
        onchange: (e) => { cfg.lives = e.target.checked; save("ht.cfg.higherlower", cfg); updateBest(); },
      }),
      h("span", null, `Give me ${HL.lives} lives`)),
    best,
    h("button", { class: "btn btn-primary btn-big", onclick: startGame }, "Start"),
    h("p", { class: "hint" }, "Keys: ↑ higher · ↓ lower · Enter continues")));
  updateBest();
}

function startGame() {
  gen.reset();
  st = newRun(cfg.mode, cfg.lives);
  startRun(st, C.s);
  anchorPhrase = st.anchor.isRef ? null : gen.phrase(st.anchor.val, C.s, { noExtra: true });
  revealPhrase = null; newBest = false; anim = true;
  phase = "ask";
  renderPlay();
}

// ---- play screen
function valueBlock(item, s) {
  const bits = [h("div", { class: "val" }, formatValue(item.val, s))];
  if (isWater(s) && item.val <= 100) bits.push(h("div", { class: "val-sub" }, `≈ ${dropsText(item.val)}`));
  return bits;
}

function renderPlay() {
  clear(R);
  const s = C.s;
  const small = window.innerWidth < 640;
  const question = st.anchor.isRef
    ? [`Does this prompt use `, h("strong", null, "MORE"), " or ", h("strong", null, "LESS"), ` ${resWord(s)} than ${st.anchor.text.toLowerCase()}?`]
    : small
      ? [h("strong", null, "MORE"), " or ", h("strong", null, "LESS"), ` ${resWord(s)} than the left?`]
      : [`Does the right one use `, h("strong", null, "MORE"), " or ", h("strong", null, "LESS"), ` ${resWord(s)} than the left?`];

  const anchorCard = h("article", { class: `card duel-card anchor${anim ? " enter-left" : ""}` },
    h("div", { class: "card-emoji", "aria-hidden": "true" }, st.anchor.emoji),
    h("h3", { class: "card-text" }, st.anchor.text),
    h("div", { class: "card-val" }, valueBlock(st.anchor, s)),
    anchorPhrase ? h("p", { class: "card-line" }, `${anchorPhrase.emoji} ${anchorPhrase.text}`) : null);

  const shown = phase === "revealed" || phase === "revealing";
  valEl = h("div", { class: "val", "aria-live": "off" }, shown ? formatValue(phase === "revealed" ? st.challenger.val : 0, s) : "❓");
  const challengerCard = h("article", { class: `card duel-card challenger${anim ? " enter-right" : ""}${phase === "revealed" ? (wasCorrect ? " is-ok" : " is-bad") : ""}` },
    h("div", { class: "card-emoji", "aria-hidden": "true" }, st.challenger.emoji),
    h("h3", { class: "card-text" }, st.challenger.text),
    h("div", { class: "card-val" }, valEl,
      phase === "revealed" && isWater(s) && st.challenger.val <= 100 ? h("div", { class: "val-sub" }, `≈ ${dropsText(st.challenger.val)}`) : null,
      null));

  const actions = h("div", { class: "actions" });
  if (phase === "revealed") {
    const v = verdictFor(st.challenger.val);
    actions.append(
      resultBanner(wasCorrect, wasCorrect
        ? "Correct!"
        : (st.over ? "Wrong — game over." : `Not quite — ${st.lives} ${st.lives === 1 ? "life" : "lives"} left.`)),
      h("p", { class: "verdict" }, `${v.emoji} ${v.label}`),
      phraseBox(revealPhrase),
      h("button", { class: "btn btn-primary btn-big", id: "hl-next", onclick: next }, st.over ? "See results ▶" : "Next ▶"));
  } else {
    const dis = phase !== "ask";
    actions.append(
      h("button", { class: `btn btn-big btn-down${lastGuess === "lower" && dis ? " chosen" : ""}`, disabled: dis, onclick: () => choose("lower"), "aria-label": "Lower: the right one uses less" }, "▼ Lower"),
      h("button", { class: `btn btn-big btn-up${lastGuess === "higher" && dis ? " chosen" : ""}`, disabled: dis, onclick: () => choose("higher"), "aria-label": "Higher: the right one uses more" }, "▲ Higher"));
  }

  R.append(h("section", { class: "game hl" },
    statusBar({ score: st.score, best: Math.max(getBest(bestKey()), st.score), lives: st.livesOn ? st.lives : null, maxLives: HL.lives, level: st.score / HL.gaugeMax }),
    h("p", { class: `question${st.anchor.isRef ? "" : " one-line"}` }, question),
    h("div", { class: "duel" }, anchorCard, h("div", { class: "vs", "aria-hidden": "true" }, "VS"), challengerCard),
    actions));
  anim = false;
  const nextBtn = document.getElementById("hl-next");
  if (nextBtn) nextBtn.focus({ preventScroll: false });
}

function choose(guess) {
  if (phase !== "ask") return;
  const s = C.s;
  lastGuess = guess;
  wasCorrect = (st.challenger.val > st.anchor.val) === (guess === "higher");
  phase = "revealing";
  renderPlay();
  const target = st.challenger.val;
  cancelAnim = animate(900, (f) => { if (valEl) valEl.textContent = formatValue(target * f, s); }, () => {
    cancelAnim = null;
    finishReveal();
  });
}

function finishReveal() {
  const s = C.s;
  if (wasCorrect) {
    st.score++;
    C.sound("ok");
  } else {
    C.sound("bad");
    if (st.livesOn) st.lives--;
    if (!st.livesOn || st.lives <= 0) st.over = true;
  }
  if (saveBest(bestKey(), st.score)) newBest = st.score > 0;
  revealPhrase = gen.phrase(st.challenger.val, s, st.anchor.isRef ? { exclude: [st.anchor.refId] } : {});
  phase = "revealed";
  C.announce(`${wasCorrect ? "Correct." : "Wrong."} ${st.challenger.text} uses ${formatValue(st.challenger.val, s)}. ${revealPhrase.text}`);
  renderPlay();
}

function next() {
  if (phase !== "revealed") return;
  if (st.over) return renderOver();
  const prevChallenger = st.challenger;
  advance(st, C.s);
  anchorPhrase = st.anchor.isRef ? null : (st.anchor === prevChallenger ? revealPhrase : gen.phrase(st.anchor.val, C.s, { noExtra: true }));
  revealPhrase = null; lastGuess = null; anim = true;
  phase = "ask";
  renderPlay();
}

// ---- game over
function shareMessage() {
  const s = C.s;
  const icon = isWater(s) ? "💧" : "⚡";
  const lines = [
    `${icon} How Thirsty? — Higher or Lower`,
    `Streak: ${st.score} 🔥  (best: ${getBest(bestKey())})`,
  ];
  if (isWater(s)) {
    const x = exchangeRate(s);
    if (x) lines.push(x);
  } else {
    const p = st.anchor.isRef ? null : st.anchor;
    lines.push(p ? `${p.text} = ${formatValue(p.val, s)} — about ${pedalText(p.wh)} of hard pedaling` : "Pedaling hard makes ~100 W");
  }
  lines.push(`Play: ${shareUrl()}`);
  return lines.join("\n");
}

function renderOver() {
  phase = "over";
  clear(R);
  const s = C.s;
  const row = (it, label) => h("li", { class: "over-row" },
    h("span", { class: "over-emoji", "aria-hidden": "true" }, it.emoji),
    h("span", { class: "over-text" }, h("small", null, label), it.text),
    h("strong", null, formatValue(it.val, s)));
  const status = h("p", { class: "muted", role: "status" });
  R.append(h("section", { class: "panel over" },
    h("h2", null, "Game over"),
    h("div", { class: "big-score" }, h("span", { class: "big-n" }, String(st.score)), h("span", null, st.score === 1 ? "in a row" : "in a row 🔥")),
    h("p", null, newBest ? "🏆 New personal best!" : `Personal best: ${getBest(bestKey())}`),
    h("ul", { class: "over-list" }, row(st.anchor, st.anchor.isRef ? "Reference" : "Left"), row(st.challenger, "Right")),
    h("div", { class: "row-buttons" },
      h("button", { class: "btn btn-primary btn-big", onclick: startGame }, "Play again"),
      h("button", {
        class: "btn btn-big",
        onclick: async () => {
          const r = await shareText(shareMessage());
          status.textContent = r === "copied" ? "Copied to clipboard!" : r === "shared" ? "Shared!" : "Couldn't share on this device.";
        },
      }, "Share"),
      h("button", { class: "btn", onclick: renderStart }, "Change mode")),
    status));
  C.announce(`Game over. Your streak was ${st.score}.`);
}
