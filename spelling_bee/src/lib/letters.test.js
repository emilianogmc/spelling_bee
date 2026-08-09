import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isConfusable,
  isNearMiss,
  isTruncated,
  splitOnRestart,
  transcriptToLetters,
} from "./letters.js";

test("the bee ritual keeps only the spelling", () => {
  assert.equal(transcriptToLetters("milieu, M-I-L-I-E-U, milieu", "milieu"), "milieu");
});

test("letter names and NATO words both parse", () => {
  assert.equal(transcriptToLetters("bee ee ay", ""), "bea");
  assert.equal(transcriptToLetters("papa bravo double u", ""), "pbw");
  assert.equal(transcriptToLetters("double l", ""), "ll");
});

test("a run-together transcript survives when read literally", () => {
  // Safari returns spelled letters as one word. Stripping it against the
  // target deletes a correct spelling for being correct, which is why the
  // recogniser reads every alternative both ways.
  assert.equal(transcriptToLetters("profligate", "profligate"), "");
  assert.equal(transcriptToLetters("profligate", ""), "profligate");
});

test("start over is split off and the letters after it are kept", () => {
  const { restart, rest } = splitOnRestart("may I start over, R-E-C", "");
  assert.equal(restart, true);
  assert.equal(transcriptToLetters(rest, ""), "rec");
});

test("the word being spelled is never a start-over request", () => {
  assert.equal(splitOnRestart("restart", "restart").restart, false);
  assert.equal(splitOnRestart("start over", "restart").restart, true);
});

test("a correct prefix that stops short is a truncation", () => {
  assert.equal(isTruncated("profliga", "profligate"), true);
  assert.equal(isTruncated("prof", "profligate"), false); // too little to assume a lost tail
  assert.equal(isTruncated("profligatx", "profligate"), false); // wrong, not short
});

test("only confusable substitutions count as a near miss", () => {
  assert.equal(isNearMiss("brofligate", "profligate"), true); // B heard for P
  assert.equal(isNearMiss("profligate", "profligate"), false); // nothing to excuse
  assert.equal(isNearMiss("profligrte", "profligate"), false); // A and R sound nothing alike
  assert.equal(isConfusable("b", "b"), false); // a letter is not confusable with itself
});
