// engine.js - number formatting, units, reference picker, phrase generator.
// Pure logic: no DOM access, so it can be tested in Node.
import {
  WATER_ML_PER_WH, POWER_GEN_WATER_MULT, PROMPTS, WATER_REFS, ELEC_REFS, TEMPLATES, VERDICTS,
} from "../data.js";
import { CONST, REF_WINDOW, PHRASE } from "../data-extra.js";

// ---------------------------------------------------------------- random
export const rand = Math.random;
export function pick(arr, rng = rand) { return arr[Math.floor(rng() * arr.length)]; }
export function shuffle(arr, rng = rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function weightedPick(items, weightFn, rng = rand) {
  let total = 0;
  const ws = items.map((it) => { const w = Math.max(0, weightFn(it)); total += w; return w; });
  if (total <= 0) return pick(items, rng);
  let x = rng() * total;
  for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x <= 0) return items[i]; }
  return items[items.length - 1];
}

// ---------------------------------------------------------------- numbers
export function round2(x) {
  if (!isFinite(x) || x === 0) return x;
  return Number(Number(x).toPrecision(2));
}

const WORDS = [
  [1e15, "quadrillion"], [1e12, "trillion"], [1e9, "billion"], [1e6, "million"],
];

function grouped(n) {
  return n.toLocaleString("en-US", { maximumSignificantDigits: 2 });
}

// 2 significant figures; thousands separators below 1 million, words above.
export function fmtNum(x) {
  if (!isFinite(x)) return "∞";
  if (x === 0) return "0";
  const sign = x < 0 ? "-" : "";
  const a = round2(Math.abs(x));
  if (a >= 1e6) {
    for (const [v, w] of WORDS) {
      if (a >= v) return `${sign}${grouped(round2(a / v))} ${w}`;
    }
  }
  return sign + grouped(a);
}

// Same, but marks large rounded values with "~".
export function fmtApprox(x) {
  const r = round2(x);
  const inexact = Math.abs(x) >= 100 && Math.abs(r - x) / Math.abs(x) > 0.005;
  return (inexact ? "~" : "") + fmtNum(x);
}

// ---------------------------------------------------------------- settings -> values
export const isWater = (s) => s.resource === "water";

export function whToValue(wh, s) {
  return isWater(s) ? wh * WATER_ML_PER_WH * (s.powerGen ? POWER_GEN_WATER_MULT : 1) : wh;
}
export const promptValue = (p, s) => whToValue(p.wh, s);

// ---------------------------------------------------------------- unit formatting
export function formatValue(v, s) {
  const r = round2(v);
  if (isWater(s)) {
    if (s.units === "us") {
      const oz = v / CONST.FL_OZ_ML;
      if (round2(oz) < 128) return `${fmtApprox(oz)} fl oz`;
      return `${fmtApprox(v / CONST.GAL_ML)} gal`;
    }
    if (r < 1000) return `${fmtApprox(v)} ml`;
    if (r < 1e6) return `${fmtApprox(v / 1e3)} L`;
    return `${fmtApprox(v / 1e6)} m³`;
  }
  const units = ["Wh", "kWh", "MWh", "GWh", "TWh"];
  let x = v, i = 0;
  while (round2(x) >= 1000 && i < units.length - 1) { x /= 1000; i++; }
  return `${fmtApprox(x)} ${units[i]}`;
}

export function resourceUnitName(s) {
  if (!isWater(s)) return "Wh";
  return s.units === "us" ? "fl oz" : "ml";
}

export function dropsNumber(ml) { return ml / CONST.DROP_ML; }
export function dropsText(ml) {
  const d = dropsNumber(ml);
  if (d < 1) return "less than 1 drop";
  return `${fmtApprox(d)} ${round2(d) === 1 ? "drop" : "drops"}`;
}

export function timeText(seconds) {
  if (seconds <= 120) return `${fmtNum(seconds)} seconds`;
  const min = seconds / 60;
  if (min <= 120) return `${fmtNum(min)} minutes`;
  const hr = min / 60;
  if (hr <= 48) return `${fmtNum(hr)} hours`;
  const days = hr / 24;
  if (days <= 730) return `${fmtNum(days)} days`;
  return `${fmtNum(days / 365)} years`;
}
export const pedalSeconds = (wh) => (wh * 3600) / CONST.PEDAL_WATTS;   // 100 W -> wh * 36
export const pedalText = (wh) => timeText(pedalSeconds(wh));

