// Compact copy of the global settings, embeddable inside any game screen.
import { getSettings, setSettings } from "./settings.js";
import { h } from "./ui.js";

export function segmented(label, options, value, onPick) {
  return h("div", { class: "seg", role: "group", "aria-label": label },
    options.map((o) => h("button", {
      type: "button", class: `seg-btn${o.value === value ? " on" : ""}`, "aria-pressed": o.value === value ? "true" : "false",
      onclick: () => onPick(o.value),
    }, o.label)));
}

export const MODE_OPTIONS = [{ value: "auto", label: "Auto" }, { value: "light", label: "☀️ Light" }, { value: "dark", label: "🌙 Dark" }];

export function quickToggles() {
  const s = getSettings();
  return h("div", { class: "quick" },
    segmented("Resource", [{ value: "water", label: "💧 Water" }, { value: "elec", label: "⚡ Electricity" }], s.resource,
      (v) => setSettings({ resource: v })),
    s.resource === "water"
      ? h("label", { class: "switch-row small" },
          h("input", { type: "checkbox", checked: s.powerGen, onchange: (e) => setSettings({ powerGen: e.target.checked }) }),
          h("span", null, "Include water from generating electricity"))
      : null,
    s.resource === "water"
      ? segmented("Units", [{ value: "metric", label: "Metric" }, { value: "us", label: "US" }], s.units, (v) => setSettings({ units: v }))
      : null,
    segmented("Appearance", MODE_OPTIONS, s.mode, (v) => setSettings({ mode: v })));
}
