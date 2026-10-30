// Game 2 - Measure Your Prompt
import { PROMPTS, ELEC_REFS } from "../../data.js";
import { MEASURE } from "../../data-extra.js";
import {
  createPhraseGen, whToValue, formatValue, dropsText, verdictFor, isWater, fmtNum, pedalText, shuffle,
} from "../engine.js";
import { estimate } from "../estimator.js";
import { h, clear, shareText, shareUrl, phraseBox } from "../ui.js";
import { quickToggles } from "../toggles.js";

export const id = "measure";
export const title = "Measure Your Prompt";
export const emoji = "📏";
export const blurb = "Type any prompt and see its water or electricity cost in everyday terms.";

let R = null, C = null, gen = null, off = null;
let text = "", type = "auto", result = null, examples = [];

export function mount(root, ctx) {
  R = root; C = ctx; gen = createPhraseGen();
  result = null;
  examples = shuffle(MEASURE.examples).slice(0, MEASURE.examplesShown);
  off = ctx.subscribe(() => { if (R) { if (result) computeResult(); render(); } });
  render();
}

export function unmount() {
  if (off) off();
  R = C = gen = off = null;
}

function typeLabel(cat) {
  return (MEASURE.types.find((t) => t.id === cat) || { label: cat }).label;
}

function computeResult() {
  const s = C.s;
  const est = estimate(text, type);
  const v = whToValue(est.wh, s);
  gen.reset();
  result = {
    text, est, v,
    comparisons: gen.phrases(v, s, 3, MEASURE.forced[isWater(s) ? "water" : "elec"]),
    scale: ["thousand", "year", "world"].map((k) => gen.scaleLine(k, v, s)),
  };
}

function measure() {
  text = text.trim();
  if (!text) { C.announce("Type a prompt first."); return; }
  computeResult();
  render();
  C.sound("ok");
  const s = C.s;
  C.announce(`Estimated ${formatValue(result.v, s)}. ${result.comparisons.map((c) => c.text).join(" ")}`);
  const card = document.getElementById("m-result");
  if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function logBar(wh) {
  const lo = ELEC_REFS.find((r) => r.id === MEASURE.barLowRef.id);
  const hi = PROMPTS.find((p) => p.id === MEASURE.barHighPrompt);
  const a = Math.log10(lo.wh), b = Math.log10(hi.wh);
  const pos = Math.min(1, Math.max(0, (Math.log10(wh) - a) / (b - a)));
  return h("div", { class: "logbar", role: "img", "aria-label": `Position on a scale from ${lo.one} to ${hi.text.toLowerCase()}: ${Math.round(pos * 100)} percent` },
    h("div", { class: "logbar-track" },
      h("div", { class: "logbar-fill", style: `width:${(pos * 100).toFixed(1)}%` }),
      h("div", { class: "logbar-dot", style: `left:${(pos * 100).toFixed(1)}%` })),
    h("div", { class: "logbar-labels" },
      h("span", null, `${lo.emoji} ${lo.one}`),
      h("span", null, `${hi.emoji} ${hi.text.replace(/^Generate /, "")}`)));
}

function shareMessage() {
  const s = C.s;
  const lines = [
    `${isWater(s) ? "💧" : "⚡"} How Thirsty? — Measure Your Prompt`,
    `"${result.text.length > 80 ? result.text.slice(0, 77) + "…" : result.text}"`,
    `≈ ${formatValue(result.v, s)}${isWater(s) && result.v <= 100 ? ` (${dropsText(result.v)})` : ""}`,
  ];
  if (result.comparisons[0]) lines.push(`${result.comparisons[0].emoji} ${result.comparisons[0].text}`);
  lines.push(`Play: ${shareUrl()}`);
  return lines.join("\n");
}

function resultCard() {
  const s = C.s;
  const { est, v } = result;
  const verdict = verdictFor(v);
  const status = h("span", { class: "muted", role: "status" });
  return h("section", { class: "panel result", id: "m-result", "aria-label": "Result" },
    h("div", { class: "big-result" },
      h("div", { class: "big-value" }, formatValue(v, s)),
      isWater(s) && v <= 100 ? h("div", { class: "val-sub" }, `≈ ${dropsText(v)}`) : null,
      !isWater(s) ? h("div", { class: "val-sub" }, `≈ ${pedalText(est.wh)} of hard pedaling`) : null,
      h("div", { class: "verdict" }, `${verdict.emoji} ${verdict.label}`)),
    h("p", { class: "muted" },
      `Detected as ${typeLabel(est.cat)} · ~${fmtNum(est.inputTokens)} input tokens`,
      est.outputTokens ? ` · ~${fmtNum(est.outputTokens)} output tokens` : ""),
    est.notes.map((n) => h("p", { class: "note" }, n)),
    h("h3", null, "That's like…"),
    h("div", { class: "phrases" }, result.comparisons.map((c) => phraseBox(c))),
    h("h3", null, "At scale"),
    h("ul", { class: "scale-list" }, result.scale.map((l) => h("li", null, l))),
    h("h3", null, "Where it sits"),
    logBar(est.wh),
    h("div", { class: "row-buttons" },
      h("button", {
        class: "btn", onclick: async () => {
          const r = await shareText(shareMessage());
          status.textContent = r === "copied" ? "Copied!" : r === "shared" ? "Shared!" : "Couldn't share here.";
        },
      }, "Share"),
      status));
}

function render() {
  clear(R);
  const ta = h("textarea", {
    id: "m-text", rows: 3, placeholder: "Type any prompt…", value: text, maxLength: 2000,
    "aria-label": "Your prompt",
    oninput: (e) => { text = e.target.value; },
    onkeydown: (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); measure(); } },
  });
  R.append(h("section", { class: "game measure" },
    h("section", { class: "panel" },
      h("h2", null, `${emoji} ${title}`),
      ta,
      h("div", { class: "chips", role: "group", "aria-label": "Example prompts" },
        examples.map((ex) => h("button", {
          type: "button", class: "chip", onclick: () => { text = ex; type = "auto"; measure(); },
        }, ex))),
      h("label", { class: "field" }, h("span", null, "Type of prompt"),
        h("select", { onchange: (e) => { type = e.target.value; } },
          MEASURE.types.map((t) => h("option", { value: t.id, selected: t.id === type }, t.label)))),
      quickToggles(),
      h("button", { class: "btn btn-primary btn-big", onclick: measure }, "Measure"),
      h("p", { class: "hint" }, "Tip: Ctrl+Enter also measures.")),
    result ? resultCard() : null,
    h("p", { class: "disclaimer" }, MEASURE.disclaimer)));
}
