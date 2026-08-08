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

const LOG_LIMIT = 12;

export function useSpeechSynth() {
  const voiceRef = useRef(null);
  // Chromium can collect an utterance that nothing else references before it
  // reaches the synthesiser, which fails silently — so hold on to it.
  const utteranceRef = useRef(null);
  const tokenRef = useRef(0);
  const timerRef = useRef(null);

  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const note = useCallback((entry) => {
    const stamp = new Date().toISOString().slice(14, 22);
    setLog((prev) => [...prev.slice(-(LOG_LIMIT - 1)), `${stamp} ${entry}`]);
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

  const speak = useCallback(
    (text, { rate = 0.8, spellOut = false, onEnd } = {}) => {
      if (!supported || !text) return;
      const synth = window.speechSynthesis;

      if (!hasUserActivation()) {
        setError("blocked-until-you-interact");
        note(`skipped "${text}" — no user activation yet`);
        return;
      }

      const token = (tokenRef.current += 1);
      const isCurrent = () => tokenRef.current === token;
      clearTimer();

      const payload = spellOut ? text.toUpperCase().split("").join(", ") : text;
      const utterance = new SpeechSynthesisUtterance(payload);
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.lang = "en-US";
      utterance.rate = rate;

      utterance.onstart = () => {
        if (!isCurrent()) return;
        setSpeaking(true);
        setError(null);
        note(`start "${payload}"`);
      };
      utterance.onend = () => {
        if (!isCurrent()) return;
        setSpeaking(false);
        utteranceRef.current = null;
        note("end");
        onEnd?.();
      };
      utterance.onerror = (event) => {
        if (!isCurrent()) return;
        setSpeaking(false);
        utteranceRef.current = null;
        const reason = event?.error || "unknown";
        setError(reason);
        note(`error ${reason}`);
      };

      utteranceRef.current = utterance;

      // A synthesiser left paused swallows everything queued after it.
      if (synth.paused) {
        synth.resume();
        note("resumed a paused synthesiser");
      }

      const busy = synth.speaking || synth.pending;
      note(`speak "${payload}" (busy=${busy})`);

      if (!busy) {
        // Nothing to interrupt, so queue it inside the click's own task —
        // Safari wants speak() in the gesture's call stack, and there is no
        // cancel() to race with.
        synth.speak(utterance);
        return;
      }

      // Something is mid-utterance. Cancelling and queueing in the same tick
      // is the case WebKit drops, so the replacement waits a beat.
      synth.cancel();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (isCurrent()) synth.speak(utterance);
      }, 60);
    },
    [clearTimer, note, supported]
  );

  const cancel = useCallback(() => {
    tokenRef.current += 1;
    clearTimer();
    if (supported) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
  }, [clearTimer, supported]);

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
