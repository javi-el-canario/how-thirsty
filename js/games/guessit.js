// Game 5 - Guess It
import { PROMPTS } from "../../data.js";
import { GUESS } from "../../data-extra.js";
import { createPhraseGen, promptValue, formatValue, dropsText, verdictFor, shuffle, isWater, resourceUnitName } from "../engine.js";
import { getBest, saveBest } from "../storage.js";
import { h, clear, statusBar, shareText, shareUrl, phraseBox } from "../ui.js";

export const id = "guessit";
export const title = "Guess It";
export const emoji = "🎯";
export const blurb = "How much does one prompt use? Slide to your best guess. 10 rounds.";

const BEST_KEY = "ht.best.guessit";
const STEPS = 1000;

// ---- pure helpers (tested)
export const sliderToValue = (t) => GUESS.min * Math.pow(GUESS.max / GUESS.min, t / STEPS);
export const valueToSlider = (v) => Math.round((Math.log(v / GUESS.min) / Math.log(GUESS.max / GUESS.min)) * STEPS);
export function starsFor(guess, truth) {
  const ratio = Math.max(guess / truth, truth / guess);
  for (const band of GUESS.stars) if (ratio <= band.within) return band.stars;
  return 0;
}
const inRange = (p, s) => { const v = promptValue(p, s); return v >= GUESS.min && v <= GUESS.max; };

let R = null, C = null, off = null, gen = null;
let queue = [], idx = 0, total = 0, rounds = [], t = STEPS / 2, answered = false, done = false, lastStars = 0, phrase = null, newBest = false;

export function mount(root, ctx) {
  R = root; C = ctx; gen = createPhraseGen();
  off = ctx.subscribe(() => { if (R) { ensureInRange(); if (answered) phrase = gen.phrase(promptValue(queue[idx], C.s), C.s); render(); } });
  start();
}

export function unmount() {
  if (off) off();
  R = C = off = gen = null;
}

function start() {
  gen.reset();
  queue = shuffle(PROMPTS.filter((p) => !p.boss && inRange(p, C.s))).slice(0, GUESS.rounds);
  idx = 0; total = 0; rounds = []; t = STEPS / 2; answered = false; done = false; newBest = false;
  render();
}

function ensureInRange() {
  const used = new Set(queue.map((p) => p.id));
  for (let i = answered ? idx + 1 : idx; i < queue.length; i++) {
    if (inRange(queue[i], C.s)) continue;
    const repl = shuffle(PROMPTS.filter((p) => !p.boss && !used.has(p.id) && inRange(p, C.s)))[0];
    if (repl) { used.add(repl.id); queue[i] = repl; }
  }
}

function submit() {
  if (answered) return;
  const s = C.s;
  const p = queue[idx];
  const truth = promptValue(p, s);
  const guess = sliderToValue(t);
  lastStars = starsFor(guess, truth);
  total += lastStars;
  rounds.push(lastStars);
  answered = true;
  phrase = gen.phrase(truth, s);
  C.sound(lastStars >= 2 ? "ok" : "bad");
  C.announce(`You guessed ${formatValue(guess, s)}. The real value is ${formatValue(truth, s)}. ${lastStars} of 3 stars. ${phrase.text}`);
  render();
}

function next() {
  if (idx + 1 >= queue.length) {
    done = true;
    newBest = saveBest(BEST_KEY, total) && total > 0;
    C.announce(`Session over. You scored ${total} of ${queue.length * 3}.`);
  } else { idx++; t = STEPS / 2; answered = false; phrase = null; }
  render();
}

const starStr = (n) => "★".repeat(n) + "☆".repeat(3 - n);

function shareMessage() {
  return [
    `${isWater(C.s) ? "💧" : "⚡"} How Thirsty? — Guess It`,
    `Score: ${total}/${queue.length * 3} ⭐  (best: ${getBest(BEST_KEY)})`,
    rounds.map((n) => starStr(n)).join(" "),
    `Play: ${shareUrl()}`,
  ].join("\n");
}

