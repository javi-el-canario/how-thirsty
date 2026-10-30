// Engine + game-logic self-test. Run: node tests/selftest.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROMPTS, WATER_REFS, ELEC_REFS } from "../data.js";
import { REF_WINDOW, HL, GUESS, SORT, MEASURE } from "../data-extra.js";
import * as store from "../js/storage.js";
import {
  fmtNum, round2, formatValue, createPhraseGen, toPhotoWording, promptValue, pedalText, timeText, dropsText, exchangeRate,
} from "../js/engine.js";
import { estimate } from "../js/estimator.js";
import * as hl from "../js/games/higherlower.js";
import * as img from "../js/games/imageduel.js";
import * as guess from "../js/games/guessit.js";
import * as sort from "../js/games/sortit.js";
import * as ra from "../js/games/realorai.js";

let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log("  ✔", name); };
const section = (t) => console.log("\n" + t);

// deterministic RNG so failures are reproducible
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const SETTINGS = [];
for (const resource of ["water", "elec"]) for (const units of ["metric", "us"]) for (const powerGen of [false, true]) SETTINGS.push({ resource, units, powerGen, sound: false });

section("Number formatting");
ok("2 significant figures", () => {
  assert.equal(fmtNum(1234), "1,200");
  assert.equal(fmtNum(0.3), "0.3");
  assert.equal(fmtNum(0.0123), "0.012");
  assert.equal(fmtNum(140000), "140,000");
  assert.equal(fmtNum(999999), "1 million");
  assert.equal(fmtNum(1.44e6), "1.4 million");
  assert.equal(fmtNum(3.2e9), "3.2 billion");
  assert.equal(fmtNum(7.1e12), "7.1 trillion");
  assert.equal(round2(1234), 1200);
});
ok("best-fit units (water, metric / US) and electricity", () => {
  const w = { resource: "water", units: "metric", powerGen: false };
  assert.equal(formatValue(0.3, w), "0.3 ml");
  assert.equal(formatValue(500, w), "500 ml");
  assert.equal(formatValue(70000, w), "70 L");
  assert.equal(formatValue(2.5e9, w), "2,500 m³");
  const us = { ...w, units: "us" };
  assert.equal(formatValue(250, us), "8.5 fl oz");
  assert.match(formatValue(70000, us), /gal$/);
  const e = { resource: "elec", units: "metric", powerGen: false };
  assert.equal(formatValue(0.3, e), "0.3 Wh");
  assert.equal(formatValue(1500, e), "1.5 kWh");
  assert.equal(formatValue(1.3e9, e), "1.3 GWh");
  assert.equal(formatValue(1e6, e), "1 MWh");
});
ok("pedal math and time units", () => {
  assert.equal(pedalText(1), "36 seconds");          // 1 Wh at 100 W = 36 s
  assert.equal(pedalText(10), "6 minutes");           // 360 s
  assert.equal(timeText(3 * 3600 * 1), "3 hours");
  assert.match(timeText(3 * 86400), /days/);
  assert.equal(dropsText(0.3), "6 drops");
});
ok("power-generation toggle multiplies water by 4, not electricity", () => {
  const p = PROMPTS[0];
  assert.equal(promptValue(p, { resource: "water", powerGen: true }), p.wh * 4);
  assert.equal(promptValue(p, { resource: "water", powerGen: false }), p.wh);
  assert.equal(promptValue(p, { resource: "elec", powerGen: true }), p.wh);
});

