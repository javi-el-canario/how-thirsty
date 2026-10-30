// main.js - router, home menu, settings + about panels, theme.
import { APP_NAME, REALAI } from "../data-extra.js";
import { WATER_ML_PER_WH, POWER_GEN_WATER_MULT } from "../data.js";
import { getSettings, setSettings, subscribe } from "./settings.js";
import { blip } from "./sound.js";
import { getBest } from "./storage.js";
import { h, clear } from "./ui.js";
import { segmented, quickToggles, MODE_OPTIONS } from "./toggles.js";

import * as higherlower from "./games/higherlower.js";
import * as measure from "./games/measure.js";
import * as imageduel from "./games/imageduel.js";
import * as sortit from "./games/sortit.js";
import * as guessit from "./games/guessit.js";
import * as realorai from "./games/realorai.js";

// Adding a game = add a file in js/games/ + one line here.
const ALL_GAMES = [higherlower, measure, sortit, guessit, realorai, imageduel];

// "Real or AI?" appears once realorai.json holds enough real AND AI pictures; add ?demo to the URL to try it with placeholders.
async function picturesReady() {
  try {
    const demo = /[?&]demo(=|&|$)/.test(location.search);
    const r = await fetch(demo ? "realorai.demo.json" : "realorai.json", { cache: "no-cache" });
    if (!r.ok) return false;
    const data = await r.json();
    const min = demo ? 2 : REALAI.minPerSideToShow;
    return Array.isArray(data.real) && Array.isArray(data.ai) && data.real.length >= min && data.ai.length >= min;
  } catch (e) { return false; }
}

// Games listed here stay in the code but are not shown or reachable. Remove an id to bring a game back.
const HIDDEN_GAMES = new Set(["imageduel"]);
if (!(await picturesReady())) HIDDEN_GAMES.add("realorai");
const GAMES = ALL_GAMES.filter((g) => !HIDDEN_GAMES.has(g.id));

const app = document.getElementById("app");
const live = document.getElementById("live");
const settingsDlg = document.getElementById("settingsDlg");
const aboutDlg = document.getElementById("aboutDlg");

let current = null;
let gameSubs = [];

// ---------------------------------------------------------------- announce + context
function announce(msg) {
  live.textContent = "";
  setTimeout(() => { live.textContent = msg; }, 30);
}

const ctx = {
  get s() { return getSettings(); },
  subscribe(fn) {
    const off = subscribe(fn);
    gameSubs.push(off);
    return off;
  },
  announce,
  sound: (kind) => blip(kind, getSettings().sound),
  openAbout: () => openDialog(aboutDlg),
  goHome: () => { location.hash = ""; },
};

// ---------------------------------------------------------------- theme
let darkQuery = null;
try { darkQuery = window.matchMedia("(prefers-color-scheme: dark)"); } catch (e) { /* no matchMedia */ }
const resolvedMode = (s) => (s.mode === "auto" ? (darkQuery && darkQuery.matches ? "dark" : "light") : s.mode);

function applyTheme() {
  const s = getSettings();
  document.documentElement.dataset.theme = s.resource;
  document.documentElement.dataset.mode = resolvedMode(s);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", s.resource === "water" ? "#0b6aa8" : "#b45f06");
  const rb = document.getElementById("resBtn");
  rb.textContent = s.resource === "water" ? "💧 Water" : "⚡ Electricity";
  rb.setAttribute("aria-label", `Resource: ${s.resource === "water" ? "water" : "electricity"}. Tap to switch.`);
  document.getElementById("logoIcon").textContent = s.resource === "water" ? "💧" : "⚡";
}

// ---------------------------------------------------------------- dialogs
function openDialog(dlg) {
  if (dlg === settingsDlg) renderSettings();
  try { if (!dlg.open) dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); }
}

function closeButton(dlg) {
  return h("button", { class: "btn btn-primary", type: "button", onclick: () => { try { dlg.close(); } catch (e) { dlg.removeAttribute("open"); } } }, "Done");
}

function renderSettings() {
  const s = getSettings();
  const body = clear(document.getElementById("settingsBody"));
  body.append(...[
    h("div", { class: "setting" }, h("h3", null, "Resource"),
      segmented("Resource", [{ value: "water", label: "💧 Water" }, { value: "elec", label: "⚡ Electricity" }], s.resource, (v) => setSettings({ resource: v }))),
    s.resource === "water"
      ? h("div", { class: "setting" },
          h("label", { class: "switch-row" },
            h("input", { type: "checkbox", checked: s.powerGen, onchange: (e) => setSettings({ powerGen: e.target.checked }) }),
            h("span", null, "Include water from generating electricity")),
          h("p", { class: "hint" }, `Multiplies every water number by ${POWER_GEN_WATER_MULT} (power plants use water too).`))
      : null,
    h("div", { class: "setting" }, h("h3", null, "Appearance"),
      segmented("Appearance", MODE_OPTIONS, s.mode, (v) => setSettings({ mode: v }))),
    h("div", { class: "setting" }, h("h3", null, "Units"),
      segmented("Units", [{ value: "metric", label: "Metric" }, { value: "us", label: "US" }], s.units, (v) => setSettings({ units: v })),
      h("p", { class: "hint" }, s.resource === "water" ? "Water: ml / L / m³ or fl oz / gallons." : "Electricity uses Wh / kWh / MWh in both systems.")),
    h("div", { class: "setting" },
      h("label", { class: "switch-row" },
        h("input", { type: "checkbox", checked: s.sound, onchange: (e) => { setSettings({ sound: e.target.checked }); blip("ok", e.target.checked); } }),
        h("span", null, "Sound effects"))),
    h("div", { class: "dlg-actions" }, closeButton(settingsDlg)),
  ].filter(Boolean));
}

