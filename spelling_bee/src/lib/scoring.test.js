import assert from "node:assert/strict";
import { test } from "node:test";
import { alignLetters, judgeAnswer, lettersOf, targetMarks } from "./scoring.js";

test("a spelling is judged case-insensitively, and nothing typed is no answer", () => {
  assert.equal(judgeAnswer("PROFLIGATE ", "profligate"), "correct");
  assert.equal(judgeAnswer("proffligate", "profligate"), "wrong");
  assert.equal(judgeAnswer("   ", "profligate"), null);
});

test("a spoken near miss or cut-off is the mic's fault and is not scored", () => {
  assert.equal(judgeAnswer("profligade", "profligate", { fromVoice: true }), "unclear");
  assert.equal(judgeAnswer("proflig", "profligate", { fromVoice: true }), "truncated");
  assert.equal(judgeAnswer("milleu", "milieu", { fromVoice: true }), "wrong");
});

test("a stalled or cut-off attempt is not scored as a miss", () => {
  assert.equal(judgeAnswer("pr", "profligate", { fromVoice: true }), "truncated");
  assert.equal(judgeAnswer("re", "requiem", { fromVoice: true }), "truncated");
  assert.equal(judgeAnswer("profligatte", "profligate", { fromVoice: true }), "wrong");
});

test("a reading with a word that isn't a letter is not scored", () => {
  assert.equal(judgeAnswer("?rfligatt", "profligate", { fromVoice: true }), "unclear");
  assert.equal(judgeAnswer("?", "profligate", { fromVoice: true }), "unclear");
});

test("only letters are compared, so custom words with marks can be right", () => {
  assert.equal(lettersOf("O'Clock"), "oclock");
  assert.equal(lettersOf("café"), "cafe");
  assert.equal(judgeAnswer("oclock", "o'clock", { fromVoice: true }), "correct");
  assert.equal(judgeAnswer("wellknown", "well-known"), "correct");
  assert.equal(judgeAnswer("icecream", "ice cream"), "correct");
  assert.equal(judgeAnswer("cafe", "café"), "correct");
});

test("typed answers get no microphone leniency", () => {
  assert.equal(judgeAnswer("profligade", "profligate"), "wrong");
  assert.equal(judgeAnswer("proflig", "profligate"), "wrong");
});

test("alignment marks a swapped, a missing and an added letter in place", () => {
  const ops = (a, t) => alignLetters(a, t).map((s) => s.op).join(" ");
  assert.equal(ops("milieu", "milieu"), "match match match match match match");
  assert.equal(ops("milleu", "milieu"), "match match match sub match match");
  assert.equal(ops("labrinth", "labyrinth"), "match match match missing match match match match match");
  assert.equal(ops("", "abc"), "missing missing missing");
  // Which of two identical letters is the extra one is a tie; either is right.
  const extra = alignLetters("nuissance", "nuisance").filter((s) => s.op !== "match");
  assert.deepEqual(extra, [{ op: "extra", heard: "s", target: null }]);
});

test("display marks put an added letter in the gap, not on a letter", () => {
  const { letters, extraAfter } = targetMarks("proffligate", "profligate");
  assert.equal(letters.map((l) => l.ch).join(""), "profligate");
  assert.equal(letters.filter((l) => l.fixed).length, 0);
  assert.equal(letters.filter((l) => l.extraBefore).length, 1);
  assert.equal(extraAfter, false);
  assert.deepEqual(
    targetMarks("milleu", "milieu").letters.map((l) => l.fixed),
    [false, false, false, true, false, false]
  );
  assert.equal(targetMarks("requiems", "requiem").extraAfter, true);
});
