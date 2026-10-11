export const KEY_DRAFT = "sb.draft";
export const KEY_PROGRESS = "sb.progress";
export const KEY_WORDS = "sb.words";
export const KEY_AUTOMIC = "sb.automic";
export const KEY_HISTORY = "sb.history";
export const KEY_RATE = "sb.rate";

/** Reading speed, kept inside the slider's own range. */
export function cleanRate(raw) {
  return typeof raw === "number" && Number.isFinite(raw) ? Math.min(1, Math.max(0.4, raw)) : 0.75;
}

/** Where the version that won the bee kept the same four things. */
export const LEGACY_KEYS = {
  [KEY_PROGRESS]: "sb-progress",
  [KEY_WORDS]: "sb-words",
  [KEY_AUTOMIC]: "sb-automic",
  [KEY_DRAFT]: "sb-words-draft",
};

export function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked — ignore
  }
}

export const MASTERY_STREAK = 3;

/**
 * A word's record is its current run of correct answers. Missing means never
 * tried; 0 means the last answer was a miss, which is what makes a word hard.
 * The undefined check has to come first and has to be exact: a falsy check
 * catches 0 too, and then no word can ever be hard.
 */
export function statusOf(word, progress) {
  const streak = progress[word];
  if (streak === undefined) return "new";
  if (streak >= MASTERY_STREAK) return "mastered";
  if (streak === 0) return "hard";
  return "learning";
}

/** Words in a comb cluster: nineteen consecutive words of the list, which
    is how the comb lays them out. Kept in step with comb.js's CLUSTER_SIZE. */
export const CLUSTER_SIZE = 19;

/**
 * Which words are eligible to drill right now, given a filter: the whole
 * list, one status, one comb cluster ("cluster:2"), or one word ("word:milieu").
 */
export function poolFor(filter, words, progress) {
  if (filter === "all") return [...words];
  if (filter.startsWith("cluster:")) {
    const n = Number(filter.slice("cluster:".length));
    return Number.isInteger(n) && n >= 0 ? words.slice(n * CLUSTER_SIZE, (n + 1) * CLUSTER_SIZE) : [];
  }
  if (filter.startsWith("word:")) {
    const word = filter.slice("word:".length);
    return words.includes(word) ? [word] : [];
  }
  return words.filter((word) => statusOf(word, progress) === filter);
}

const STATUS_POOL_LABEL = {
  all: "All words",
  new: "Untested",
  learning: "Learning",
  hard: "Hard words",
  mastered: "Mastered",
};

/** How a set is named on the drill screen. A one-word set is never named by
    its word: that would print the spelling above the speller's attempt. */
export function poolLabel(filter) {
  if (filter.startsWith("cluster:")) return `Cluster ${Number(filter.slice(8)) + 1}`;
  if (filter.startsWith("word:")) return "One word";
  return STATUS_POOL_LABEL[filter] ?? "All words";
}

/**
 * How a word's comb cell is drawn. The comb fills with honey as the list is
 * learned, and the fill is the real streak: empty until tried, a third and two
 * thirds full while learning, full when mastered. A hard word is full but
 * vermilion and holed, so every status differs in shape as well as colour.
 */
export function cellState(word, progress) {
  const status = statusOf(word, progress);
  const streak = progress[word];
  const fill = status === "new" ? 0 : status === "learning" ? streak / MASTERY_STREAK : 1;
  return { status, streak: streak ?? null, fill };
}

// Fisher–Yates on a copy. The semicolons matter: a line that starts with `[`
// otherwise continues the line above it as an index expression.
export function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function recordAnswer(progress, word, correct) {
  return { ...progress, [word]: correct ? (progress[word] ?? 0) + 1 : 0 };
}

export function countStatuses(words, progress) {
  const tally = { all: words.length, new: 0, learning: 0, hard: 0, mastered: 0 };
  words.forEach((word) => {
    tally[statusOf(word, progress)] += 1;
  });
  return tally;
}

