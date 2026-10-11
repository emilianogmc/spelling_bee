import { NOT_A_LETTER, isNearMiss, isTruncated } from "./letters.js";

/**
 * Only letters are spelled. A custom list can hold "o'clock", "well-known" or
 * "café", and a voice can only say letters, so both sides are compared as
 * plain a–z: accents folded, everything else dropped.
 */
export function lettersOf(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * How one answer is judged. A spoken answer that differs only by sound-alike
 * letters, or that is too little of the word to judge, is the microphone's
 * fault rather than the speller's, so it comes back "unclear" or "truncated"
 * and is not scored. A typed answer gets no such leniency. Empty input is no
 * answer.
 */
export function judgeAnswer(raw, target, { fromVoice = false } = {}) {
  const answer = lettersOf(raw);
  const goal = lettersOf(target);
  // The recogniser heard a word that is no letter name: nothing it says about
  // this attempt can be trusted, right or wrong.
  if (fromVoice && (raw || "").includes(NOT_A_LETTER)) return goal ? "unclear" : null;
  if (!answer || !goal) return null;
  if (answer === goal) return "correct";
  if (fromVoice && isNearMiss(answer, goal)) return "unclear";
  if (fromVoice && isTruncated(answer, goal)) return "truncated";
  return "wrong";
}

/**
 * Letter-by-letter alignment of an attempt against the target, so a miss can
 * show exactly where it went wrong. Levenshtein with a backtrace; each step is
 * a match, a substitution, a letter the speller added, or one they left out.
 */
export function alignLetters(attempt, target) {
  const a = (attempt || "").toLowerCase();
  const t = (target || "").toLowerCase();
  const rows = a.length + 1;
  const cols = t.length + 1;
  const cost = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) cost[i][0] = i;
  for (let j = 0; j < cols; j++) cost[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const same = a[i - 1] === t[j - 1] ? 0 : 1;
      cost[i][j] = Math.min(cost[i - 1][j - 1] + same, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }

  const steps = [];
  let i = a.length;
  let j = t.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + (a[i - 1] === t[j - 1] ? 0 : 1)) {
      steps.push({ op: a[i - 1] === t[j - 1] ? "match" : "sub", heard: a[i - 1], target: t[j - 1] });
      i--;
      j--;
    } else if (j > 0 && cost[i][j] === cost[i][j - 1] + 1) {
      steps.push({ op: "missing", heard: null, target: t[j - 1] });
      j--;
    } else {
      steps.push({ op: "extra", heard: a[i - 1], target: null });
      i--;
    }
  }
  return steps.reverse();
}

/**
 * The target spelling, letter by letter, marked for display on a miss: which
 * letters the speller got wrong or left out, and where they added one that
 * isn't there. An added letter has no target letter to mark, so it is recorded
 * against the letter it was squeezed in front of.
 */
export function targetMarks(attempt, target) {
  const letters = [];
  let extraPending = false;
  for (const step of alignLetters(attempt, target)) {
    if (step.op === "extra") {
      extraPending = true;
      continue;
    }
    letters.push({ ch: step.target, fixed: step.op !== "match", extraBefore: extraPending });
    extraPending = false;
  }
  return { letters, extraAfter: extraPending };
}
