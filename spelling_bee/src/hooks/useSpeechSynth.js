import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechSynth() {
  const voiceRef = useRef(null);
  // Cancelling an utterance still fires its onend, so each one carries a token
  // and only the newest is allowed to report back.
  const tokenRef = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return undefined;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      voiceRef.current =
        voices.find((v) => v.lang === "en-US") ||
        voices.find((v) => v.lang?.startsWith("en")) ||
        voices[0] ||
        null;
    };

    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speak = useCallback(
    (text, { rate = 0.8, spellOut = false, onEnd } = {}) => {
      if (!supported || !text) return;
      const token = (tokenRef.current += 1);
      const isCurrent = () => tokenRef.current === token;

      const payload = spellOut
        ? text.toUpperCase().split("").join(", ")
        : text;
      const utterance = new SpeechSynthesisUtterance(payload);
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.lang = "en-US";
      utterance.rate = rate;
      utterance.onstart = () => {
        if (isCurrent()) setSpeaking(true);
      };
      utterance.onend = () => {
        if (!isCurrent()) return;
        setSpeaking(false);
        onEnd?.();
      };
      utterance.onerror = () => {
        if (isCurrent()) setSpeaking(false);
      };

      // Safari silently drops an utterance queued in the same tick as
      // cancel() — a long-standing WebKit race — so the two are separated by
      // a beat too short to notice.
      window.speechSynthesis.cancel();
      setTimeout(() => {
        if (isCurrent()) window.speechSynthesis.speak(utterance);
      }, 50);
    },
    [supported]
  );

  const cancel = useCallback(() => {
    tokenRef.current += 1;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { speak, cancel, speaking, supported };
}
