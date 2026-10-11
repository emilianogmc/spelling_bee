import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KEY_AUTOMIC,
  KEY_DRAFT,
  KEY_PROGRESS,
  KEY_WORDS,
  cleanProgress,
  cleanWords,
  countStatuses,
  migrateStorage,
  poolFor,
  recordAnswer,
  shuffle,
  splitWords,
  statusOf,
} from "./progress.js";

/** Just enough of localStorage to run migrations against. */
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    data,
  };
}

test("a missed word is hard, not new, even though its streak is 0", () => {
  const progress = { a: 0, b: 1, c: 2, d: 3, e: 7 };
  assert.equal(statusOf("a", progress), "hard");
  assert.equal(statusOf("b", progress), "learning");
  assert.equal(statusOf("c", progress), "learning");
  assert.equal(statusOf("d", progress), "mastered");
  assert.equal(statusOf("e", progress), "mastered");
  assert.equal(statusOf("never-tried", progress), "new");
});

test("a pool holds exactly the words in that status, and all means a copy of every word", () => {
  const words = ["a", "b", "c", "d"];
  const progress = { a: 0, b: 1, c: 3 };
  assert.deepEqual(poolFor("hard", words, progress), ["a"]);
  assert.deepEqual(poolFor("learning", words, progress), ["b"]);
  assert.deepEqual(poolFor("mastered", words, progress), ["c"]);
  assert.deepEqual(poolFor("new", words, progress), ["d"]);
  const all = poolFor("all", words, progress);
  assert.deepEqual(all, words);
  assert.notEqual(all, words);
});

test("shuffle returns a reordering of a copy and leaves the original alone", () => {
  const list = Array.from({ length: 50 }, (_, i) => i);
  const before = [...list];
  const out = shuffle(list);
  assert.deepEqual(list, before);
  assert.deepEqual([...out].sort((x, y) => x - y), before);
  assert.deepEqual(shuffle([]), []);
  assert.deepEqual(shuffle(["only"]), ["only"]);
});

test("a right answer extends the streak, a miss resets it to hard", () => {
  let progress = recordAnswer({}, "milieu", true);
  progress = recordAnswer(progress, "milieu", true);
  assert.equal(progress.milieu, 2);
  progress = recordAnswer(progress, "milieu", true);
  assert.equal(statusOf("milieu", progress), "mastered");
  progress = recordAnswer(progress, "milieu", false);
  assert.equal(progress.milieu, 0);
  assert.equal(statusOf("milieu", progress), "hard");
});

test("counts add up to the word list", () => {
  const counts = countStatuses(["a", "b", "c", "d", "e"], { a: 0, b: 1, c: 3 });
  assert.deepEqual(counts, { all: 5, new: 2, learning: 1, hard: 1, mastered: 1 });
});

test("old records convert without loss and junk is dropped", () => {
  assert.deepEqual(
    cleanProgress({
      profligate: { streak: 2, lastWrong: false },
      milieu: { streak: 0, lastWrong: true },
      sapiential: 3,
      broken: { streak: -1 },
      half: 1.5,
      text: "3",
      nothing: null,
    }),
    { profligate: 2, milieu: 0, sapiential: 3 }
  );
  assert.deepEqual(cleanProgress(null), {});
  assert.deepEqual(cleanProgress([1, 2]), {});
  assert.deepEqual(cleanProgress("garbage"), {});
});

test("a stored word list is trimmed, folded and rejected when empty", () => {
  assert.deepEqual(cleanWords([" Milieu", "milieu", "", 4, "requiem "]), ["Milieu", "requiem"]);
  assert.equal(cleanWords([]), null);
  assert.equal(cleanWords("milieu"), null);
});

test("the old keys carry over once, and are kept, not deleted", () => {
  const storage = memoryStorage({
    "sb-progress": JSON.stringify({ profligate: { streak: 2, lastWrong: false }, milieu: { streak: 0, lastWrong: true } }),
    "sb-words": JSON.stringify(["profligate", "milieu"]),
    "sb-automic": "false",
    "sb-words-draft": JSON.stringify("profligate\nmilieu\nrequiem"),
  });
  const moved = migrateStorage(storage);
  assert.deepEqual(moved.sort(), ["sb-automic", "sb-progress", "sb-words", "sb-words-draft"]);
  assert.deepEqual(JSON.parse(storage.getItem(KEY_PROGRESS)), { profligate: 2, milieu: 0 });
  assert.deepEqual(JSON.parse(storage.getItem(KEY_WORDS)), ["profligate", "milieu"]);
  assert.equal(JSON.parse(storage.getItem(KEY_AUTOMIC)), false);
  assert.equal(JSON.parse(storage.getItem(KEY_DRAFT)), "profligate\nmilieu\nrequiem");
  assert.ok(storage.getItem("sb-progress"), "old key is left in place");

  // Running again finds nothing to do.
  assert.deepEqual(migrateStorage(storage), []);
});

