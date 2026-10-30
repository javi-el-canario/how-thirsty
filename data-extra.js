// =====================================================================
// data-extra.js  -  tunables and small bits of content that SPEC.md asks for
// but that are NOT in data.js (data.js is left untouched).
// Nothing in here is a prompt cost: those live in data.js / images.json.
// =====================================================================

export const APP_NAME = "How Thirsty?";

// Physical / display constants
export const CONST = {
  DROP_ML: 0.05,        // 1 drop of water
  FL_OZ_ML: 29.5735,    // US fluid ounce
  GAL_ML: 3785.41,      // US gallon
  PEDAL_WATTS: 100,     // a person pedaling hard
  LED_WATTS: 10,        // one LED bulb
  PER_DAY: 10,          // "{year}" = 10 prompts a day ...
  DAYS: 365,            // ... for a year
  POPULATION: 8e9,      // "{world}"
  THOUSAND: 1000,
};

// Phrase generator rules (SPEC 3.2)
export const REF_WINDOW = { min: 0.02, max: 5e6 };
export const PHRASE = {
  recentRefs: 6,        // don't reuse a reference within this many phrases
  anyMix: 0.25,         // chance of adding an "any" (scale) line
  sameBand: 0.10,       // within 10% -> "almost exactly"
  same: [
    "That's about the same as {ref}.",
    "That's almost exactly {ref}.",
  ],
  // used only when NO reference fits the ratio window (e.g. training runs in
  // electricity mode): we fall back to "any" templates instead of absurd counts.
  fallbackEmoji: { water: "💧", elec: "⚡" },
};

// ---- Game 1: Higher or Lower ----
export const HL = {
  minRatio: 1.25,
  bossMinStreak: 12,
  bossChance: 0.2,
  recentItems: 10,
  maxSameCat: 3,        // never the same category 4 times in a row
  lives: 3,
  gaugeMax: 25,
  // streak -> allowed ratio range (hi/lo)
  ramp: [
    { upTo: 4,        min: 8,    max: Infinity },
    { upTo: 9,        min: 3,    max: 30 },
    { upTo: 19,       min: 1.5,  max: 6 },
    { upTo: Infinity, min: 1.25, max: 3 },
  ],
  modes: [
    { id: "classic",   label: "Classic",        blurb: "Every kind of prompt.", cats: null },
    { id: "text",      label: "Text only",      blurb: "Chat, writing, docs, code and reasoning.", cats: ["chat", "writing", "docs", "code", "reasoning"] },
    { id: "wild",      label: "Wild",           blurb: "Images, audio, video, agents and training.", cats: ["image", "audio", "video", "agent", "training"] },
    { id: "reference", label: "Reference duel", blurb: "Is a prompt more or less than a shower, a coffee, a phone charge…?", cats: null },
  ],
};

// ---- Game 2: Measure Your Prompt ----
export const MEASURE = {
  types: [
    { id: "auto",      label: "Auto-detect" },
    { id: "chat",      label: "Chat" },
    { id: "writing",   label: "Writing" },
    { id: "code",      label: "Code" },
    { id: "reasoning", label: "Reasoning" },
    { id: "research",  label: "Research" },
    { id: "image",     label: "Image" },
    { id: "audio-gen", label: "Audio" },
    { id: "video",     label: "Video" },
    { id: "docs",      label: "Documents" },
    { id: "agent",     label: "Agent" },
  ],
  // 6 random ones are shown each time the game opens
  examples: [
    "What is the capital of France?",
    "Write a haiku",
    "Write a 1,000-word essay",
    "Make a 5-second video of a dog surfing",
    "Build me a web app",
    "Do a deep research report with sources on coffee",
    "Summarize this 50-page PDF",
    "Generate 4 logo variations for my bakery",
    "Solve this olympiad problem step by step",
    "Write a song about summer, please",
    "Fix a bug that spans 30 files with an agent",
    "Draw a cat in a spacesuit",
    "Translate this 10-page contract into Spanish",
    "Make a 30-second video of a city at night",
    "Write a 3,000-word short story",
    "Explain quantum computing like I'm five",
  ],
  examplesShown: 6,
  // words added to the keyword rules of data.js (CATEGORY_RULES) at runtime
  extraWords: {
    agent: ["web app", "mobile app", "website", "build me"],
  },
  reasoningCues: ["step by step", "prove", "think hard", "olympiad", "deep thinking"],
  reasoningOnReasoning: 1.5,
  // duration assumed when a video / audio request names none
  defaultSeconds: { video: 5, "audio-gen": 30 },
  maxCount: 1000,        // "N images" cap
  writeVerbs: ["write", "draft", "compose", "generate", "create", "produce"],
  // log bar endpoints (looked up in data.js)
  barLowRef: { list: "elec", id: "google" },
  barHighPrompt: "vid5",
  forced: {
    water: [(r) => r.id === "shower" || r.id === "coffee" || r.tag === "animal"],
    elec:  [(r) => r.id === "phone" || r.id === "led-hour" || r.id === "pedal-sec" || r.id === "pedal-hour"],
  },
  disclaimer: "Rough estimates with large uncertainty — they depend on the model, hardware, data center and how you count. Treat them as orders of magnitude.",
};

// ---- Game 3: Image Duel ----
export const IMG = {
  sameBand: 0.10,        // within 10% = "about the same"
  minRatio: 1.25,
  bossMinStreak: 12,
  bossChance: 0.2,
  recentItems: 10,
  sameChance: 0.2,       // how often we try to serve an "about the same" pair
  // Option C formula: Wh ≈ k_model × megapixels × steps + base
  formulaBase: 0.05,
  kModel: { "sdxl-turbo": 0.05, "sdxl-base": 0.05, "flux-dev": 0.12, "flux-schnell": 0.10 },
  kDefault: 0.05,
  // Option B tiers (Wh/image, estimates)
  tiers: { T0: 0.1, T1: 0.5, T2: 2, T3: 5, T4: 10 },
  pairTypes: ["samePrompt", "sameSettings", "random"],
};

// ---- Game 4: Sort It ----
export const SORT = { size: 5, minSpread: 2 };

// ---- Game 5: Guess It ----
export const GUESS = {
  rounds: 10,
  min: 0.1,
  max: 100000,
  stars: [ { within: 1.3, stars: 3 }, { within: 3, stars: 2 }, { within: 10, stars: 1 } ],
};

// ---- Game 6: Real or AI? ----
// Every round: one random real picture against one random AI picture. A picture never comes back in the same game,
// so a game lasts as many rounds as the smaller of the two pools.
export const REALAI = {
  minPerSideToShow: 6,     // the game appears on the home page once realorai.json has at least this many real AND AI pictures
  lives: 3,
  maxSameSide: 3,          // the AI picture is never on the same side more than this many times in a row
  gaugeMax: 20,
};
