import { useCallback, useEffect, useRef, useState } from "react";
import { isOnTrack, isSpokenWord, pickTranscript, splitOnRestart, transcriptToLetters } from "../lib/letters.js";

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

// An exact match used to be the only way a session could end itself, which
// punished exactly one person: the speller who got it right. Their last letter
// has to be transcribed before the match can fire, and if it arrives late or
// slightly wrong the recogniser just kept respawning forever. So silence ends
// the turn too — generously, since spellers pause to think mid-word.
const IDLE_MS = 3000;
// Still the word's own opening letters, so either the speller is mid-word or
// the recogniser has stalled: Chrome's real engine was seen holding results
// back for several seconds on a slow connection, and the old three seconds
// then judged half a spelling. Short of the word but on track waits longer.
const ON_TRACK_IDLE_MS = 6000;

// A recogniser that ends almost as soon as it starts, hearing nothing, is
// failing rather than bridging a silence. This many in a row stops the mic.
const QUICK_END_MS = 1000;
const MAX_QUICK_ENDS = 5;

// What each fatal recognition error is called. "no-speech" and "aborted" are
// not here: those end an instance, and onend bridges the gap with a new one.
const ERRORS = {
  "not-allowed": "Microphone blocked — allow access in your browser.",
  "service-not-allowed": "Speech recognition is switched off.",
  network: "Recognition needs an internet connection.",
  "audio-capture": "No microphone was found.",
};

/**
 * `respawn` is off where a recogniser may only be started inside a tap (iOS
 * Safari). There, an instance the engine ends itself can't be replaced from
 * onend: the new start() is refused as "not-allowed", which showed as "Mic
 * blocked." and lost the letters. Instead the turn ends with what was heard.
 */