function buildAbout() {
  const body = document.getElementById("aboutBody");
  body.append(...[
    h("h3", null, "Where do these numbers come from?"),
    h("p", null, "They're rough estimates, built from published ballparks for different kinds of AI tasks. Treat them as orders of magnitude, not measurements. Real values vary a lot by model, hardware, data center and region, and they change quickly as hardware and software improve."),
    h("h3", null, "Why are water and electricity the same game?"),
    h("p", null, `In this game, a data center uses about ${WATER_ML_PER_WH} ml of cooling water for every watt-hour (Wh) of electricity. So the ordering of prompts is identical in both modes. Only the units, comparisons and flavor text change.`),
    h("h3", null, `What does the ×${POWER_GEN_WATER_MULT} switch do?`),
    h("p", null, `Generating electricity (in power plants) also uses water. The "include water from generating electricity" switch multiplies the water number by ${POWER_GEN_WATER_MULT} to roughly account for that.`),
    GAMES.some((g) => g.id === "imageduel") ? h("h3", null, "Image Duel") : null,
    GAMES.some((g) => g.id === "imageduel") ? h("p", null, "Image energy depends on the model, resolution, number of steps and batch size, not on how complicated the picture looks. Some values were measured on a GPU; others are estimates, and each reveal card says which.") : null,
    h("h3", null, "Measure Your Prompt"),
    h("p", null, "It guesses a task type from your words, counts tokens (about 4 characters each), adds the size hints it finds (\"1,000 words\", \"5-second video\"), and uses simple per-token costs. It's a toy model, great for comparisons but not for accounting."),
    h("p", { class: "hint" }, "The tone here is informative and playful. Not for or against AI."),
    h("div", { class: "dlg-actions" }, closeButton(aboutDlg)),
  ].filter(Boolean));
}

// ---------------------------------------------------------------- views
function stopCurrent() {
  if (current) { try { current.unmount(); } catch (e) { console.error(e); } }
  current = null;
  gameSubs.forEach((off) => off());
  gameSubs = [];
}

let offHome = null;
function renderHome() {
  clear(app);
  app.append(
    h("section", { class: "hero" },
      h("h1", null, APP_NAME),
      h("p", { class: "lead" },
        getSettings().resource === "water"
          ? "How much water does an AI prompt drink?"
          : "How much electricity does an AI prompt use?",
        h("br"),
        h("span", { class: "lead-fun" }, "Guess, sort and measure it."))),
    h("section", { class: "panel" }, quickToggles()),
    h("ul", { class: "game-list", dataset: { count: String(GAMES.length) } }, GAMES.map((g) => {
      const best = ({ guessit: "ht.best.guessit", sortit: "ht.best.sortit" })[g.id] ? getBest(({ guessit: "ht.best.guessit", sortit: "ht.best.sortit" })[g.id]) : 0;
      return h("li", null, h("a", { class: "game-link", href: `#/${g.id}` },
        h("span", { class: "game-emoji", "aria-hidden": "true" }, g.emoji),
        h("span", { class: "game-info" }, h("strong", null, g.title), h("small", null, g.blurb)),
        best ? h("span", { class: "game-best", "aria-label": `Best ${best}` }, `🏆 ${best}`) : null));
    })),
    h("p", { class: "footer-links" }, h("button", { class: "link", type: "button", onclick: () => openDialog(aboutDlg) }, "About these numbers")));
}

function route() {
  const m = location.hash.match(/^#\/(\w+)/);
  const game = m && GAMES.find((g) => g.id === m[1]);
  stopCurrent();
  document.body.dataset.view = game ? game.id : "home";   // each game gets its own colour scheme
  if (offHome) { offHome(); offHome = null; }
  clear(app);
  if (!game) {
    renderHome();
    offHome = subscribe(() => { if (!location.hash.match(/^#\/\w+/)) renderHome(); });
    document.title = APP_NAME;
  } else {
    app.append(h("nav", { class: "crumbs" }, h("a", { href: "#" }, "← All games")));
    const root = h("div", { class: "game-root" });
    app.append(root);
    document.title = `${game.title} · ${APP_NAME}`;
    try {
      game.mount(root, ctx);
      current = game;
    } catch (e) {
      console.error(e);
      root.append(h("p", { class: "panel" }, "Something went wrong loading this game. Try reloading."));
    }
  }
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- boot
document.getElementById("homeBtn").addEventListener("click", () => { location.hash = ""; });
document.getElementById("settingsBtn").addEventListener("click", () => openDialog(settingsDlg));
document.getElementById("aboutBtn").addEventListener("click", () => openDialog(aboutDlg));
document.getElementById("resBtn").addEventListener("click", () => {
  setSettings({ resource: getSettings().resource === "water" ? "elec" : "water" });
  announce(`Switched to ${getSettings().resource === "water" ? "water" : "electricity"}.`);
});
for (const dlg of [settingsDlg, aboutDlg]) {
  dlg.addEventListener("click", (e) => { if (e.target === dlg) { try { dlg.close(); } catch (err) { /* ignore */ } } });
}
subscribe(() => { applyTheme(); if (settingsDlg.open) renderSettings(); });

buildAbout();
applyTheme();
if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", applyTheme);
window.addEventListener("hashchange", route);
route();

try {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
} catch (e) { /* offline support is optional */ }
