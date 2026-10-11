import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WORDS } from "../data/words.js";
import {
  KEY_HISTORY,
  KEY_PROGRESS,
  KEY_WORDS,
  MASTERY_STREAK,
  cleanHistory,
  cleanProgress,
  cleanWords,
  countStatuses,
  loadStored,
  poolFor,
  recordAnswer,
  recordHistory,
  saveStored,
  shuffle,
} from "../lib/progress.js";
import { judgeAnswer } from "../lib/scoring.js";

/** Long enough for the olive field to register from across the room, short
    enough that a run of right answers never feels like waiting. */
const ADVANCE_AFTER_CORRECT_MS = 1500;

/**
 * The drill itself: which word is up, how answers are scored, and what is
 * remembered. A pass is one shuffled trip through the chosen pool; when it
 * runs out the pass is finished and the speller sees how it went, rather than
 * being dropped straight into a reshuffle.
 */
export function useDrill() {
  const [words, setWords] = useState(() => cleanWords(loadStored(KEY_WORDS, null)) ?? DEFAULT_WORDS);
  const [progress, setProgress] = useState(() => cleanProgress(loadStored(KEY_PROGRESS, {})));
  const [history, setHistory] = useState(() => cleanHistory(loadStored(KEY_HISTORY, {})));
  const [filter, setFilter] = useState("all");
  const [current, setCurrent] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [passTotal, setPassTotal] = useState(0);
  const [passResults, setPassResults] = useState([]);
  const [finished, setFinished] = useState(false);
  // Counts passes, so a new pass that happens to open on the same word as the
  // last one (a one-word set, every time) still reads as a new turn.
  const [passId, setPassId] = useState(0);

  const queueRef = useRef([]);
  const timerRef = useRef(null);
  // A correct answer advances on a timer set before the answer was recorded,
  // so that closure's `progress` is one answer out of date — and rebuilding a
  // filtered pool from it hands the word straight back.
  const progressRef = useRef(progress);

  useEffect(() => saveStored(KEY_WORDS, words), [words]);
  useEffect(() => {
    progressRef.current = progress;
    saveStored(KEY_PROGRESS, progress);
  }, [progress]);
  useEffect(() => saveStored(KEY_HISTORY, history), [history]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPass = useCallback(
    (nextFilter, nextWords, nextProgress) => {
      clearTimer();
      const pool = shuffle(poolFor(nextFilter, nextWords, nextProgress));
      queueRef.current = pool;
      setPassId((n) => n + 1);
      setPassTotal(pool.length);
      setPassResults([]);
      setFinished(false);
      setFeedback(null);
      setCurrent(queueRef.current.pop() ?? null);
    },
    [clearTimer]
  );

  const advance = useCallback(() => {
    clearTimer();
    setFeedback(null);
    if (queueRef.current.length === 0) {
      setFinished(true);
      setCurrent(null);
      return;
    }
    setCurrent(queueRef.current.pop());
  }, [clearTimer]);

  const filterRef = useRef(filter);

  // A new word list rebuilds the pass. Progress is left out on purpose:
  // reshuffling after every answer would restart the pass mid-way. Built
  // before the first paint, so the start screen never shows "0 words".
  useLayoutEffect(() => {
    startPass(filterRef.current, words, progressRef.current);
  }, [words, startPass]);

  /** Drill a set: a status, a cluster, one word. The pass is built in the same
      update as the choice, so the old set never flashes on screen first. */
  const choose = useCallback(
    (next) => {
      filterRef.current = next;
      setFilter(next);
      startPass(next, words, progressRef.current);
    },
    [startPass, words]
  );

  useEffect(() => clearTimer, [clearTimer]);

  const newPass = useCallback(() => choose(filterRef.current), [choose]);

  const skip = useCallback(() => {
    if (current) setPassResults((prev) => [...prev, { word: current, outcome: "skipped" }]);
    advance();
  }, [advance, current]);

  /**
   * Scores one answer. Returns what happened, so the caller can reopen the
   * mic after an unclear reading: "correct", "wrong", "unclear", or null for
   * no answer at all.
   */
  const submit = useCallback(
    (raw, { fromVoice = false, helped = false, wordOnly = false } = {}) => {
      if (!current) return null;
      // The word was said but none of its letters were: not an attempt.
      if (fromVoice && wordOnly && !raw) {
        setFeedback({ kind: "unclear", heard: "", wordOnly: true });
        return "unclear";
      }
      const result = judgeAnswer(raw, current, { fromVoice });
      if (!result) return null;
      const answer = raw.trim().toLowerCase();

      if (result === "unclear" || result === "truncated") {
        setFeedback({ kind: result, heard: answer });
        return "unclear";
      }

      const correct = result === "correct";

      // Right after hearing it spelled out is repetition, not evidence: it is
      // shown as right but changes nothing the comb reports. A miss after help
      // is still a miss.
      if (correct && helped) {
        setPassResults((prev) => [...prev, { word: current, outcome: "helped", attempt: answer }]);
        setFeedback({ kind: "correct", word: current, attempt: answer, helped: true, streak: progressRef.current[current] ?? 0, mastered: false });
        clearTimer();
        timerRef.current = setTimeout(advance, ADVANCE_AFTER_CORRECT_MS);
        return result;
      }

      setProgress((prev) => recordAnswer(prev, current, correct));
      setHistory((prev) => recordHistory(prev, current, { correct, attempt: answer, at: Date.now() }));
      setPassResults((prev) => [...prev, { word: current, outcome: correct ? "right" : "missed", attempt: answer }]);

      const streak = correct ? (progressRef.current[current] ?? 0) + 1 : 0;
      setFeedback({
        kind: correct ? "correct" : "wrong",
        word: current,
        attempt: answer,
        streak,
        mastered: streak >= MASTERY_STREAK,
      });

      // A correct answer has nothing to read, so it moves on by itself. A miss
      // holds until Next, because no fixed delay is long enough for every word.
      clearTimer();
      if (correct) timerRef.current = setTimeout(advance, ADVANCE_AFTER_CORRECT_MS);
      return result;
    },
    [advance, clearTimer, current]
  );

  const counts = useMemo(() => countStatuses(words, progress), [words, progress]);

  const remaining = queueRef.current.length + (current ? 1 : 0);

  const resetProgress = useCallback(() => {
    setProgress({});
    setHistory({});
    progressRef.current = {};
    choose("all");
  }, [choose]);

  return {
    words,
    setWords,
    progress,
    history,
    filter,
    choose,
    current,
    feedback,
    submit,
    advance,
    skip,
    counts,
    remaining,
    passId,
    passTotal,
    passResults,
    finished,
    newPass,
    resetProgress,
  };
}
