/**
 * Speech recognizers transcribe spoken letters as words: say "B-E-A" and the
 * browser hears "bee ee ay". These maps translate that back into letters.
 */

export const LETTER_MAP = {
  a: "a", ay: "a", eh: "a", aye: "a",
  b: "b", be: "b", bee: "b", bea: "b",
  c: "c", see: "c", sea: "c", cee: "c", si: "c",
  d: "d", dee: "d", de: "d",
  e: "e", ee: "e", eee: "e",
  f: "f", ef: "f", eff: "f",
  g: "g", gee: "g", ge: "g", jee: "g",
  h: "h", aitch: "h", haitch: "h", ache: "h", etch: "h",
  i: "i", eye: "i", ai: "i",
  j: "j", jay: "j", jae: "j",
  k: "k", kay: "k", cay: "k", okay: "k",
  l: "l", el: "l", ell: "l", elle: "l",
  m: "m", em: "m", emm: "m",
  n: "n", en: "n", enn: "n",
  o: "o", oh: "o", owe: "o",
  p: "p", pee: "p", pea: "p", pe: "p",
  q: "q", cue: "q", queue: "q", kyu: "q",
  r: "r", are: "r", ar: "r", arr: "r",
  s: "s", es: "s", ess: "s", yes: "s",
  t: "t", tee: "t", tea: "t", te: "t",
  u: "u", you: "u", yu: "u", ewe: "u",
  v: "v", vee: "v", ve: "v",
  w: "w", doubleu: "w", dubya: "w", dub: "w",
  x: "x", ex: "x", eks: "x", axe: "x",
  y: "y", why: "y", wye: "y",
  z: "z", zee: "z", zed: "z", zi: "z",
};

/** Real words transcribe far more reliably than letter names. */
export const NATO = {
  alpha: "a", alfa: "a", apple: "a",
  bravo: "b", boy: "b",
  charlie: "c", charly: "c", cat: "c",
  delta: "d", dog: "d",
  echo: "e", easy: "e",
  foxtrot: "f", fox: "f",
  golf: "g", george: "g",
  hotel: "h", henry: "h",
  india: "i", item: "i",
  juliet: "j", juliett: "j", john: "j",
  kilo: "k", king: "k",
  lima: "l", love: "l",
  mike: "m", mary: "m",
  november: "n", nancy: "n",
  oscar: "o", ocean: "o",
  papa: "p", peter: "p",
  quebec: "q", queen: "q",
  romeo: "r", robert: "r",
  sierra: "s", sugar: "s",
  tango: "t", tommy: "t",
  uniform: "u", uncle: "u",
  victor: "v", victory: "v",
  whiskey: "w", whisky: "w", william: "w",
  xray: "x", yankee: "y", young: "y",
  zulu: "z", zebra: "z",
};

/** Letter pairs that sound nearly identical over a microphone. */
const CONFUSABLE = [
  "bp", "bd", "bv", "bg", "be", "bc", "bt", "pt", "pe", "pd",
  "dt", "de", "dg", "dv", "mn", "fs", "fx", "sx", "sf", "cz",
  "ce", "ct", "cd", "ge", "gj", "jk", "ka", "iy", "ae", "ai",
  "vd", "vb", "tz", "ou", "uw", "ln",
];

export function isConfusable(a, b) {
  return a !== b && CONFUSABLE.some((pair) => pair.includes(a) && pair.includes(b));
}

/** Spellings are always shown letter-separated, never as a solid word. */
export function spaced(word) {
  return (word || "").toUpperCase().split("").join("-");
}

/**
 * True when the transcript differs from the target only at positions where the
 * letters sound alike — almost certainly a mic error, not a spelling error.
 */
export function isNearMiss(heard, target) {
  if (!heard || heard.length !== target.length) return false;
  let diffs = 0;
  for (let i = 0; i < heard.length; i++) {
    if (heard[i] === target[i]) continue;
    if (!isConfusable(heard[i], target[i])) return false;
    diffs++;
  }
  return diffs > 0 && diffs <= 2;
}

/**
 * True while what has been heard is still the target's own opening letters,
 * allowing the same sound-alike slips a near miss does. It is how a spelling
 * looks part-way through, and how it looks when the recogniser stalls: Chrome's
 * real engine was seen pausing for seconds mid-word on a slow connection.
 */
