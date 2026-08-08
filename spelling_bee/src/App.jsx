import { useCallback, useEffect, useRef, useState } from "react";
import DrillCard from "./components/DrillCard.jsx";
import ProgressComb from "./components/ProgressComb.jsx";
import SttDebug from "./components/SttDebug.jsx";
import TtsDebug from "./components/TtsDebug.jsx";
import WordListEditor from "./components/WordListEditor.jsx";
import { useDrill } from "./hooks/useDrill.js";
import { useSpeechSynth } from "./hooks/useSpeechSynth.js";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition.js";
import { KEY_AUTOMIC, loadStored, saveStored } from "./lib/progress.js";
import { isIOS } from "./lib/platform.js";

/** A beat of silence after the voice stops, so the mic doesn't catch the tail. */
const MIC_ARM_DELAY = 300;

const IOS_DEVICE = isIOS();

// iOS Safari rejects a mic start that isn't inside a direct tap, so auto-mic
// can only run on platforms without that restriction.
const AUTO_MIC_CAPABLE = !IOS_DEVICE;

const DEBUG =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("debug")
    : null;
const TTS_DEBUG = DEBUG === "tts";
const STT_DEBUG = DEBUG === "stt";

export default function App() {
  const {
    words,
    setWords,
    progress,
    filter,
    setFilter,
    current,
    feedback,
    submit,
    advance,
    counts,
    remaining,
    resetProgress,
  } = useDrill();

  const [answer, setAnswer] = useState("");
  const [rate, setRate] = useState(0.75);
  const [editorOpen, setEditorOpen] = useState(false);
  const [autoMic, setAutoMic] = useState(
    () => AUTO_MIC_CAPABLE && loadStored(KEY_AUTOMIC, true) !== false
  );

  const {
    speak,
    cancel,
    speaking,
    error: ttsError,
    log: ttsLog,
    snapshot: ttsSnapshot,
  } = useSpeechSynth();

  // say() and armMic() are defined below the recognition hook but are needed by
  // its callbacks, so they are reached through refs.
  const sayRef = useRef(null);
  const armMicRef = useRef(null);
  const armTimerRef = useRef(null);
  // Chrome refuses — and can wedge on — speech queued before the first
  // interaction, so the word is not read aloud until the page has been touched.
  const interactedRef = useRef(false);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (interacted) return undefined;
    const unlock = () => {
      interactedRef.current = true;
      setInteracted(true);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [interacted]);

  useEffect(() => saveStored(KEY_AUTOMIC, autoMic), [autoMic]);

  const handleVoiceResult = useCallback(
    (letters) => {
      if (!letters) return;
      setAnswer(letters);
      // A mic mix-up holds the same word, so open the mic again for another try.
      if (submit(letters, { fromVoice: true }) === "unclear") armMicRef.current?.();
    },
    [submit]
  );

  // "May I start over?" mid-spelling: wipe the attempt and read the word again.
  const handleVoiceRestart = useCallback(() => {
    setAnswer("");
    sayRef.current?.(current);
  }, [current]);

  const {
    supported: micSupported,
    listening,
    heard,
    interim,
    error: micError,
    restartUsed,
    start,
    stop,
    reset: resetMic,
    log: micLog,
  } = useSpeechRecognition({
    target: current ?? "",
    onResult: handleVoiceResult,
    onRestart: handleVoiceRestart,
  });

  const clearArmTimer = useCallback(() => {
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  }, []);

  const armMic = useCallback(() => {
    clearArmTimer();
    if (!AUTO_MIC_CAPABLE || !autoMic || !micSupported || micError) return;
    armTimerRef.current = setTimeout(() => {
      armTimerRef.current = null;
      start();
    }, MIC_ARM_DELAY);
  }, [autoMic, clearArmTimer, micError, micSupported, start]);

  // One rule for everything the app says: mic off while the voice talks, mic
  // back on the moment it stops.
  const say = useCallback(
    (text, options) => {
      clearArmTimer();
      if (!text) return;
      resetMic();
      speak(text, { rate, ...options, onEnd: () => armMicRef.current?.() });
    },
    [clearArmTimer, rate, resetMic, speak]
  );

  useEffect(() => {
    armMicRef.current = armMic;
    sayRef.current = say;
  }, [armMic, say]);

  useEffect(() => clearArmTimer, [clearArmTimer]);

  // Say each new word and clear the previous attempt. The very first word waits
  // for a tap: speaking before any interaction is refused by Chrome and can
  // leave the synthesiser unable to speak for the rest of the page's life.
  useEffect(() => {
    setAnswer("");
    resetMic();
    if (interactedRef.current) say(current);
    // Rate changes shouldn't re-trigger speech on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const handleSubmit = useCallback(() => {
    if (!answer.trim()) {
      say(current);
      return;
    }
    submit(answer);
  }, [answer, current, say, submit]);

  const toggleMic = useCallback(() => {
    clearArmTimer();
    if (listening) {
      stop();
      return;
    }
    cancel();
    start();
  }, [cancel, clearArmTimer, listening, start, stop]);

  const toggleAutoMic = useCallback(() => {
    if (!AUTO_MIC_CAPABLE) return;
    clearArmTimer();
    const next = !autoMic;
    setAutoMic(next);
    // Switching it on mid-word should open the mic now, not one word from now.
    if (next && current && micSupported && !micError && !listening && !speaking) start();
  }, [
    autoMic,
    clearArmTimer,
    current,
    listening,
    micError,
    micSupported,
    speaking,
    start,
  ]);

  const spellAloud = useCallback(() => {
    say(current, { rate: 0.8, spellOut: true });
  }, [current, say]);

  return (
    <div className="flex min-h-screen justify-center px-4 pt-8 pb-16">
      <div className="w-full max-w-[1020px]">
        <p className="mb-1.5 font-mono text-xs uppercase tracking-[0.14em] text-honey">
          Finals — Monday
        </p>
        <h1 className="mb-1 font-display text-4xl font-semibold tracking-tight">
          Spelling drill
        </h1>
        <p className="mb-6 text-sm text-muted">
          Hear it, spell it, get the miss corrected out loud.
        </p>

        <div className="grid items-stretch gap-5 lg:grid-cols-[1.75fr_1fr]">
          <div className="flex min-w-0 flex-col gap-5">
            <DrillCard
              filter={filter}
              counts={counts}
              onFilterChange={setFilter}
              remaining={remaining}
              current={current}
              answer={answer}
              onAnswerChange={setAnswer}
              onSubmit={handleSubmit}
              onSkip={advance}
              onSpeak={() => say(current)}
              onSpellOut={{ aloud: spellAloud, toggleMic }}
              speaking={speaking}
              rate={rate}
              onRateChange={setRate}
              listening={listening}
              micSupported={micSupported}
              autoMic={autoMic}
              autoMicCapable={AUTO_MIC_CAPABLE}
              iosDevice={IOS_DEVICE}
              onToggleAutoMic={toggleAutoMic}
              heard={heard}
              interim={interim}
              micError={micError}
              ttsError={ttsError}
              restartUsed={restartUsed}
              feedback={feedback}
              onToggleEditor={() => setEditorOpen((open) => !open)}
            />

            {editorOpen && (
              <WordListEditor words={words} onSave={setWords} onReset={resetProgress} />
            )}

            {TTS_DEBUG && (
              <TtsDebug snapshot={ttsSnapshot} log={ttsLog} error={ttsError} />
            )}

            {STT_DEBUG && <SttDebug log={micLog} target={current} heard={heard} />}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex-1 rounded-xl border border-line bg-surface px-6 py-5">
              <h2 className="mb-3.5 font-display text-base font-semibold">Progress comb</h2>
              <ProgressComb words={words} progress={progress} current={current} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
