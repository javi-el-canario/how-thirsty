// ui.js - tiny DOM helpers shared by every game. Only touches `document` inside functions.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k.startsWith("aria-") || k === "role" || k === "for") el.setAttribute(k, v === true ? "true" : v);
    else if (k in el) { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? "" : v);
  }
  add(el, kids);
  return el;
}

function add(el, kids) {
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    if (Array.isArray(kid)) add(el, kid);
    else el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

export function reducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}

// Runs onFrame(0..1) over `ms`. Returns a cancel function. Instant with reduced motion.
// A timer backs up requestAnimationFrame, which browsers pause in background tabs.
export function animate(ms, onFrame, onDone) {
  if (reducedMotion() || ms <= 0) { onFrame(1); if (onDone) onDone(); return () => {}; }
  let raf = 0, timer = 0, stopped = false;
  const t0 = performance.now();
  const finish = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf); clearTimeout(timer);
    onFrame(1);
    if (onDone) onDone();
  };
  const step = (now) => {
    if (stopped) return;
    const f = Math.min(1, (now - t0) / ms);
    if (f >= 1) return finish();
    onFrame(1 - Math.pow(1 - f, 3));          // ease-out
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  timer = setTimeout(finish, ms + 150);
  return () => { stopped = true; cancelAnimationFrame(raf); clearTimeout(timer); };
}

// Web Share API, then clipboard, then a hidden textarea. Resolves to "shared" | "copied" | "failed".
export async function shareText(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return "shared"; }
  } catch (e) {
    if (e && e.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (e) { /* fall through */ }
  try {
    const ta = h("textarea", { value: text, "aria-hidden": "true", style: "position:fixed;opacity:0" });
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok ? "copied" : "failed";
  } catch (e) { return "failed"; }
}

export function shareUrl() {
  try { return location.href.split("#")[0]; } catch (e) { return ""; }
}

// Status bar: streak, best, lives and the little water-level gauge.
export function statusBar({ label = "Streak", score, best, lives = null, maxLives = 3, level = 0, icon = "🔥" }) {
  return h("div", { class: "status", role: "group", "aria-label": "Score" },
    h("div", { class: "gauge", "aria-hidden": "true", style: `--lvl:${Math.round(Math.min(1, Math.max(0, level)) * 100)}%` },
      h("div", { class: "gauge-fill" })),
    h("div", { class: "stat" }, h("span", { class: "stat-n" }, String(score)), h("span", { class: "stat-l" }, `${label} ${icon}`)),
    h("div", { class: "stat" }, h("span", { class: "stat-n" }, String(best)), h("span", { class: "stat-l" }, "Best 🏆")),
    lives !== null
      ? h("div", { class: "lives", role: "img", "aria-label": `${lives} ${lives === 1 ? "life" : "lives"} left` },
          Array.from({ length: maxLives }, (_, i) => h("span", { class: `heart${i < lives ? "" : " lost"}`, "aria-hidden": "true" }, "❤️")))
      : null);
}

export function resultBanner(ok, text) {
  return h("div", { class: `banner ${ok ? "ok" : "bad"}`, role: "status" },
    h("span", { class: "banner-icon", "aria-hidden": "true" }, ok ? "✔" : "✖"), text);
}

export function phraseBox(p) {
  if (!p) return null;
  return h("div", { class: "phrase" },
    h("div", { class: "phrase-emoji", "aria-hidden": "true" }, p.emoji),
    h("div", { class: "phrase-text" },
      h("p", null, p.text),
      p.extra ? h("p", { class: "phrase-extra" }, p.extra) : null));
}
