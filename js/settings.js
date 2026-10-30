import { load, save } from "./storage.js";

const DEFAULTS = { resource: "water", powerGen: false, units: "metric", sound: false, mode: "auto" };

function sanitize(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    resource: r.resource === "elec" ? "elec" : "water",
    powerGen: r.powerGen === true,
    units: r.units === "us" ? "us" : "metric",
    sound: r.sound === true,
    mode: r.mode === "light" || r.mode === "dark" ? r.mode : "auto",
  };
}

let state = { ...DEFAULTS, ...sanitize(load("ht.settings", {})) };
const subs = new Set();

export const getSettings = () => state;

export function setSettings(patch) {
  state = sanitize({ ...state, ...patch });
  save("ht.settings", state);
  subs.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
}

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
