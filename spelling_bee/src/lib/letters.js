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
  return CONFUSABLE.some((pair) => pair.includes(a) && pair.includes(b));
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
 * True when the transcript is the target's own opening letters and simply
 * stops early — the signature of a recogniser losing the tail of the audio
 * rather than of a speller getting it wrong. Requires most of the word to be
 * there, so a genuinely abandoned attempt still counts as a miss.
 */
export function isTruncated(heard, target) {
  if (!heard || heard.length >= target.length) return false;
  if (!target.startsWith(heard)) return false;
  const missing = target.length - heard.length;
  return missing <= 3 && heard.length >= Math.ceil(target.length / 2);
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

/**
 * Turn a raw transcript into a letter string.
 * The target word is stripped out so the competition ritual works:
 * "milieu, M-I-L-I-E-U, milieu" parses to "milieu".
 */
export function transcriptToLetters(raw, target = "") {
  if (!raw) return "";
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const out = [];
  const lowerTarget = target.toLowerCase();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === "double" && i + 1 < tokens.length) {
      const next = tokens[i + 1];
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
    if (LETTER_MAP[token]) {
      out.push(LETTER_MAP[token]);
      continue;
    }
    if (NATO[token]) {
      out.push(NATO[token]);
      continue;
    }
    out.push(token);
  }

  return out.join("");
}
