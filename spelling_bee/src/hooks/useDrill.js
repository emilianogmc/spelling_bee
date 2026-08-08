import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WORDS } from "../data/words.js";
import { isNearMiss } from "../lib/letters.js";
import {
  KEY_PROGRESS,
  KEY_WORDS,
  MASTERY_STREAK,
  loadStored,
  poolFor,
  saveStored,
  shuffle,
  statusOf,
} from "../lib/progress.js";

export function useDrill() {
  const [words, setWords] = useState(() => {
    const stored = loadStored(KEY_WORDS, null);
    return Array.isArray(stored) && stored.length ? stored : DEFAULT_WORDS;
  });
  const [progress, setProgress] = useState(() => loadStored(KEY_PROGRESS, {}));
  const [filter, setFilter] = useState("all");
  const [current, setCurrent] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const queueRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => saveStored(KEY_WORDS, words), [words]);
  useEffect(() => saveStored(KEY_PROGRESS, progress), [progress]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advance = useCallback(() => {
    clearTimer();
    setFeedback(null);

    if (queueRef.current.length === 0) {
      queueRef.current = shuffle(poolFor(filter, words, progress));
    }
    setCurrent(queueRef.current.pop() ?? null);
  }, [clearTimer, filter, words, progress]);

  // Rebuild the queue whenever the pool itself changes.
  useEffect(() => {
    clearTimer();
    queueRef.current = shuffle(poolFor(filter, words, progress));
    setFeedback(null);
    setCurrent(queueRef.current.pop() ?? null);
    // Progress is deliberately excluded: re-shuffling after every answer would
    // restart the pass mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, words, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const submit = useCallback(
    (raw, { fromVoice = false } = {}) => {
      if (!current) return null;
      const answer = raw.trim().toLowerCase();
      if (!answer) return null;

      const target = current.toLowerCase();

      // A mic-only confusion (P heard as B) shouldn't count as a miss.
      if (fromVoice && answer !== target && isNearMiss(answer, target)) {
        setFeedback({ kind: "unclear", heard: answer });
        return "unclear";
      }

      const correct = answer === target;

      setProgress((prev) => {
        const entry = prev[current] ?? { streak: 0, lastWrong: false };
        return {
          ...prev,
          [current]: correct
            ? { streak: entry.streak + 1, lastWrong: false }
            : { streak: 0, lastWrong: true },
        };
      });

      const nextStreak = correct ? (progress[current]?.streak ?? 0) + 1 : 0;
      setFeedback({
        kind: correct ? "correct" : "wrong",
        word: current,
        streak: nextStreak,
        mastered: nextStreak >= MASTERY_STREAK,
      });

      clearTimer();
      timerRef.current = setTimeout(advance, correct ? 900 : 3400);
      return correct ? "correct" : "wrong";
    },
    [advance, clearTimer, current, progress]
  );

  const counts = useMemo(() => {
    const tally = { all: words.length, new: 0, learning: 0, hard: 0, mastered: 0 };
    words.forEach((word) => {
      tally[statusOf(word, progress)] += 1;
    });
    return tally;
  }, [words, progress]);

  const remaining = queueRef.current.length + (current ? 1 : 0);

  const resetProgress = useCallback(() => {
    setProgress({});
    setFilter("all");
  }, []);

  return {
    words,
    setWords,
    progress,
    filter,
    setFilter,
    current,
    feedback,
    setFeedback,
    submit,
    advance,
    counts,
    remaining,
    resetProgress,
  };
}