/**
 * Stored progress can be anything: this version's plain streak numbers, the
 * old { streak, lastWrong } records, or something hand-edited or truncated.
 * Only whole, non-negative streaks survive. The old format converts without
 * loss, because lastWrong was only ever true when the streak was 0.
 */
export function cleanProgress(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [word, value] of Object.entries(raw)) {
    const streak = typeof value === "number" ? value : value?.streak;
    if (Number.isInteger(streak) && streak >= 0) out[word] = streak;
  }
  return out;
}

/**
 * What happened each time a word was scored: how often it was tried and
 * missed, when it was last practised, and the last way it was misspelt. Kept
 * on this device only, under its own key, so the progress format the drill
 * depends on stays exactly as it was.
 */
export function recordHistory(history, word, { correct, attempt, at }) {
  const prev = history[word] ?? { tries: 0, misses: 0 };
  const next = { tries: prev.tries + 1, misses: prev.misses + (correct ? 0 : 1), last: at };
  const lastMiss = correct ? prev.lastMiss : attempt;
  if (lastMiss) next.lastMiss = lastMiss;
  return { ...history, [word]: next };
}

export function cleanHistory(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [word, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== "object") continue;
    const { tries, misses, last, lastMiss } = entry;
    if (!Number.isInteger(tries) || tries < 1) continue;
    if (!Number.isInteger(misses) || misses < 0 || misses > tries) continue;
    if (!Number.isFinite(last)) continue;
    out[word] = { tries, misses, last };
    if (typeof lastMiss === "string" && lastMiss) out[word].lastMiss = lastMiss;
  }
  return out;
}

/** A stored word list, trimmed and folded the way the Words tab saves one,
    or null when there is nothing usable in it. */
/**
 * One entry per line, or per comma, semicolon or tab, since lists get pasted
 * from documents and spreadsheets; a pasted "apple, banana" used to save as
 * one word that could never be spelled right. List numbering and bullets
 * ("1.", "2)", "-", "•") are dropped. Spaces, hyphens and apostrophes inside
 * an entry stay, for words like "ice cream" and "o'clock".
 */
export function splitWords(text) {
  return text
    .split(/[\n\r,;\t]+/)
    .map((entry) => entry.replace(/^\s*(?:\d+[.)]|[-*•·])\s*/, "").trim())
    .filter((entry) => /[a-z]/i.test(entry));
}

export function cleanWords(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const out = [];
  raw.forEach((item) => {
    if (typeof item !== "string") return;
    const word = item.trim();
    if (!word || seen.has(word.toLowerCase())) return;
    seen.add(word.toLowerCase());
    out.push(word);
  });
  return out.length ? out : null;
}

const CLEANERS = {
  [KEY_PROGRESS]: (raw) => {
    const progress = cleanProgress(raw);
    return Object.keys(progress).length ? progress : null;
  },
  [KEY_WORDS]: cleanWords,
  [KEY_AUTOMIC]: (raw) => (typeof raw === "boolean" ? raw : null),
  [KEY_DRAFT]: (raw) => (typeof raw === "string" ? raw : null),
};

/**
 * Carries a speller's data over from the old sb-* keys, once. A key is only
 * filled while its new home is empty, so this can never overwrite anything
 * newer, and the old keys are left where they are: if anything about the move
 * turns out wrong, nothing was lost. Returns the old keys it carried over.
 */
export function migrateStorage(storage) {
  const moved = [];
  try {
    const store = storage ?? globalThis.localStorage;
    for (const [key, legacy] of Object.entries(LEGACY_KEYS)) {
      if (store.getItem(key) !== null) continue;
      const raw = store.getItem(legacy);
      if (raw === null) continue;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      const value = CLEANERS[key](parsed);
      if (value === null) continue;
      store.setItem(key, JSON.stringify(value));
      moved.push(legacy);
    }
  } catch {
    // Storage blocked entirely (private mode, a locked-down profile): there is
    // nothing to read and nowhere to write, so the drill runs in-session.
  }
  return moved;
}