export function useSpeechRecognition({ target, onResult, onRestart, respawn = true }) {
  // Known from the first render, so a browser that has recognition never
  // paints a frame of "type the spelling here" first.
  const [supported, setSupported] = useState(
    () => typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [interim, setInterim] = useState(false);
  const [error, setError] = useState(null);
  const [restartUsed, setRestartUsed] = useState(false);
  // Raw, pre-parser record of what the engine actually returned. Every fix
  // attempted for the dropped-final-letter bug reasoned about post-processed
  // output; this is the only way to tell "never transcribed" from "parsed away".
  const [log, setLog] = useState([]);

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
  const idleTimerRef = useRef(null);
  // The word itself was said, not spelled. Heard alone, it ends the turn as
  // "heard the word, not its letters" rather than waiting on letters forever.
  const wordSaidRef = useRef(false);
  const quickEndsRef = useRef(0);

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

  const note = useCallback((entry) => {
    const stamp = new Date().toISOString().slice(14, 22);
    setLog((prev) => [...prev.slice(-59), `${stamp} ${entry}`]);
  }, []);

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

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // Hands the buffer over exactly once, whichever comes first: the recogniser
  // ending, or the settle timeout.
  const hand = useCallback(() => {
    onResultRef.current?.(bufferRef.current, { wordOnly: !bufferRef.current && wordSaidRef.current });
  }, []);

  const deliverBuffer = useCallback(() => {
    if (!deliverOnEndRef.current) return;
    deliverOnEndRef.current = false;
    clearSettleTimer();
    flushPending();
    hand();
  }, [clearSettleTimer, flushPending, hand]);

  // Throws a session away: detached first, so none of its late events count,
  // then aborted, so it stops listening without finishing its audio.
  const discard = useCallback(() => {
    const old = recogRef.current;
    recogRef.current = null;
    try {
      old?.abort();
    } catch {
      /* already stopped */
    }
  }, []);

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
      clearIdleTimer();

      if (!deliver || immediate) {
        deliverOnEndRef.current = false;
        clearSettleTimer();
        flushPending();
        halt();
        setListening(false);
        if (deliver) hand();
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
    [clearIdleTimer, clearSettleTimer, deliverBuffer, flushPending, halt, hand]
  );

  /**
   * Restarts the "they've stopped spelling" countdown. Called on every result
   * and on every respawn, so it only actually fires once letters stop arriving.
   * Nothing heard yet means the speller hasn't begun — that waits indefinitely,
   * unless they said the word and then nothing.
   */
  const armIdle = useCallback(
    (goal, soFar) => {
      clearIdleTimer();
      if (!wantsMicRef.current) return;
      if (!soFar && !wordSaidRef.current) return;
      idleTimerRef.current = setTimeout(
        () => finish(true, { immediate: true }),
        goal && isOnTrack(soFar, goal) ? ON_TRACK_IDLE_MS : IDLE_MS
      );
    },
    [clearIdleTimer, finish]
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

    // An instance that was replaced still fires its last events, and its onend
    // used to spawn a second recogniser beside the live one (seen with
    // Chrome's real engine after a retry). Only the current instance counts.
    const live = () => recogRef.current === recog;
    const spawnedAt = Date.now();
    let heardAnything = false;

    recog.onstart = () => {
      if (!live()) return;
      setListening(true);
      setError(null);
      note("start");
    };
    recog.onspeechstart = () => note("speechstart");
    recog.onspeechend = () => note("speechend");
    recog.onaudioend = () => note("audioend");

    recog.onresult = (event) => {
      if (!live()) return;
      // A session that was judged or discarded can still be finishing its
      // audio. Only a stop that owes a result still reads it.
      if (!wantsMicRef.current && !deliverOnEndRef.current) return;
      heardAnything = true;
      const goal = (targetRef.current || "").toLowerCase();
      let pending = "";

      // Logged before a single character is parsed, quoted so trailing spaces
      // and punctuation are visible.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const raw = event.results[i];
        const alts = [];
        for (let j = 0; j < raw.length; j++) alts.push(JSON.stringify(raw[j].transcript));
        note(`result[${i}] final=${raw.isFinal} alts=${alts.join(" | ")}`);
      }

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (isSpokenWord(result[0].transcript, goal)) wordSaidRef.current = true;

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
            wordSaidRef.current = false;
            onRestartRef.current?.();
          }
          const tail = transcriptToLetters(rest, goal);
          if (result.isFinal) bufferRef.current += tail;
          else pending += tail;
          continue;
        }

        // Read every alternative the recogniser offers for this chunk, not
        // just its top guess: see pickTranscript for why. Safari's
        // run-together transcript ("P", "PR", "PRO" … "PROFLIGATE") is part
        // of the same pass — a reading that completes the whole word beats
        // one that strips to nothing, which is why alternatives are read
        // against the target and read literally both.
        const alts = [];
        for (let j = 0; j < result.length; j++) alts.push(result[j].transcript);
        const best = pickTranscript(alts, goal, bufferRef.current, pending, { interim: !result.isFinal });

        if (result.isFinal) bufferRef.current += best;
        else pending += best;
      }

      pendingRef.current = pending;
      setHeard(bufferRef.current + pending);
      setInterim(Boolean(pending));
      note(`parsed -> buffer="${bufferRef.current}" pending="${pending}"`);

      // Check against the interim text too. Waiting for the recogniser to
      // finalise the last letter adds a second or more of dead air on a word
      // the speller has already finished. The word is complete, so there is
      // nothing left in flight to settle for.
      const soFar = bufferRef.current + pending;
      if (goal && soFar === goal) {
        finish(true, { immediate: true });
        return;
      }

      // Letters are still coming in, so push the silence deadline back.
      armIdle(goal, soFar);
    };

    // Anything but a silence or an abort stops the mic and says why. Only a
    // blocked mic used to stop it: offline or with no microphone, each error's
    // onend respawned a recogniser that failed again, about thirty times a
    // second, while the Offline screen flickered on and off.
    recog.onerror = (event) => {
      if (!live()) return;
      note(`error ${event.error}`);
      if (event.error === "no-speech" || event.error === "aborted") return;
      wantsMicRef.current = false;
      clearIdleTimer();
      setListening(false);
      setError(ERRORS[event.error] ?? "The microphone stopped working.");
    };

    recog.onend = () => {
      if (!live()) return;
      note(`end (pending="${pendingRef.current}" buffer="${bufferRef.current}")`);
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
          hand();
          return;
        }

        quickEndsRef.current =
          !heardAnything && Date.now() - spawnedAt < QUICK_END_MS ? quickEndsRef.current + 1 : 0;
        if (quickEndsRef.current >= MAX_QUICK_ENDS) {
          wantsMicRef.current = false;
          clearIdleTimer();
          setListening(false);
          setError("The microphone keeps stopping.");
          return;
        }

        if (!respawn) {
          if (bufferRef.current || wordSaidRef.current) {
            finish(true, { immediate: true });
            return;
          }
          wantsMicRef.current = false;
          clearIdleTimer();
          setListening(false);
          return;
        }

        const next = spawn();
        if (next) {
          try {
            next.start();
            // The gap between instances is dead air, so the countdown has to
            // survive it — otherwise a speller who pauses before their last
            // letter is judged during the handover.
            armIdle(goal, bufferRef.current);
            return;
          } catch {
            /* fall through to stopped state */
          }
        }

        // No recogniser could be restarted, so this is the end of the turn —
        // hand over what was heard rather than leaving the speller stuck.
        if (bufferRef.current) {
          finish(true, { immediate: true });
          return;
        }
      }
      setListening(false);
    };

    recogRef.current = recog;
    return recog;
  }, [armIdle, clearIdleTimer, deliverBuffer, finish, flushPending, hand, note, respawn]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(SR));
  }, []);

  useEffect(() => {
    return () => {
      wantsMicRef.current = false;
      deliverOnEndRef.current = false;
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
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
    // A new session cancels any delivery the previous one still owed, and
    // never runs beside the previous recogniser.
    discard();
    deliverOnEndRef.current = false;
    clearSettleTimer();
    clearIdleTimer();
    bufferRef.current = "";
    pendingRef.current = "";
    setHeard("");
    setInterim(false);
    setError(null);
    wantsMicRef.current = true;
    wordSaidRef.current = false;
    quickEndsRef.current = 0;

    const recog = spawn();
    if (!recog) return;
    try {
      recog.start();
    } catch {
      /* already running */
    }
  }, [clearIdleTimer, clearSettleTimer, discard, spawn, supported]);

  const stop = useCallback(() => finish(true), [finish]);

  // Everything about the current attempt goes: the session, any result it
  // still owed after "Stop and check", and its letters. Otherwise a Skip,
  // Again or tab change while checking had the old word's trailing letters
  // judged against the next word.
  const reset = useCallback(() => {
    clearIdleTimer();
    clearSettleTimer();
    wantsMicRef.current = false;
    deliverOnEndRef.current = false;
    discard();
    setListening(false);
    bufferRef.current = "";
    pendingRef.current = "";
    wordSaidRef.current = false;
    setHeard("");
    setInterim(false);
  }, [clearIdleTimer, clearSettleTimer, discard]);

  return {
    supported,
    listening,
    heard,
    interim,
    error,
    restartUsed,
    start,
    stop,
    reset,
    log,
  };
}
