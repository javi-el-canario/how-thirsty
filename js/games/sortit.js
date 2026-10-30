// Game 4 - Sort It
import { PROMPTS } from "../../data.js";
import { SORT } from "../../data-extra.js";
import { promptValue, formatValue, shuffle, isWater, dropsText } from "../engine.js";
import { getBest, saveBest } from "../storage.js";
import { h, clear, statusBar, resultBanner, shareText, shareUrl, reducedMotion } from "../ui.js";

export const id = "sortit";
export const title = "Sort It";
export const emoji = "🔢";
export const blurb = "Put five prompts in order, from the lowest cost to the highest.";

const BEST_KEY = "ht.best.sortit";
const REVEAL_DELAY = 1400;     // ms between showing the mistakes and re-ordering
const MOVE_MS = 850;           // length of the re-order animation
const DRAG_THRESHOLD = 5;      // px before a press turns into a drag

// ---- pure: pick `size` prompts whose consecutive values differ by at least `minSpread`
export function pickSet(rng = Math.random, size = SORT.size, minSpread = SORT.minSpread) {
  const pool = PROMPTS.filter((p) => !p.boss);
  const valid = (set, needCats) => {
    const sorted = set.slice().sort((a, b) => a.wh - b.wh);
    for (let i = 1; i < sorted.length; i++) if (sorted[i].wh / sorted[i - 1].wh < minSpread) return false;
    return !needCats || new Set(set.map((p) => p.cat)).size >= Math.min(size - 1, 4);
  };
  for (const needCats of [true, false]) {
    for (let i = 0; i < 500; i++) {
      const set = shuffle(pool, rng).slice(0, size);
      if (valid(set, needCats)) return set;
    }
  }
  return shuffle(pool, rng).slice(0, size);
}

let R = null, C = null, off = null, timer = 0;
let items = [], order = [], userOrder = [];
let phase = "play";              // play | checked (user's order + marks) | sorted (correct order, animated)
let streak = 0, lastScore = 0;

export function mount(root, ctx) {
  R = root; C = ctx; streak = 0;
  off = ctx.subscribe(() => { if (R) render(); });
  newSet();
}

export function unmount() {
  clearTimeout(timer);
  if (off) off();
  R = C = off = null;
}

const sortedItems = () => items.slice().sort((a, b) => a.wh - b.wh);

function newSet() {
  clearTimeout(timer);
  items = pickSet();
  const sorted = sortedItems();
  do { order = shuffle(items); } while (order.every((p, i) => p === sorted[i]));
  userOrder = []; phase = "play";
  render();
}

// move the item at index `from` so it ends up at index `to`
function moveTo(from, to) {
  if (phase !== "play" || from === to || to < 0 || to >= order.length) return;
  const [p] = order.splice(from, 1);
  order.splice(to, 0, p);
  render(to);
}

function check() {
  if (phase !== "play") return;
  userOrder = order.slice();
  const sorted = sortedItems();
  lastScore = order.filter((p, i) => p === sorted[i]).length;
  const perfect = lastScore === order.length;
  streak = perfect ? streak + 1 : 0;
  saveBest(BEST_KEY, streak);
  phase = "checked";
  C.sound(perfect ? "win" : lastScore >= 3 ? "ok" : "bad");
  C.announce(perfect
    ? `Perfect! All ${order.length} in the right place. Streak ${streak}.`
    : `${lastScore} of ${order.length} in the right place. Showing the correct order.`);
  render();
  if (!perfect) timer = setTimeout(autoSort, reducedMotion() ? 700 : REVEAL_DELAY);
}

function autoSort() {
  if (!R || phase !== "checked") return;
  order = sortedItems();
  phase = "sorted";
  render(-1, true);
}

function shareMessage() {
  return [
    `${isWater(C.s) ? "💧" : "⚡"} How Thirsty? — Sort It`,
    `Perfect sets in a row: ${streak} 🔥 (best: ${getBest(BEST_KEY)})`,
    `Play: ${shareUrl()}`,
  ].join("\n");
}