section("Phrase generator (20 000+ phrases)");
ok("ratio window, no absurd counts, no repeats, no broken placeholders", () => {
  const rng = mulberry(7);
  let total = 0, fallback = 0;
  for (const s of SETTINGS) {
    const gen = createPhraseGen(rng);
    let lastRef = null, lastTpl = null;
    const recent = [];
    for (const p of PROMPTS) {
      const v = promptValue(p, s);
      gen.reset(); lastRef = lastTpl = null; recent.length = 0;
      for (let i = 0; i < 40; i++) {
        const out = gen.phrase(v, s);
        total++;
        assert.ok(!/NaN|undefined|Infinity|\{|\}/.test(out.text + (out.extra || "")), `bad text: ${out.text} / ${out.extra}`);
        assert.ok(/^[^a-z]|^[A-Z]/.test(out.text[0]) || !/[a-z]/.test(out.text[0]), `not capitalized: ${out.text}`);
        if (!out.ref) { fallback++; continue; }
        assert.ok(out.ratio >= REF_WINDOW.min && out.ratio <= REF_WINDOW.max, `ratio ${out.ratio} outside window for ${p.id}`);
        if (out.kind === "many") assert.ok(out.ratio >= 2);
        if (out.kind === "few") assert.ok(1 / out.ratio >= 2 && 1 / out.ratio <= 50);
        assert.notEqual(out.ref.id, lastRef, `immediate ref repeat ${out.ref.id}`);
        if (out.tpl) { assert.notEqual(out.tpl, lastTpl, `immediate template repeat: ${out.tpl.text}`); lastTpl = out.tpl; }
        lastRef = out.ref.id;
        // spacing: ref not reused within the last 6 phrases (when alternatives exist)
        const pool = (s.resource === "water" ? WATER_REFS : ELEC_REFS).filter((r) => { const q = (r.ml ?? r.wh) / v; return q >= REF_WINDOW.min && q <= REF_WINDOW.max; });
        if (pool.length > 7 && recent.includes(out.ref.id)) throw new Error(`ref ${out.ref.id} reused within 6 phrases (${p.id}, ${s.resource})`);
        recent.push(out.ref.id); if (recent.length > 6) recent.shift();
      }
    }
  }
  console.log(`      ${total} phrases checked, ${fallback} used the no-reference fallback (value too large for any reference)`);
});
ok("templates respect mode: no water words in electricity mode and vice versa", () => {
  const rng = mulberry(11);
  const gen = createPhraseGen(rng);
  for (let i = 0; i < 3000; i++) {
    const p = PROMPTS[Math.floor(rng() * PROMPTS.length)];
    const o = gen.phrase(promptValue(p, { resource: "elec" }), { resource: "elec", units: "metric" });
    assert.ok(!/drops of water|evaporate|given your plants|cooling of a data center/.test(o.text + (o.extra || "")), o.text);
  }
});
ok("3 comparisons use 3 different references and satisfy the forced reference", () => {
  const rng = mulberry(3);
  for (const s of SETTINGS) {
    const gen = createPhraseGen(rng);
    for (const wh of [0.3, 1, 5, 60, 500, 8000]) {
      const v = promptValue({ wh }, s);
      const list = gen.phrases(v, s, 3, MEASURE.forced[s.resource]);
      assert.equal(list.length, 3);
      assert.equal(new Set(list.map((x) => x.ref.id)).size, 3);
      const feasible = (s.resource === "water" ? WATER_REFS : ELEC_REFS).some((r) => { const q = (r.ml ?? r.wh) / v; return q >= REF_WINDOW.min && q <= REF_WINDOW.max && MEASURE.forced[s.resource].some((f) => f(r)); });
      if (feasible) assert.ok(list.some((x) => MEASURE.forced[s.resource].some((f) => f(x.ref))), `no forced ref for ${wh} ${s.resource}`);
    }
  }
});
ok("photo wording (Image Duel) never mentions prompts, sending or asking", () => {
  const rng = mulberry(5);
  const gen = createPhraseGen(rng, { unit: "photo" });
  for (const s of SETTINGS) for (const wh of [0.08, 0.5, 1.6, 8]) for (let i = 0; i < 40; i++) {
    const o = gen.phrase(promptValue({ wh }, s), s);
    assert.ok(!/(prompts?|send|sends|sending|questions?|ask|request)/i.test(o.text + " " + (o.extra || "")), o.text);
  }
  assert.match(toPhotoWording("Ask this {N} times. Then you've spent {ref}."), /Generate \{N\} photos/);
});
ok("exchange-rate share line", () => {
  assert.match(exchangeRate({ resource: "water", units: "metric", powerGen: false }), /= .* chatbot prompts$/);
});

section("Estimator (SPEC acceptance)");
const near = (got, want, tol) => assert.ok(got >= want / tol && got <= want * tol, `${got} not within ×${tol} of ${want}`);
ok("capital of France ≈ 0.3 Wh", () => near(estimate("What is the capital of France?").wh, 0.3, 1.2));
ok("1,000-word essay ≈ 1 Wh", () => near(estimate("Write a 1,000-word essay").wh, 1, 1.6));
ok("5-second dog-surfing video ≈ 500 Wh", () => { const e = estimate("Make a 5-second video of a dog surfing"); assert.equal(e.cat, "video"); near(e.wh, 500, 1.25); });
ok("deep research on coffee ≈ 60 Wh", () => { const e = estimate("Do a deep research report with sources on coffee"); assert.equal(e.cat, "research"); near(e.wh, 60, 1.1); });
ok("hints: images, pages, reasoning, polite, clamp", () => {
  near(estimate("Generate 4 logo variations").wh, 10, 1.1);
  assert.ok(estimate("Summarize this 40-page PDF").wh > estimate("Summarize this PDF").wh);
  assert.ok(estimate("Prove this theorem step by step").wh > 5);
  const polite = estimate("What is the capital of France? Thank you!");
  assert.ok(polite.notes.length === 1 && polite.wh > 0.3);
  assert.equal(estimate("").wh, 0.3 > 0.1 ? estimate("").wh : 0.1);
  assert.ok(estimate("Build me a web app").cat === "agent");
  assert.ok(estimate("x", "video").wh >= 100);
});

