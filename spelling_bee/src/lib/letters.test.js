import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isConfusable,
  isNearMiss,
  isOnTrack,
  isRunTogether,
  isSpokenWord,
  isTruncated,
  pickTranscript,
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
  // Safari returns spelled letters as one capitalised word. Stripping it
  // against the target deletes a correct spelling for being correct, which is
  // why the recogniser reads every alternative both ways.
  assert.equal(transcriptToLetters("PROFLIGATE", "profligate"), "");
  assert.equal(transcriptToLetters("PROFLIGATE", ""), "profligate");
});

test("double before a letter doubles it, in any case", () => {
  assert.equal(transcriptToLetters("C O double L E C T I O N S", "collections"), "collections");
  assert.equal(transcriptToLetters("S H R U double B E R Y", "shrubbery"), "shrubbery");
  assert.equal(transcriptToLetters("double U", ""), "w");
  assert.equal(transcriptToLetters("Double-U", ""), "w");
});

test("the word said as words is stripped like the word itself", () => {
  assert.equal(transcriptToLetters("ice cream i c e c r e a m", "icecream"), "icecream");
  assert.equal(transcriptToLetters("o'clock o c l o c k", "oclock"), "oclock");
  assert.equal(transcriptToLetters("well-known w e l l k n o w n", "wellknown"), "wellknown");
  // Single letters that happen to spell it are the spelling, not the word.
  assert.equal(transcriptToLetters("c a t", "cat"), "cat");
});

test("X-ray is the spelling alphabet's X", () => {
  assert.equal(transcriptToLetters("X-ray", ""), "x");
  assert.equal(transcriptToLetters("x ray", ""), "x");
});

test("the opening of the word, said, is not letters", () => {
  assert.equal(transcriptToLetters("Prof p r o f", "profligate"), "prof");
  assert.equal(pickTranscript(["Prof p r o f l i g a t e"], "profligate", ""), "profligate");
});

test("letters merged into a word count when they finish the word", () => {
  assert.equal(pickTranscript(["Pro F L I G A T E"], "profligate", ""), "profligate");
  assert.equal(pickTranscript(["ate"], "profligate", "proflig"), "ate");
  // ...but the word itself, said, still never does.
  assert.equal(pickTranscript(["profligate"], "profligate", ""), "");
});

test("a word that is no letter name is marked, not spelled", () => {
  // Chrome's real engine heard a UK voice's "P R" as "they are".
  assert.equal(transcriptToLetters("they are f l i g a t t", "profligate"), "?rfligatt");
  assert.equal(transcriptToLetters("p r um o f", "profligate"), "prof"); // a hesitation is dropped
  assert.equal(pickTranscript(["they are o", "p r o"], "profligate", ""), "pro"); // a clean lower guess wins
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

test("too little of the word to judge is a truncation, not a miss", () => {
  assert.equal(isTruncated("profliga", "profligate"), true);
  // Chrome's real engine stalled mid-word and these reached the judge: each
  // was scored a miss and printed as the word's last misspelling.
  assert.equal(isTruncated("prof", "profligate"), true);
  assert.equal(isTruncated("pr", "profligate"), true);
  assert.equal(isTruncated("del", "deductible"), true);
  assert.equal(isTruncated("r", "profligate"), true); // under half, so nothing to judge
  assert.equal(isTruncated("brofl", "profligate"), true); // on track, B heard for P
  assert.equal(isTruncated("profligatx", "profligate"), false); // wrong, not short
  assert.equal(isTruncated("proph", "profligate"), false); // already off the word
  assert.equal(isTruncated("profligate", "profligate"), false);
});

test("on track means the word's own opening, sound-alike slips allowed", () => {
  assert.equal(isOnTrack("prof", "profligate"), true);
  assert.equal(isOnTrack("brof", "profligate"), true);
  assert.equal(isOnTrack("prom", "profligate"), false);
  assert.equal(isOnTrack("profligate", "profligate"), false); // complete, not on the way
});

test("only confusable substitutions count as a near miss", () => {
  assert.equal(isNearMiss("brofligate", "profligate"), true); // B heard for P
  assert.equal(isNearMiss("profligate", "profligate"), false); // nothing to excuse
  assert.equal(isNearMiss("profligrte", "profligate"), false); // A and R sound nothing alike
  assert.equal(isConfusable("b", "b"), false); // a letter is not confusable with itself
});

test("a lower-ranked alternative wins when it names the letter actually due next", () => {
  // The engine's top guess was B; P was there too, just ranked second.
  assert.equal(pickTranscript(["bee", "pea"], "premonition", ""), "p");
  // Same shape for T/D, later in the word.
  assert.equal(pickTranscript(["dee", "tee"], "premonition", "premoni"), "t");
});

test("the top-ranked alternative still wins when it already matches", () => {
  assert.equal(pickTranscript(["pea", "bee"], "premonition", ""), "p");
});

test("no alternative names the expected letter, so the top guess stands", () => {
  // Wrong on purpose: nothing offered was ever going to be right, and
  // that miss is the speller's, not the recogniser's.
  assert.equal(pickTranscript(["bee", "dee"], "premonition", ""), "b");
});

test("a lower-ranked alternative can still complete the whole word", () => {
  // Safari's run-together transcript, as logged: the top-ranked guess is
  // mangled, but a lower-ranked alternative, read literally, spells the
  // entire target.
  assert.equal(pickTranscript(["BROFLIGATE", "PROFLIGATE"], "profligate", ""), "profligate");
  assert.equal(pickTranscript(["PROFLIGATE"], "profligate", ""), "profligate");
});

test("saying the word is not spelling it", () => {
  // Chrome's real engine wrote the spoken word in lower or title case and the
  // app marked it right before a letter was spelled.
  assert.equal(pickTranscript(["profligate"], "profligate", ""), "");
  assert.equal(pickTranscript(["Profligate"], "profligate", ""), "");
  assert.equal(isSpokenWord("Profligate", "profligate"), true);
  assert.equal(isSpokenWord("PROFLIGATE", "profligate"), false); // Safari spelling it
  assert.equal(isSpokenWord("p r o f l i g a t e", "profligate"), false);
  // Said and then spelled still parses to the spelling.
  assert.equal(pickTranscript(["profligate p r o f l i g a t e"], "profligate", ""), "profligate");
});

test("pieces of a word still being said are not letters", () => {
  assert.equal(pickTranscript(["Prof"], "profligate", "", "", { interim: true }), "");
  assert.equal(pickTranscript(["proflig"], "profligate", "", "", { interim: true }), "");
  // Letter names and Safari's capitals are letters even mid-stream.
  assert.equal(pickTranscript(["PRO"], "profligate", "", "", { interim: true }), "pro");
  assert.equal(pickTranscript(["pea"], "profligate", "", "", { interim: true }), "p");
  assert.equal(pickTranscript(["p r o"], "profligate", "", "", { interim: true }), "pro");
});

test("only capitals read as run-together letters", () => {
  assert.equal(isRunTogether("PROFLIGAT"), true);
  assert.equal(isRunTogether("profligate"), false);
  assert.equal(isRunTogether("Profligate"), false);
  assert.equal(isRunTogether("P"), false); // one letter is just a letter
});

test("pending letters from earlier in the same event shift the expected position", () => {
  // "pr" has already been read this event but not yet committed to the
  // buffer; the next letter due is the third of the word, not the first.
  assert.equal(pickTranscript(["ee", "oh"], "premonition", "", "pr"), "e");
});