export function verdictFor(v) {
  return VERDICTS.find((x) => v <= x.max) || VERDICTS[VERDICTS.length - 1];
}

export const capFirst = (t) => (/^[a-z]/.test(t) ? t[0].toUpperCase() + t.slice(1) : t);

// ---------------------------------------------------------------- references
const POOLS = {
  water: WATER_REFS.map((r) => ({ ...r, v: r.ml })),
  elec: ELEC_REFS.map((r) => ({ ...r, v: r.wh })),
};
export const refsFor = (s) => (isWater(s) ? POOLS.water : POOLS.elec);

const modeKey = (s) => (isWater(s) ? "water" : "elec");

function templatesFor(kind, s) {
  const m = modeKey(s);
  return TEMPLATES.filter((t) => t.kind === kind && (t.mode === "both" || t.mode === m));
}

function placeholders(v, s, ref, ratio) {
  const wh = isWater(s) ? v / (WATER_ML_PER_WH * (s.powerGen ? POWER_GEN_WATER_MULT : 1)) : v;
  const p = {
    value: formatValue(v, s),
    drops: fmtNum(dropsNumber(v)),
    year: formatValue(v * CONST.PER_DAY * CONST.DAYS, s),
    world: formatValue(v * CONST.POPULATION, s),
    thousand: formatValue(v * CONST.THOUSAND, s),
    pedalT: pedalText(wh),
    ledT: timeText((wh / CONST.LED_WATTS) * 3600),
  };
  if (ref) {
    Object.assign(p, {
      ref: ref.one, refs: ref.many, emoji: ref.emoji,
      N: fmtApprox(ratio), Np: fmtNum(ratio), M: fmtNum(1 / ratio),
    });
  }
  return p;
}

function fill(text, p) {
  const t = text
    .replace("{pedal} seconds", "{pedalT}")      // unit is chosen automatically
    .replace("{pedalMin} minutes", "{pedalT}")
    .replace("{led} minutes", "{ledT}")
    .replace("/{N}", "/{Np}")
    .replace(" in {N}", " in {Np}");
  return capFirst(t.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)));
}