test("migration never overwrites newer data", () => {
  const storage = memoryStorage({
    "sb-progress": JSON.stringify({ profligate: { streak: 3 } }),
    [KEY_PROGRESS]: JSON.stringify({ profligate: 1 }),
  });
  assert.deepEqual(migrateStorage(storage), []);
  assert.deepEqual(JSON.parse(storage.getItem(KEY_PROGRESS)), { profligate: 1 });
});

test("malformed old data is skipped rather than carried over or thrown on", () => {
  const storage = memoryStorage({
    "sb-progress": "{not json",
    "sb-words": JSON.stringify({ not: "a list" }),
    "sb-automic": JSON.stringify("yes"),
  });
  assert.deepEqual(migrateStorage(storage), []);
  assert.equal(storage.getItem(KEY_PROGRESS), null);
  assert.equal(storage.getItem(KEY_WORDS), null);
  assert.equal(storage.getItem(KEY_AUTOMIC), null);
});

test("blocked storage is survivable", () => {
  const blocked = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("SecurityError");
    },
  };
  assert.deepEqual(migrateStorage(blocked), []);
});

test("a set can be one comb cluster or one word", async () => {
  const { poolLabel } = await import("./progress.js");
  const words = Array.from({ length: 45 }, (_, i) => `w${i}`);
  assert.deepEqual(poolFor("cluster:0", words, {}), words.slice(0, 19));
  assert.deepEqual(poolFor("cluster:2", words, {}), words.slice(38, 45));
  assert.deepEqual(poolFor("cluster:9", words, {}), []);
  assert.deepEqual(poolFor("word:w7", words, {}), ["w7"]);
  assert.deepEqual(poolFor("word:missing", words, {}), []);
  assert.equal(poolLabel("cluster:2"), "Cluster 3");
  assert.equal(poolLabel("word:milieu"), "One word", "a one-word set never prints its spelling");
  assert.equal(poolLabel("hard"), "Hard words");
});

test("a cell's fill is the real streak, and every status differs in shape", async () => {
  const { cellState } = await import("./progress.js");
  const progress = { a: 0, b: 1, c: 2, d: 3 };
  assert.deepEqual(cellState("new-word", progress), { status: "new", streak: null, fill: 0 });
  assert.deepEqual(cellState("a", progress), { status: "hard", streak: 0, fill: 1 });
  assert.deepEqual(cellState("b", progress), { status: "learning", streak: 1, fill: 1 / 3 });
  assert.deepEqual(cellState("c", progress), { status: "learning", streak: 2, fill: 2 / 3 });
  assert.deepEqual(cellState("d", progress), { status: "mastered", streak: 3, fill: 1 });
});

test("history counts tries and misses and keeps the last misspelling", async () => {
  const { recordHistory } = await import("./progress.js");
  let h = recordHistory({}, "milieu", { correct: false, attempt: "milleu", at: 1000 });
  h = recordHistory(h, "milieu", { correct: true, attempt: "milieu", at: 2000 });
  assert.deepEqual(h.milieu, { tries: 2, misses: 1, last: 2000, lastMiss: "milleu" });
  h = recordHistory(h, "requiem", { correct: true, attempt: "requiem", at: 3000 });
  assert.deepEqual(h.requiem, { tries: 1, misses: 0, last: 3000 });
});

test("stored history is checked entry by entry", async () => {
  const { cleanHistory } = await import("./progress.js");
  assert.deepEqual(
    cleanHistory({
      ok: { tries: 3, misses: 1, last: 5, lastMiss: "x" },
      tooManyMisses: { tries: 1, misses: 2, last: 5 },
      noTime: { tries: 1, misses: 0 },
      zero: { tries: 0, misses: 0, last: 5 },
      junk: "yes",
    }),
    { ok: { tries: 3, misses: 1, last: 5, lastMiss: "x" } }
  );
  assert.deepEqual(cleanHistory(null), {});
});

test("a pasted list splits on lines, commas, semicolons and tabs, without numbering", () => {
  assert.deepEqual(splitWords("apple, banana;cherry\tdate\n\n"), ["apple", "banana", "cherry", "date"]);
  assert.deepEqual(splitWords("1. apple\n2) banana\n- cherry\n• date"), ["apple", "banana", "cherry", "date"]);
  // Spaces, hyphens and apostrophes inside a word stay.
  assert.deepEqual(splitWords("ice cream\nwell-known\no'clock"), ["ice cream", "well-known", "o'clock"]);
  assert.deepEqual(splitWords("12\n, ,"), []);
});
