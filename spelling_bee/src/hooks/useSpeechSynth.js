import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Chrome has refused `speechSynthesis.speak()` without user activation since
 * M71, and a call made before the first interaction can leave the utterance
 * queued but never started — every later, legitimately-gestured call then
 * queues behind it and is never spoken either. So the gate is checked before
 * anything is handed to the queue rather than after.
 */
function hasUserActivation() {
  if (typeof navigator === "undefined") return true;
  const activation = navigator.userActivation;
  // Safari exposes no signal; it rejects an ungestured call harmlessly.
  if (!activation) return true;
  return activation.hasBeenActive;
}

const LOG_LIMIT = 20;
// A click landing this soon after the last one is treated as an accidental
// repeat (double-fire, impatient re-click) rather than a fresh request, so it
// can't cancel an utterance before it has had a chance to actually start.
const REPEAT_GUARD_MS = 400;
// Desktop Chrome has a long-standing bug where speak() silently wedges:
// .speaking latches true, onstart never fires, and nothing plays or errors —
// forever, until something forces it loose. This is how long onstart gets
// before that's assumed to have happened.
const WATCHDOG_MS = 400;
const MAX_RETRIES = 2;

export function useSpeechSynth() {
  const voiceRef = useRef(null);
  // Chromium can collect an utterance that nothing else references before it
  // reaches the synthesiser, which fails silently — so hold on to it.
  const utteranceRef = useRef(null);
  const tokenRef = useRef(0);
  const timerRef = useRef(null);
  const watchdogRef = useRef(null);
  const lastSpeakAtRef = useRef(0);

  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Repeated identical lines (a rapid-click storm) collapse into one entry
  // with a counter, so the log keeps its earliest — and most diagnostic —
  // entries instead of being pushed out by duplicates.
  const note = useCallback((entry) => {
    const stamp = new Date().toISOString().slice(14, 22);
    setLog((prev) => {
      const last = prev[prev.length - 1];
      if (last) {
        const match = last.match(/^(\d\d:\d\d\.\d\d) (.*?)(?: ×(\d+))?$/);
        if (match && match[2] === entry) {
          const count = (match[3] ? Number(match[3]) : 1) + 1;
          return [...prev.slice(0, -1), `${stamp} ${entry} ×${count}`];
        }
      }
      return [...prev.slice(-(LOG_LIMIT - 1)), `${stamp} ${entry}`];
    });
  }, []);

  useEffect(() => {
    if (!supported) return undefined;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      // A local voice is preferred over a network-backed one ("Google US
      // English"), which goes silent when its backend is unreachable.
      voiceRef.current =
        voices.find((v) => v.lang === "en-US" && v.localService) ||
        voices.find((v) => v.lang === "en-US") ||
        voices.find((v) => v.lang?.startsWith("en")) ||
        voices[0] ||
        null;
    };

    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
    // Deliberately no cancel() here. Voice loading must never touch playback:
    // this cleanup used to kill whatever was speaking.
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
  }, [supported]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const speak = useCallback(
    (text, { rate = 0.8, spellOut = false, onEnd } = {}) => {
      if (!text) return;
      // No synthesiser at all still has to release the caller, or a drill that
      // opens the mic from onEnd never opens it once.
      if (!supported) {
        onEnd?.();
        return;
      }
      const synth = window.speechSynthesis;

      if (!hasUserActivation()) {
        setError("blocked-until-you-interact");
        note(`skipped "${text}" — no user activation yet`);
        return;
      }

      // A click landing within the guard window of the last one is ignored
      // rather than allowed to cancel what's in flight. Without this, rapid
      // re-clicks cancel each other in a chain and nothing is ever audible:
      // every attempt dies before its own onstart can fire.
      const now = Date.now();
      const sinceLast = now - lastSpeakAtRef.current;
      if (sinceLast < REPEAT_GUARD_MS && (synth.speaking || synth.pending)) {
        note(`held off repeat "${text}" (${sinceLast}ms since last)`);
        return;
      }
      lastSpeakAtRef.current = now;

      const token = (tokenRef.current += 1);
      const isCurrent = () => tokenRef.current === token;
      // The caller re-opens the mic from onEnd, so every way this can finish —
      // spoken, errored, or a wedged engine we gave up on — has to reach it,
      // exactly once. Missing it leaves the mic shut for the rest of the drill.
      let handedOff = false;
      const handOff = () => {
        if (handedOff) return;
        handedOff = true;
        onEnd?.();
      };
      clearTimer();
      clearWatchdog();

      const payload = spellOut ? text.toUpperCase().split("").join(", ") : text;

      // A fresh SpeechSynthesisUtterance per attempt, rather than reusing one
      // across cancel()+retry — Chrome can carry stuck per-utterance engine
      // state across a cancel. `withVoice=false` drops the explicit voice
      // binding, in case that specific voice's engine handle is what's wedged
      // rather than the engine as a whole.
      const build = (withVoice) => {
        const utterance = new SpeechSynthesisUtterance(payload);
        if (withVoice && voiceRef.current) utterance.voice = voiceRef.current;
        utterance.lang = "en-US";
        utterance.rate = rate;

        // A retry cancels the previous attempt, and that cancel fires a late
        // error event on an utterance we have already abandoned. The token
        // alone can't tell the two apart — both belong to this speak() call —
        // so liveness is pinned to the utterance the ref currently holds.
        const isLive = () => isCurrent() && utteranceRef.current === utterance;

        utterance.onstart = () => {
          if (!isLive()) return;
          clearWatchdog();
          setSpeaking(true);
          setError(null);
          note(`start "${payload}"`);
        };
        utterance.onend = () => {
          if (!isLive()) return;
          clearWatchdog();
          setSpeaking(false);
          utteranceRef.current = null;
          note("end");
          handOff();
        };
        utterance.onerror = (event) => {
          if (!isLive()) return;
          clearWatchdog();
          setSpeaking(false);
          utteranceRef.current = null;
          const reason = event?.error || "unknown";
          setError(reason);
          note(`error ${reason}`);
          handOff();
        };
        return utterance;
      };

      // A synthesiser left paused swallows everything queued after it.
      if (synth.paused) {
        synth.resume();
        note("resumed a paused synthesiser");
      }

      // Desktop Chrome can accept an utterance and latch .speaking true while
      // never actually starting it — no onstart, no onerror, no audio, and no
      // way out except cancelling and trying again with a new utterance.
      const attempt = (retriesLeft) => {
        const withVoice = retriesLeft > 0;
        const utterance = build(withVoice);
        utteranceRef.current = utterance;
        note(`speak "${payload}"${withVoice ? "" : " (no explicit voice)"}`);
        synth.speak(utterance);

        watchdogRef.current = setTimeout(() => {
          watchdogRef.current = null;
          if (!isCurrent()) return;
          note(`no start after ${WATCHDOG_MS}ms — engine likely wedged`);
          // Drop the abandoned utterance before cancelling, so the error event
          // that cancel() raises is ignored rather than read as a real failure.
          utteranceRef.current = null;
          synth.cancel();
          if (retriesLeft > 0) {
            note(`retrying (${retriesLeft} left)`);
            timerRef.current = setTimeout(() => {
              timerRef.current = null;
              if (isCurrent()) attempt(retriesLeft - 1);
            }, 150);
          } else {
            note("gave up after retries");
            setError("stuck-no-start");
            setSpeaking(false);
            handOff();
          }
        }, WATCHDOG_MS);
      };

      const busy = synth.speaking || synth.pending;
      note(`busy=${busy} before "${payload}"`);

      if (!busy) {
        // Nothing to interrupt, so the first attempt queues inside the
        // click's own task — Safari wants speak() in the gesture's call
        // stack, and there is no cancel() to race with.
        attempt(MAX_RETRIES);
        return;
      }

      // Something is mid-utterance. Cancelling and queueing in the same tick
      // is the case WebKit drops, so the replacement waits a beat.
      synth.cancel();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (isCurrent()) attempt(MAX_RETRIES);
      }, 60);
    },
    [clearTimer, clearWatchdog, note, supported]
  );

  const cancel = useCallback(() => {
    tokenRef.current += 1;
    clearTimer();
    clearWatchdog();
    if (supported) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
  }, [clearTimer, clearWatchdog, supported]);

  // Live state for the ?debug=tts panel.
  const snapshot = useCallback(() => {
    if (!supported) return { supported: false };
    const synth = window.speechSynthesis;
    const voice = voiceRef.current;
    return {
      supported: true,
      voices: (synth.getVoices() || []).length,
      voice: voice
        ? `${voice.name} · ${voice.lang} · ${voice.localService ? "local" : "network"}`
        : "none selected",
      speaking: synth.speaking,
      pending: synth.pending,
      paused: synth.paused,
      activated: hasUserActivation(),
    };
  }, [supported]);

  return { speak, cancel, speaking, supported, error, log, snapshot };
}