export function isOnTrack(heard, target) {
  if (!heard || heard.length >= target.length) return false;
  let diffs = 0;
  for (let i = 0; i < heard.length; i++) {
    if (heard[i] === target[i]) continue;
    if (!isConfusable(heard[i], target[i])) return false;
    diffs++;
  }
  return diffs <= 2;
}

/**
 * True when what was heard is too little to judge: the opening of the word
 * that stops early, or under half of it. Both are what a stalled or cut-off
 * recogniser leaves behind, and scoring them marked words missed, and printed
 * misspellings like "P-R", for letters the speller never got wrong. A word
 * given up on is what Skip is for.
 */
export function isTruncated(heard, target) {
  if (!heard || heard.length >= target.length) return false;
  if (heard.length * 2 < target.length) return true;
  return isOnTrack(heard, target);
}

/**
 * A speller who gets tangled can ask for a clean slate the way they would at a
 * real bee: "May I start over?". The lead-in ("may I", "can I") is left out on
 * purpose — the recognizer mangles short filler words far more often than the
 * phrase itself.
 */
const RESTART_RE = /\b(?:start over|start again|begin again|start from the top|restart)\b/g;

/**
 * Split a transcript on a start-over request. Whatever follows the phrase comes
 * back as `rest`, so "may I start over, R-E-C" keeps the fresh letters — and
 * the phrase never reaches transcriptToLetters, where it would parse as junk.
 */
export function splitOnRestart(raw, target = "") {
  const text = (raw || "").toLowerCase();
  const lowerTarget = target.toLowerCase();
  RESTART_RE.lastIndex = 0;

  let match;
  let last = null;
  while ((match = RESTART_RE.exec(text)) !== null) {
    // The word itself is not a request — "restart" can be on the list.
    if (lowerTarget && lowerTarget.includes(match[0])) continue;
    last = match;
  }

  if (!last) return { restart: false, rest: raw || "" };
  return { restart: true, rest: text.slice(last.index + last[0].length) };
}

/** Hesitations, not letters. Dropped wherever they fall. */
const FILLERS = new Set(["um", "umm", "uhm", "uh", "uhh", "erm", "er", "hmm", "hm", "mm", "ah"]);

/** Stands in for a word that is no letter name: the reading can't be trusted. */
export const NOT_A_LETTER = "?";

/**
 * Turn a raw transcript into a letter string.
 * The target word is stripped out so the competition ritual works:
 * "milieu, M-I-L-I-E-U, milieu" parses to "milieu".
 *
 * Strictly read, any other word that is no letter name and no
 * spelling-alphabet word comes back as NOT_A_LETTER, except the opening of
 * the word itself ("Prof", the start of the word being said). Kept as
 * letters, a recogniser hearing "P R" as "they are" turned into T-H-E-Y-R,
 * scored as a miss and saved as the word's misspelling. Capitals are always
 * letters: Safari writes spelled letters run together that way ("PROFLIGAT").
 * `strict: false` keeps every word as letters, the old reading, which
 * pickTranscript only trusts when it completes the word ("Pro F L I G A T E").
 */