// ---- drag to re-order (mouse, touch and pen)
function attachDrag(li, index) {
  li.addEventListener("pointerdown", (e) => {
    if (phase !== "play" || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (e.target.closest(".sort-move")) return;
    const rows = [...li.parentElement.children];
    const rects = rows.map((r) => r.getBoundingClientRect());
    const gap = rows.length > 1 ? rects[1].top - rects[0].bottom : 0;
    const step = rects[index].height + gap;
    let dragging = false, target = index;
    const y0 = e.clientY;

    const move = (ev) => {
      const dy = ev.clientY - y0;
      if (!dragging) {
        if (Math.abs(dy) < DRAG_THRESHOLD) return;
        dragging = true;
        li.classList.add("dragging");
        try { li.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      // clamp inside the list, then find the slot under the dragged row's centre
      const minDy = rects[0].top - rects[index].top;
      const maxDy = rects[rows.length - 1].top - rects[index].top;
      const clamped = Math.max(minDy, Math.min(maxDy, dy));
      li.style.transform = `translateY(${clamped}px)`;
      const centre = rects[index].top + rects[index].height / 2 + clamped;
      target = rects.findIndex((r) => centre < r.top + r.height / 2 + 0.0001);
      if (target === -1) target = rows.length - 1;
      rows.forEach((r, k) => {
        if (k === index) return;
        let shift = 0;
        if (index < target && k > index && k <= target) shift = -step;
        if (index > target && k >= target && k < index) shift = step;
        r.style.transform = shift ? `translateY(${shift}px)` : "";
      });
    };
    const end = () => {
      li.removeEventListener("pointermove", move);
      li.removeEventListener("pointerup", end);
      li.removeEventListener("pointercancel", end);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      if (dragging) {
        li.classList.remove("dragging");
        rows.forEach((r) => { r.style.transform = ""; });
        moveTo(index, target);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    li.addEventListener("pointercancel", end);
  });
}

// ---- view
function render(focusIdx = -1, flip = false) {
  // remember where every row is, so a re-order can slide instead of jump
  const before = new Map();
  if (flip) R.querySelectorAll(".sort-row").forEach((li) => before.set(li.dataset.id, li.getBoundingClientRect().top));

  clear(R);
  const s = C.s;
  const sorted = sortedItems();
  const ref = phase === "play" ? null : userOrder;      // the order the player chose
  const rows = order.map((p, i) => {
    const userIdx = ref ? ref.indexOf(p) : i;
    const right = !!ref && sorted[userIdx] === p;       // was it placed correctly by the player?
    const v = promptValue(p, s);
    const perfectNow = phase !== "play" && lastScore === order.length;
    const showNums = phase === "sorted" || perfectNow;      // numbers only fade in with the final order
    const li = h("li", {
      class: `sort-row${phase === "play" ? "" : right ? " is-ok" : " is-bad"}`,
      dataset: { id: p.id },
    },
      h("span", { class: `sort-pos${showNums ? " fade-in" : " is-hidden"}`, "aria-hidden": "true" }, String(i + 1)),
      h("div", {
        class: "sort-main",
        role: "group",
        "aria-label": `${p.text}. Position ${i + 1} of ${order.length}.${phase === "play" ? " Drag, or use the arrow buttons, to move it." : ""}`,
      },
        h("span", { class: "sort-emoji", "aria-hidden": "true" }, p.emoji),
        h("span", { class: "sort-text" }, p.text),
        phase === "play" ? null : h("strong", { class: "sort-val" }, right ? "✔" : "✖",
          showNums ? h("span", { class: "fade-in" }, ` ${formatValue(v, s)}`,
            isWater(s) && v <= 100 ? h("small", null, ` (${dropsText(v)})`) : null) : null),
        phase === "sorted" && !right ? h("small", { class: "sort-hint" }, `you put it at #${userIdx + 1}`) : null,
        phase === "checked" && !right ? h("small", { class: "sort-hint" }, "wrong spot") : null),
      h("span", { class: "sort-move" },
        h("button", { type: "button", class: "icon-btn", disabled: phase !== "play" || i === 0, "aria-label": `Move "${p.text}" up`, "data-move": `${i}:up`, onclick: () => moveTo(i, i - 1) }, "▲"),
        h("button", { type: "button", class: "icon-btn", disabled: phase !== "play" || i === order.length - 1, "aria-label": `Move "${p.text}" down`, "data-move": `${i}:down`, onclick: () => moveTo(i, i + 1) }, "▼")));
    if (phase === "play") attachDrag(li, i);
    return li;
  });

  const done = phase !== "play";
  const perfect = done && lastScore === order.length;
  R.append(h("section", { class: "game sort" },
    statusBar({ label: "Perfect sets", score: streak, best: getBest(BEST_KEY), level: streak / 5 }),
    h("h2", { class: "sr-only" }, title),
    h("p", { class: "question" }, "Order from ", h("strong", null, "lowest"), " (top) to ", h("strong", null, "highest"), " (bottom)"),
    h("ol", { class: "sort-list" }, rows),
    done
      ? h("div", { class: "actions" },
          resultBanner(perfect, perfect ? "Perfect order!"
            : phase === "checked" ? `${lastScore} of ${order.length} in the right place`
              : `${lastScore} of ${order.length} right — this is the correct order`),
          h("div", { class: "row-buttons" },
            h("button", { class: "btn btn-primary btn-big", id: "sort-next", onclick: newSet }, "Next set ▶"),
            h("button", { class: "btn", onclick: async (e) => { const r = await shareText(shareMessage()); e.target.textContent = r === "copied" ? "Copied!" : r === "shared" ? "Shared!" : "Share"; } }, "Share")))
      : h("div", { class: "actions" }, h("button", { class: "btn btn-primary btn-big", onclick: check }, "Check order"))));

  if (flip && !reducedMotion()) {
    const lis = [...R.querySelectorAll(".sort-row")];
    lis.forEach((li) => {
      const dy = (before.get(li.dataset.id) ?? li.getBoundingClientRect().top) - li.getBoundingClientRect().top;
      if (!dy) return;
      li.style.transition = "none";
      li.style.transform = `translateY(${dy}px)`;
      li.style.zIndex = "2";
    });
    void R.offsetHeight;                                  // commit the start positions
    lis.forEach((li) => {
      li.style.transition = `transform ${MOVE_MS}ms cubic-bezier(.2,.8,.2,1)`;
      li.style.transform = "";
    });
    setTimeout(() => lis.forEach((li) => { li.style.transition = ""; li.style.zIndex = ""; }), MOVE_MS + 50);
  }

  if (phase === "sorted" || (phase === "checked" && perfect)) {
    const b = document.getElementById("sort-next");
    if (b) b.focus({ preventScroll: true });
  } else if (focusIdx >= 0) {
    const b = R.querySelector(`[data-move="${focusIdx}:down"]:not(:disabled)`) || R.querySelector(`[data-move="${focusIdx}:up"]:not(:disabled)`);
    if (b) b.focus({ preventScroll: true });
  }
}