// "photo" wording: the same templates, but about generating images instead of asking prompts.
const PHOTO_SWAPS = [
  [/Sending this once a minute/g, "Generating one photo a minute"],
  [/Hitting send once/g, "Generating one photo"],
  [/Ask this \{N\} times\./g, "Generate {N} photos like this."],
  [/Ask \{N\} questions like this/g, "Generate {N} photos like this"],
  [/Do this \{N\} times/g, "Generate {N} photos"],
  [/you'd have to hit send \{N\} times/g, "you'd have to generate {N} photos"],
  [/\{N\} sends to reach/g, "{N} photos to reach"],
  [/Send \{N\} of these/g, "Generate {N} of these"],
  [/One tap of send,/g, "One photo,"],
  [/One send,/g, "One photo,"],
  [/Do this 1,000 times/g, "Generate 1,000 photos"],
  [/Ten of these a day/g, "Ten of these photos a day"],
  [/request/g, "photo"],
  [/questions/g, "photos"],
  [/prompts/g, "photos"],
  [/prompt/g, "photo"],
];
export function toPhotoWording(text) {
  let t = text;
  for (const [re, to] of PHOTO_SWAPS) t = t.replace(re, to);
  return t;
}

export function createPhraseGen(rng = rand, options = {}) {
  const wording = (t) => (options.unit === "photo" ? toPhotoWording(t) : t);
  const recentRefs = [];
  let lastTpl = null, lastRef = null, lastAny = null;

  function remember(id) {
    lastRef = id;
    recentRefs.push(id);
    while (recentRefs.length > PHRASE.recentRefs) recentRefs.shift();
  }

  function chooseRef(v, s, { exclude = [], only = null } = {}) {
    let list = refsFor(s)
      .map((r) => ({ r, ratio: r.v / v }))
      .filter((x) => x.ratio >= REF_WINDOW.min && x.ratio <= REF_WINDOW.max && !exclude.includes(x.r.id));
    if (only) list = list.filter((x) => only(x.r));
    if (!list.length) return null;
    let fresh = list.filter((x) => x.r.id !== lastRef && !recentRefs.includes(x.r.id));
    if (!fresh.length) fresh = list.filter((x) => x.r.id !== lastRef);
    if (!fresh.length) return null;            // never the same reference twice in a row
    return weightedPick(fresh, (x) => 1 / (1 + Math.abs(Math.log10(x.ratio))), rng);
  }

  function pickTemplate(kind, s) {
    const pool = templatesFor(kind, s);
    const fresh = pool.filter((t) => t !== lastTpl);
    return pick(fresh.length ? fresh : pool, rng);
  }

  function anyLine(v, s, needle = null) {
    let pool = templatesFor("any", s);
    if (needle) pool = pool.filter((t) => t.text.includes(needle));
    const fresh = pool.filter((t) => t !== lastAny);
    const t = pick(fresh.length ? fresh : pool, rng);
    lastAny = t;
    return fill(wording(t.text), placeholders(v, s, null, 1));
  }

  function build(v, s, chosen) {
    const { r: ref, ratio } = chosen;
    let kind, text, tpl = null;
    if (ratio >= 2) kind = "many";
    else if (ratio <= 0.5) kind = "few";
    else kind = "same";
    if (kind === "same") {
      const close = Math.abs(ratio - 1) <= PHRASE.sameBand;
      text = fill(PHRASE.same[close ? 1 : 0], placeholders(v, s, ref, ratio));
    } else {
      tpl = pickTemplate(kind, s);
      lastTpl = tpl;
      text = fill(wording(tpl.text), placeholders(v, s, ref, ratio));
    }
    remember(ref.id);
    return { emoji: ref.emoji, text, ref, ratio, kind, tpl, extra: null };
  }

  // One phrase for value v. Returns a reference phrase (+ maybe a scale line).
  function phrase(v, s, opts = {}) {
    const chosen = chooseRef(v, s, opts);
    if (!chosen) {
      // No reference fits the 0.02 - 5,000,000 window: use a scale line only.
      return { emoji: PHRASE.fallbackEmoji[modeKey(s)], text: anyLine(v, s), ref: null, ratio: null, kind: "any", extra: null };
    }
    const out = build(v, s, chosen);
    if (!opts.noExtra && rng() < PHRASE.anyMix) out.extra = anyLine(v, s);
    return out;
  }

  // n phrases using n different references. `forced` = list of predicates; each one
  // must be satisfied by at least one reference (when possible).
  function phrases(v, s, n, forced = []) {
    const used = [];
    const out = [];
    for (const pred of forced) {
      if (out.length >= n) break;
      if (out.some((o) => o.ref && pred(o.ref))) continue;
      const c = chooseRef(v, s, { exclude: used, only: pred });
      if (c) { used.push(c.r.id); out.push(build(v, s, c)); }
    }
    while (out.length < n) {
      const c = chooseRef(v, s, { exclude: used });
      if (!c) break;
      used.push(c.r.id);
      out.push(build(v, s, c));
    }
    return shuffle(out, rng);
  }

  // Scale line: "thousand" | "year" | "world"
  function scaleLine(kind, v, s) { return anyLine(v, s, `{${kind}}`); }

  function reset() { recentRefs.length = 0; lastTpl = lastRef = lastAny = null; }

  return { phrase, phrases, scaleLine, reset };
}

// "An 8-minute shower = 140,000 chatbot prompts" (share text helper)
export function exchangeRate(s, rng = rand, basePrompt = PROMPTS.find((p) => p.id === "capital") || PROMPTS[0]) {
  const v = promptValue(basePrompt, s);
  const list = refsFor(s).filter((r) => r.v / v >= 2 && r.v / v <= REF_WINDOW.max);
  if (!list.length) return null;
  const r = weightedPick(list, (x) => 1 / (1 + Math.abs(Math.log10(x.v / v))), rng);
  return `${capFirst(r.one)} = ${fmtApprox(r.v / v)} chatbot prompts`;
}