function render() {
  clear(R);
  const s = C.s;
  if (done) {
    const status = h("p", { class: "muted", role: "status" });
    R.append(h("section", { class: "panel over" },
      h("h2", null, "Session over"),
      h("div", { class: "big-score" }, h("span", { class: "big-n" }, `${total}`), h("span", null, `of ${queue.length * 3} stars ⭐`)),
      h("p", null, newBest ? "🏆 New personal best!" : `Personal best: ${getBest(BEST_KEY)}`),
      h("ul", { class: "over-list" }, queue.map((p, i) => h("li", { class: "over-row" },
        h("span", { class: "over-emoji", "aria-hidden": "true" }, p.emoji),
        h("span", { class: "over-text" }, p.text),
        h("strong", { "aria-label": `${rounds[i]} of 3 stars` }, starStr(rounds[i]))))),
      h("div", { class: "row-buttons" },
        h("button", { class: "btn btn-primary btn-big", onclick: start }, "Play again"),
        h("button", { class: "btn btn-big", onclick: async () => { const r = await shareText(shareMessage()); status.textContent = r === "copied" ? "Copied!" : r === "shared" ? "Shared!" : "Couldn't share here."; } }, "Share")),
      status));
    return;
  }

  const p = queue[idx];
  const truth = promptValue(p, s);
  const guess = sliderToValue(t);
  const out = h("output", { class: "guess-out", id: "g-out", "aria-live": "off" }, formatValue(guess, s));
  const slider = h("input", {
    type: "range", min: 0, max: STEPS, step: 1, value: t, class: "slider", id: "g-slider",
    "aria-label": `Your guess in ${resourceUnitName(s)}`,
    "aria-valuetext": formatValue(guess, s),
    disabled: answered,
    oninput: (e) => {
      t = Number(e.target.value);
      const g = sliderToValue(t);
      out.textContent = formatValue(g, s);
      e.target.setAttribute("aria-valuetext", formatValue(g, s));
    },
  });

  const resultBlock = answered ? h("div", { class: "actions" },
    h("div", { class: `banner ${lastStars >= 2 ? "ok" : "bad"}`, role: "status" },
      h("span", { class: "banner-icon", "aria-hidden": "true" }, lastStars >= 2 ? "✔" : "✖"),
      h("span", null, `${starStr(lastStars)}  `, lastStars === 3 ? "Bullseye!" : lastStars === 2 ? "Close!" : lastStars === 1 ? "Same ballpark." : "Way off.")),
    h("p", { class: "reveal-val" }, "Real value: ", h("strong", null, formatValue(truth, s)),
      isWater(s) && truth <= 100 ? ` (${dropsText(truth)})` : "", ` — ${verdictFor(truth).emoji} ${verdictFor(truth).label}`),
    phraseBox(phrase),
    h("button", { class: "btn btn-primary btn-big", id: "g-next", onclick: next }, idx + 1 >= queue.length ? "See results ▶" : "Next ▶"))
    : h("div", { class: "actions" }, h("button", { class: "btn btn-primary btn-big", onclick: submit }, "Lock it in"));

  R.append(h("section", { class: "game guess" },
    statusBar({ label: `Round ${idx + 1}/${queue.length} · Stars`, score: total, best: getBest(BEST_KEY), icon: "⭐", level: total / (queue.length * 3) }),
    h("p", { class: "question" }, `How much ${isWater(s) ? "water" : "electricity"} does this prompt use?`),
    h("article", { class: "card duel-card solo" },
      h("div", { class: "card-emoji", "aria-hidden": "true" }, p.emoji),
      h("h3", { class: "card-text" }, p.text)),
    h("div", { class: "slider-box" },
      out,
      slider,
      h("div", { class: "slider-ends" }, h("span", null, formatValue(GUESS.min, s)), h("span", null, "log scale"), h("span", null, formatValue(GUESS.max, s))),
      answered ? h("div", { class: "marker-note" }, `Your guess: ${formatValue(guess, s)}`) : null),
    resultBlock));

  if (answered) { const b = document.getElementById("g-next"); if (b) b.focus(); }
}
