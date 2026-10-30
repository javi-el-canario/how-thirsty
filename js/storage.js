// localStorage wrapper. Every access is wrapped in try/catch and an in-memory
// fallback keeps the game working when storage is blocked or missing.
const mem = new Map();

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null && raw !== undefined) return JSON.parse(raw);
  } catch (e) { /* storage unavailable or corrupt: use memory */ }
  return mem.has(key) ? mem.get(key) : fallback;
}

export function save(key, value) {
  mem.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function getBest(key) {
  const v = load(key, 0);
  return typeof v === "number" && isFinite(v) ? v : 0;
}

// Saves only when higher. Returns true if a new best was set.
export function saveBest(key, score) {
  if (score > getBest(key)) { save(key, score); return true; }
  return false;
}