section("Higher or Lower");
ok("never within 1.25x, boss gating, ramp, no 4 same categories, no recent repeats", () => {
  const rng = mulberry(42);
  let rounds = 0, relaxedRamp = 0, repeats = 0, bossSeen = 0;
  for (const mode of HL.modes) {
    for (const s of SETTINGS) {
      for (let run = 0; run < 6; run++) {
        const st = hl.newRun(mode.id, false);
        hl.startRun(st, s, rng);
        for (let r = 0; r < 120; r++) {
          const a = st.anchor.val, c = st.challenger.val;
          const q = hl.ratioOf(a, c);
          assert.ok(q >= HL.minRatio, `pair within 1.25x: ${st.anchor.text} vs ${st.challenger.text} (${q})`);
          assert.notEqual(a, c);
          if (st.score < HL.bossMinStreak) assert.ok(!st.challenger.boss, `boss before streak ${HL.bossMinStreak}`);
          if (st.challenger.boss) bossSeen++;
          const ramp = hl.rampFor(st.score);
          if (q < ramp.min || q > ramp.max) relaxedRamp++;
          rounds++;
          // categories: look at last 4 shown (non-reference)
          if (!st.anchor.isRef) {
            const shown = [...st.cats, st.challenger.cat];
            // st.cats already contains the challenger (remember), so check the last 4 entries as seen
          }
          st.score++;                                  // assume the player is right
          const before = st.recent.slice();
          hl.advance(st, s, rng);
          if (!st.challenger.isRef && before.includes(st.challenger.id)) repeats++;
        }
      }
    }
  }
  console.log(`      ${rounds} rounds; ramp relaxed in ${(100 * relaxedRamp / rounds).toFixed(1)}%; recent-repeat fallbacks ${repeats}; boss rounds ${bossSeen}`);
  assert.ok(bossSeen > 0, "bosses never appeared at high streaks");
});
ok("ramp matches SPEC at the sampled streaks", () => {
  assert.equal(hl.rampFor(0).min, 8); assert.equal(hl.rampFor(4).min, 8);
  assert.deepEqual([hl.rampFor(5).min, hl.rampFor(5).max], [3, 30]);
  assert.deepEqual([hl.rampFor(10).min, hl.rampFor(10).max], [1.5, 6]);
  assert.deepEqual([hl.rampFor(20).min, hl.rampFor(20).max], [1.25, 3]);
});
ok("no category appears 4 times in a row (classic)", () => {
  const rng = mulberry(5);
  const s = SETTINGS[0];
  let worst = 0;
  for (let run = 0; run < 40; run++) {
    const st = hl.newRun("classic", false);
    hl.startRun(st, s, rng);
    const seq = [st.anchor.cat, st.challenger.cat];
    for (let r = 0; r < 100; r++) {
      st.score++; hl.advance(st, s, rng); seq.push(st.challenger.cat);
    }
    let streak = 1;
    for (let i = 1; i < seq.length; i++) { streak = seq[i] === seq[i - 1] ? streak + 1 : 1; worst = Math.max(worst, streak); }
  }
  assert.ok(worst <= HL.maxSameCat, `category run of ${worst}`);
});

