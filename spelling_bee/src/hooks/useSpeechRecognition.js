import { useCallback, useEffect, useRef, useState } from "react";
import { splitOnRestart, transcriptToLetters } from "../lib/letters.js";

/**
 * Continuous letter-by-letter recognition.
 *
 * Five details matter here. Results arrive in chunks, so finalised chunks are
 * appended to a buffer rather than replacing it — otherwise "P-R-E-P-A" gets
 * wiped by the next chunk. Interim chunks are folded into that buffer before
 * an instance ends, since a recogniser discards them and a silence gap would
 * otherwise swallow every letter spoken since the last final result. stop()
 * does not end transcription — it asks the service to finish reading the audio
 * it already has — so the buffer is handed over from onend rather than from
 * the stop() call, or the trailing letter is read before it exists. Safari
 * only allows an instance to be started once, so each session gets a fresh
 * one. And every transcript is checked for "may I start over?" before it is
 * read as letters.
 */

// How long to wait after stop() for the recogniser's trailing results before
// giving up and reading the buffer anyway. onend normally arrives well inside
// this; it only exists so a recogniser that never fires it can't hang the turn.
const SETTLE_MS = 1500;

export function useSpeechRecognition({ target, onResult, onRestart }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [interim, setInterim] = useState(false);
  const [error, setError] = useState(null);
  const [restartUsed, setRestartUsed] = useState(false);

  const recogRef = useRef(null);
  const bufferRef = useRef("");
  const pendingRef = useRef("");
  const wantsMicRef = useRef(false);
  const targetRef = useRef(target);
  const onResultRef = useRef(onResult);
  const onRestartRef = useRef(onRestart);
  const restartUsedRef = useRef(false);
  // Set when a stop() owes the caller a result once the recogniser has
  // actually finished draining its audio.
  const deliverOnEndRef = useRef(false);
  const settleTimerRef = useRef(null);

  // A new word earns a fresh start-over.
  useEffect(() => {
    targetRef.current = target;
    restartUsedRef.current = false;
    setRestartUsed(false);
  }, [target]);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    onRestartRef.current = onRestart;
  }, [onRestart]);

  // Interim letters are real letters — they just haven't been finalised yet.
  // Anything still pending has to land in the buffer before it is read.
  const flushPending = useCallback(() => {
    if (!pendingRef.current) return;
    bufferRef.current += pendingRef.current;
    pendingRef.current = "";
    setHeard(bufferRef.current);
    setInterim(false);
  }, []);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  // Hands the buffer over exactly once, whichever comes first: the recogniser
  // ending, or the settle timeout.
  const deliverBuffer = useCallback(() => {
    if (!deliverOnEndRef.current) return;
    deliverOnEndRef.current = false;
    clearSettleTimer();
    flushPending();
    onResultRef.current?.(bufferRef.current);
  }, [clearSettleTimer, flushPending]);

  // True only when a live recogniser was actually asked to stop — and so an
  // onend is genuinely coming.
  const halt = useCallback(() => {
    if (!recogRef.current) return false;
    try {
      recogRef.current.stop();
      return true;
    } catch {
      return false; /* already stopped */
    }
  }, []);

  /**
   * `immediate` is for the case where the buffer already spells the target:
   * there is nothing still in flight worth waiting for, so the answer goes in
   * without the settle delay. Every other delivery waits for onend, because
   * stop() leaves the last letter still being transcribed.
   */
  const finish = useCallback(
    (deliver, { immediate = false } = {}) => {
      wantsMicRef.current = false;

      if (!deliver || immediate) {
        deliverOnEndRef.current = false;
        clearSettleTimer();
        flushPending();
        halt();
        setListening(false);
        if (deliver) onResultRef.current?.(bufferRef.current);
        return;
      }

      deliverOnEndRef.current = true;
      setListening(false);
      if (!halt()) {
        // Nothing running to drain, so there is nothing to wait for.
        deliverBuffer();
        return;
      }
      clearSettleTimer();
      settleTimerRef.current = setTimeout(deliverBuffer, SETTLE_MS);
    },
    [clearSettleTimer, deliverBuffer, flushPending, halt]
  );

  // Builds and wires a brand-new recognizer. Called for every start() and
  // again from onend whenever continuous mode needs to bridge a silence gap.
  const spawn = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const recog = new SR();
    recog.lang = "en-US";
    recog.continuous = true;
    recog.interimResults = true;
    recog.maxAlternatives = 6;

    recog.onstart = () => {
      setListening(true);
      setError(null);
    };

    recog.onresult = (event) => {
      const goal = (targetRef.current || "").toLowerCase();
      let pending = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        // "May I start over?" — throw away the tangled attempt and read the word
        // again. Only the first request per word is honoured; later ones are
        // still stripped out so the phrase never lands in the buffer as letters.
        const { restart, rest } = splitOnRestart(result[0].transcript, goal);
        if (restart) {
          if (!restartUsedRef.current) {
            restartUsedRef.current = true;
            setRestartUsed(true);
            bufferRef.current = "";
            pending = "";
            onRestartRef.current?.();
          }
          const tail = transcriptToLetters(rest, goal);
          if (result.isFinal) bufferRef.current += tail;
          else pending += tail;
          continue;
        }

        let best = "";

        for (let j = 0; j < result.length; j++) {
          const candidate = transcriptToLetters(result[j].transcript, goal);
          if (!best) best = candidate;
          if (goal && bufferRef.current + candidate === goal) {
            best = candidate;
            break;
          }
        }

        if (result.isFinal) bufferRef.current += best;
        else pending += best;
      }

      pendingRef.current = pending;
      setHeard(bufferRef.current + pending);
      setInterim(Boolean(pending));

      // Check against the interim text too. Waiting for the recogniser to
      // finalise the last letter adds a second or more of dead air on a word
      // the speller has already finished. The word is complete, so there is
      // nothing left in flight to settle for.
      if (goal && bufferRef.current + pending === goal) {
        finish(true, { immediate: true });
      }
    };

    recog.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wantsMicRef.current = false;
        setListening(false);
        setError("Microphone blocked — allow access in your browser.");
      } else if (event.error === "network") {
        setError("Recognition needs an internet connection.");
      }
    };

    recog.onend = () => {
      // A recogniser throws away its interim results when it ends, so a
      // silence gap mid-word would otherwise wipe every letter spoken since
      // the last final chunk — the speller sees their spelling reset.
      flushPending();

      // A stop() that owed a result: the trailing letters have landed by now.
      if (deliverOnEndRef.current) {
        deliverBuffer();
        return;
      }

      if (wantsMicRef.current) {
        const goal = (targetRef.current || "").toLowerCase();
        if (goal && bufferRef.current === goal) {
          wantsMicRef.current = false;
          setListening(false);
          onResultRef.current?.(bufferRef.current);
          return;
        }

        const next = spawn();
        if (next) {
          try {
            next.start();
            return;
          } catch {
            /* fall through to stopped state */
          }
        }
      }
      setListening(false);
    };

    recogRef.current = recog;
    return recog;
  }, [deliverBuffer, finish, flushPending]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(SR));
  }, []);

  useEffect(() => {
    return () => {
      wantsMicRef.current = false;
      deliverOnEndRef.current = false;
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      try {
        recogRef.current?.stop();
      } catch {
        /* nothing to stop */
      }
    };
  }, []);

  // No getUserMedia priming here on purpose. Holding a stream open kept the
  // permission grant warm, but it also kept the mic live for the whole
  // session, and macOS routes playback through voice-processing whenever a
  // mic stream is open — which silences the spoken word. The recogniser
  // prompts for permission on its own, and a secure origin remembers it.
  const start = useCallback(() => {
    if (!supported) return;
    // A new session cancels any delivery the previous one still owed.
    deliverOnEndRef.current = false;
    clearSettleTimer();
    bufferRef.current = "";
    pendingRef.current = "";
    setHeard("");
    setInterim(false);
    setError(null);
    wantsMicRef.current = true;

    const recog = spawn();
    if (!recog) return;
    try {
      recog.start();
    } catch {
      /* already running */
    }
  }, [clearSettleTimer, spawn, supported]);

  const stop = useCallback(() => finish(true), [finish]);

  const reset = useCallback(() => {
    if (wantsMicRef.current) finish(false);
    bufferRef.current = "";
    pendingRef.current = "";
    setHeard("");
    setInterim(false);
  }, [finish]);

  return { supported, listening, heard, interim, error, restartUsed, start, stop, reset };
}