export function transcriptToLetters(raw, target = "", { strict = true } = {}) {
  if (!raw) return "";
  const tokens = raw
    // The spelling alphabet's X, as Chrome writes it.
    .replace(/\bx[\s-]?ray\b/gi, "xray")
    .replace(/[^a-z\s-]/gi, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const out = [];
  const lowerTarget = target.toLowerCase();

  // The word said as words: "ice cream" for "icecream", "o'clock" read as
  // "o clock". A run of tokens that together make the target, at least one
  // of them a whole word (a run of single letters is the spelling itself).
  const skip = new Set();
  if (lowerTarget) {
    for (let i = 0; i < tokens.length; i++) {
      let joined = "";
      for (let j = i; j < Math.min(tokens.length, i + 4); j++) {
        joined += tokens[j].toLowerCase();
        if (joined.length > lowerTarget.length) break;
        const run = tokens.slice(i, j + 1);
        if (j > i && joined === lowerTarget && run.some((t) => t.length > 1)) run.forEach((_, k) => skip.add(i + k));
      }
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    if (skip.has(i)) continue;
    const original = tokens[i];
    const token = original.toLowerCase();

    if (token === "double" && i + 1 < tokens.length) {
      const next = tokens[i + 1].toLowerCase();
      if (["u", "you", "yu"].includes(next)) {
        out.push("w");
        i++;
        continue;
      }
      if (LETTER_MAP[next]) {
        out.push(LETTER_MAP[next], LETTER_MAP[next]);
        i++;
        continue;
      }
    }

    if (lowerTarget && token === lowerTarget) continue;
    if (FILLERS.has(token)) continue;
    if (LETTER_MAP[token]) {
      out.push(LETTER_MAP[token]);
      continue;
    }
    if (NATO[token]) {
      out.push(NATO[token]);
      continue;
    }
    if (!strict || original === original.toUpperCase()) out.push(token);
    else if (lowerTarget && token.length > 1 && lowerTarget.startsWith(token)) continue;
    else out.push(NOT_A_LETTER);
  }

  return out.join("");
}

/**
 * True when a transcript is Safari's run-together spelling: spelled letters
 * written as one growing capitalised string, "P", "PR" … "PROFLIGATE". Chrome
 * writes a word that was said, not spelled, in lower or title case
 * ("profligate", "Profligate"), so only the capitalised form reads as letters.
 */
export function isRunTogether(raw) {
  const letters = (raw || "").replace(/[^a-z]/gi, "");
  return letters.length > 1 && letters === letters.toUpperCase();
}

/** True when the transcript is the word itself, said rather than spelled. */
export function isSpokenWord(raw, target = "") {
  if (!target || isRunTogether(raw)) return false;
  const letters = (raw || "").toLowerCase().replace(/[^a-z]/g, "");
  return letters === target.toLowerCase() && transcriptToLetters(raw, target) === "";
}

/**
 * A piece of a word still being said: Chrome streams a spoken word as it goes
 * ("Prof", "proflig") before settling on all of it. One lower-case token that
 * is no letter name and no spelling-alphabet word is not letters yet.
 */
function isWordFragment(raw) {
  const tokens = (raw || "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 1 || isRunTogether(raw)) return false;
  const token = tokens[0].toLowerCase().replace(/[^a-z]/g, "");
  return token.length > 1 && !LETTER_MAP[token] && !NATO[token];
}

/**
 * Chooses which of the recogniser's alternative transcripts for one chunk to
 * trust, instead of always taking its top-ranked guess.
 *
 * Voiced/voiceless pairs — P/B, T/D, K/G, F/V, S/Z — differ by a few
 * milliseconds of voice onset that this recogniser guesses wrong often
 * enough to make the drill unusable, but its own alternative list usually
 * contains the right letter anyway, just not ranked first: the engine heard
 * the ambiguity, it just resolved it the wrong way. The target word is the
 * one piece of information the engine doesn't have, so an alternative that
 * names the letter actually due next is preferred over the engine's own
 * ranking, short of a whole-word match (Safari's run-together transcript),
 * which always wins outright.
 *
 * A whole-word match only counts as letters when it is capitalised, the way
 * Safari spells. Read literally in any case, a speller saying the word before
 * spelling it, as the bee ritual has them do, was marked right before a
 * single letter.
 *
 * `alternatives` is raw transcript strings, ranked by the engine's own
 * confidence. `buffer` is what has already been committed to the answer;
 * `pending` is what this same recognition event has already added but not
 * yet committed, used only to find the position of the next expected
 * letter — the whole-word check stays keyed to `buffer` alone, matching
 * what the recogniser actually completes. `interim` marks a chunk the engine
 * may still revise, where a fragment of a spoken word is skipped.
 */
export function pickTranscript(alternatives, goal, buffer, pending = "", { interim = false } = {}) {
  const expected = goal ? goal[buffer.length + pending.length] : undefined;
  let best = null;

  for (const raw of alternatives) {
    if (interim && isWordFragment(raw)) continue;
    const stripped = transcriptToLetters(raw, goal);
    // The engine's top guess wins unless it holds a word that isn't a letter
    // and a lower guess doesn't.
    if (best === null || (best.includes(NOT_A_LETTER) && !stripped.includes(NOT_A_LETTER))) best = stripped;
    if (goal && buffer + stripped === goal) return stripped;

    // Letters the engine merged into a word ("Pro F L I G A T E") are only
    // trusted when they finish the word. The word itself is still stripped.
    const lenient = transcriptToLetters(raw, goal, { strict: false });
    if (goal && buffer + lenient === goal) return lenient;

    if (goal && isRunTogether(raw)) {
      const literal = transcriptToLetters(raw, "");
      if (buffer + literal === goal) return literal;
    }

    if (expected && stripped === expected) return stripped;
  }

  return best ?? "";
}