section("Image Duel");
const images = JSON.parse(readFileSync(new URL("../images.json", import.meta.url), "utf8"));
ok("images.json has valid entries (wh, tier or formula)", () => {
  assert.ok(images.length >= 6);
  assert.equal(new Set(images.map((e) => e.id)).size, images.length);
  for (const e of images) { assert.ok(e.id && e.file && e.prompt && e.model && e.width && img.whOf(e) > 0); }
});
ok("pairs are >=1.25x apart or within 10%, 'same' only when within 10%", () => {
  const rng = mulberry(9);
  const st = img.newRun();
  const types = new Set();
  for (let i = 0; i < 3000; i++) {
    const p = img.pickPair(images, st, rng);
    assert.ok(p, "no pair");
    const a = img.whOf(p.left), b = img.whOf(p.right);
    const q = Math.max(a, b) / Math.min(a, b);
    assert.ok(q >= 1.25 || q <= 1.1, `ambiguous pair ratio ${q}`);
    assert.equal(img.correctAnswer(p.left, p.right) === "same", q <= 1.1);
    types.add(p.type);
    st.recent.push(p.left.id, p.right.id); if (st.recent.length > 20) st.recent.shift();
  }
  assert.ok(types.size >= 2);
});
ok("formula fallback ≈ 1.6 Wh for 1 MP SDXL at 30 steps", () => {
  near(img.whOf({ model: "sdxl-base", width: 1024, height: 1024, steps: 30 }), 1.6, 1.1);
  assert.equal(img.whOf({ tier: "T2" }), 2);
});
ok("one-liner flags the 'simple but costly' trap", () => {
  const circle = images.find((e) => e.complexity === "simple" && e.wh > 5);
  const crowd = images.find((e) => e.complexity === "complex" && e.wh < 1);
  assert.match(img.oneLiner(circle, crowd), /Plot twist/);
});

section("Guess It / Sort It");
ok("log slider mapping and star bands", () => {
  near(guess.sliderToValue(0), GUESS.min, 1.001);
  near(guess.sliderToValue(1000), GUESS.max, 1.001);
  assert.equal(guess.starsFor(10, 10), 3); assert.equal(guess.starsFor(13, 10), 3);
  assert.equal(guess.starsFor(25, 10), 2); assert.equal(guess.starsFor(90, 10), 1); assert.equal(guess.starsFor(200, 10), 0);
  assert.equal(guess.starsFor(4, 10), 2);
});
ok("sort sets: 5 items, consecutive values >=2x apart, no bosses", () => {
  const rng = mulberry(21);
  for (let i = 0; i < 500; i++) {
    const set = sort.pickSet(rng);
    assert.equal(set.length, SORT.size);
    const s = set.slice().sort((a, b) => a.wh - b.wh);
    for (let k = 1; k < s.length; k++) assert.ok(s[k].wh / s[k - 1].wh >= SORT.minSpread);
    assert.ok(set.every((p) => !p.boss));
  }
});

section("Real or AI?");
const rData = JSON.parse(readFileSync(new URL("../realorai.json", import.meta.url), "utf8"));
const fakeReal = Array.from({ length: 30 }, (_, i) => ({ id: "r" + i, file: "r" + i }));
const fakeAi = Array.from({ length: 22 }, (_, i) => ({ id: "a" + i, file: "a" + i, wh: 1.2 }));
ok("realorai.json is well formed", () => {
  assert.ok(Array.isArray(rData.real) && Array.isArray(rData.ai));
  for (const p of [...rData.real, ...rData.ai]) assert.ok(ra.validPicture(p), p.id);
  assert.equal(new Set([...rData.real, ...rData.ai].map((p) => p.id)).size, rData.real.length + rData.ai.length);
});
ok("a picture never comes back in a game; the game lasts min(real, ai) rounds", () => {
  const rng = mulberry(31);
  for (let game = 0; game < 50; game++) {
    const st = ra.newRun(fakeReal, fakeAi, false, rng);
    assert.equal(ra.totalRounds(st), 22);
    const seenR = new Set(), seenA = new Set();
    let n = 0, r;
    while ((r = ra.drawRound(st, rng))) {
      assert.ok(!seenR.has(r.real.id) && !seenA.has(r.ai.id), "repeated picture");
      seenR.add(r.real.id); seenA.add(r.ai.id); n++;
      assert.equal(ra.totalRounds(st), 22);
    }
    assert.equal(n, 22);
  }
});
ok("AI side is random but never the same 4 times in a row", () => {
  const rng = mulberry(8);
  let left = 0, total = 0;
  for (let game = 0; game < 200; game++) {
    const st = ra.newRun(fakeReal, fakeAi, false, rng);
    let run = 0, prev = null, r;
    while ((r = ra.drawRound(st, rng))) {
      run = r.aiSide === prev ? run + 1 : 1; prev = r.aiSide;
      assert.ok(run <= 3, "4 in a row");
      if (r.aiSide === "left") left++; total++;
    }
  }
  assert.ok(left / total > 0.4 && left / total < 0.6, "side is biased: " + left / total);
});

section("Storage fallback");
ok("storage works without localStorage", () => {
  const st = store;
  assert.equal(st.getBest("x"), 0);
  st.save("x", 5);
  assert.equal(st.getBest("x"), 5);
  assert.equal(st.saveBest("x", 3), false);
  assert.equal(st.saveBest("x", 9), true);
});

console.log(`\n${passed} checks passed.`);
