export const KEY_DRAFT = "sb.draft";
export const KEY_PROGRESS = "sb.progress";
export const KEY_WORDS = "sb.words";
export const KEY_AUTOMIC = "sb.automic";

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

// Called by ProgressTab.jsx:29 and ProgressComb.jsx:104,118.
// Must return one of the four keys of STATUS in ProgressComb.jsx.
export function statusOf(word, progress) {
    const record = progress[word]
    if (!record) return "new";
    if (record >= MASTERY_STREAK) return "mastered";
    if (record === 0) return "hard";
    return "learning";
}

// Which words are eligible to drill right now, given a filter.
// FILTER_LABEL in PracticeTab.jsx:31 lists the five filter values.
export function poolFor(filter, words, progress) {

    if (filter === "all") return words
    return words.filter((word) => (statusOf(word, progress)))

}


export function shuffle(list) {
    const out = [...list]

    for (let i = out.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1))

        [out[i], out[j]] = [out[j], out[i]]
    }
}
