// estimator.js - "Measure Your Prompt". All numbers come from data.js (CATEGORY_RULES, ESTIMATOR).
import { CATEGORY_RULES, ESTIMATOR } from "../data.js";
import { MEASURE } from "../data-extra.js";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text, w) => new RegExp("\\b" + esc(w), "i").test(text);
const toNum = (s) => parseFloat(String(s).replace(/,/g, ""));

// data.js rules + extra keywords from data-extra.js
const RULES = CATEGORY_RULES.map((r) => ({
  ...r,
  words: [...r.words, ...(MEASURE.extraWords[r.cat] || [])],
}));
const ruleFor = (cat) => RULES.find((r) => r.cat === cat) || RULES[RULES.length - 1];

export function detectCategory(text) {
  for (const r of RULES) if (r.words.some((w) => hasWord(text, w))) return r.cat;
  return RULES[RULES.length - 1].cat;
}

function durationSeconds(text) {
  let sec = 0, found = false;
  const units = [
    [/(\d[\d,]*(?:\.\d+)?)[\s-]*(?:seconds?|secs?)\b/gi, 1],
    [/(\d[\d,]*(?:\.\d+)?)[\s-]*(?:minutes?|mins?)\b/gi, 60],
    [/(\d[\d,]*(?:\.\d+)?)[\s-]*(?:hours?|hrs?)\b/gi, 3600],
  ];
  for (const [re, mult] of units) {
    for (const m of text.matchAll(re)) { sec += toNum(m[1]) * mult; found = true; }
  }
  return found ? sec : null;
}

export function estimate(text, forcedCat = "auto") {
  const t = String(text || "").trim();
  const cat = forcedCat && forcedCat !== "auto" ? forcedCat : detectCategory(t);
  const rule = ruleFor(cat);
  const notes = [];

  const inputTokens = Math.ceil(t.length / ESTIMATOR.charsPerToken);
  let outputTokens = 0;
  let extraWh = 0;

  // "N words" -> output tokens
  const words = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k)?[\s-]*words?\b/i);
  if (words) {
    outputTokens = toNum(words[1]) * (words[2] ? 1000 : 1) * ESTIMATOR.wordsToTokens;
  }

  // "N pages": output (writing) or input (documents)
  const pages = t.match(/(\d[\d,]*(?:\.\d+)?)[\s-]*pages?\b/i);
  if (pages && !words) {
    const n = toNum(pages[1]);
    const writing = cat === "writing" || MEASURE.writeVerbs.some((w) => hasWord(t, w));
    if (writing) outputTokens = n * ESTIMATOR.wordsPerPage * ESTIMATOR.wordsToTokens;
    else extraWh += n * ESTIMATOR.perInputPageWh;
  }

  // video / audio length
  if (rule.perSecondWh) {
    const sec = durationSeconds(t) ?? MEASURE.defaultSeconds[cat] ?? 0;
    extraWh += sec * rule.perSecondWh;
  }

  let wh = rule.baseWh
    + inputTokens * ESTIMATOR.inputPerTokenWh
    + outputTokens * ESTIMATOR.outputPerTokenWh
    + extraWh;

  // "N images / logos / variations"
  if (cat === "image" && ESTIMATOR.perImageMult) {
    const m = t.match(/(\d[\d,]*)\s*(?:images?|pictures?|logos?|variations?|posters?|illustrations?|icons?|drawings?|renders?)\b/i);
    if (m) wh *= Math.min(MEASURE.maxCount, Math.max(1, toNum(m[1])));
  }

  // deep-thinking cues
  if (MEASURE.reasoningCues.some((w) => hasWord(t, w))) {
    wh *= cat === "reasoning" ? MEASURE.reasoningOnReasoning : ESTIMATOR.deepThinkingMult;
  }

  // easter eggs
  for (const egg of ESTIMATOR.easterEggs) {
    if (egg.words.some((w) => hasWord(t, w))) {
      wh += egg.addWh;
      notes.push(egg.note);
    }
  }

  wh = Math.min(ESTIMATOR.maxWh, Math.max(ESTIMATOR.minWh, wh));
  return { wh, cat, inputTokens: Math.round(inputTokens), outputTokens: Math.round(outputTokens), notes };
}
