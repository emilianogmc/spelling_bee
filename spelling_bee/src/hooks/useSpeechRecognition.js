import { useCallback, useEffect, useRef, useState } from "react";
import { splitOnRestart, transcriptToLetters } from "../lib/letters.js";

/**
 * Continuous letter-by-letter recognition.
 *
 * Three details matter here. Results arrive in chunks, so finalised chunks are
 * appended to a buffer rather than replacing it — otherwise "P-R-E-P-A" gets
 * wiped by the next chunk. The recogniser auto-stops on silence, so onend
 * restarts it while the user still has the mic open. And every transcript is
 * checked for "may I start over?" before it is read as letters.
 */
export function useSpeechRecognition({ target, onResult, onRestart }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [interim, setInterim] = useState(false);
  const [error, setError] = useState(null);
  const [restartUsed, setRestartUsed] = useState(false);

  const recogRef = useRef(null);
  const bufferRef = useRef("");
  const wantsMicRef = useRef(false);
  const targetRef = useRef(target);
  const onResultRef = useRef(onResult);
  const onRestartRef = useRef(onRestart);
  const restartUsedRef = useRef(false);
  const streamRef = useRef(null);

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

  const finish = useCallback((deliver) => {
    wantsMicRef.current = false;
    try {
      recogRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
    if (deliver) onResultRef.current?.(bufferRef.current);
  }, []);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return undefined;
    }
    setSupported(true);

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

      setHeard(bufferRef.current + pending);
      setInterim(Boolean(pending));

      if (goal && bufferRef.current === goal) finish(true);
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
      if (wantsMicRef.current) {
        try {
          recog.start();
        } catch {
          /* restart raced with stop */
        }
        return;
      }
      setListening(false);
    };

    recogRef.current = recog;

    return () => {
      wantsMicRef.current = false;
      try {
        recog.stop();
      } catch {
        /* nothing to stop */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [finish]);

  const start = useCallback(async () => {
    if (!recogRef.current) return;
    bufferRef.current = "";
    setHeard("");
    setInterim(false);
    setError(null);
    wantsMicRef.current = true;

    // Holding one stream open keeps the permission grant alive for the session.
    if (!streamRef.current && navigator.mediaDevices?.getUserMedia) {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        /* recognition will surface its own permission error */
      }
    }

    try {
      recogRef.current.start();
    } catch {
      /* already running */
    }
  }, []);

  const stop = useCallback(() => finish(true), [finish]);

  const reset = useCallback(() => {
    bufferRef.current = "";
    setHeard("");
    setInterim(false);
    if (wantsMicRef.current) finish(false);
  }, [finish]);

  return { supported, listening, heard, interim, error, restartUsed, start, stop, reset };
}
