const KEY_PROGRESS = "sb-progress";
const KEY_WORDS = "sb-words";
const KEY_AUTOMIC = "sb-automic";
/** The word list as it is being edited, which is not the word list. Kept apart
    so leaving the tab mid-edit doesn't drill a half-typed list — or lose it. */
const KEY_DRAFT = "sb-words-draft";

export const MASTERY_STREAK = 3;

export function statusOf(word, progress) {
  const entry = progress[word];
  if (!entry) return "new";
  if (entry.streak >= MASTERY_STREAK) return "mastered";
  if (entry.lastWrong) return "hard";
  return "learning";
}

export function poolFor(filter, words, progress) {
  if (filter === "all") return [...words];
  return words.filter((word) => statusOf(word, progress) === filter);
}

export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function loadStored(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveStored(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — run in-session only */
  }
}

export { KEY_AUTOMIC, KEY_DRAFT, KEY_PROGRESS, KEY_WORDS };
