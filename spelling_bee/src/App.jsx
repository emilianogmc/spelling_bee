import { useCallback, useEffect, useRef, useState } from "react";
import PracticeTab from "./components/PracticeTab.jsx";
import ProgressTab from "./components/ProgressTab.jsx";
import SttDebug from "./components/SttDebug.jsx";
import TabBar, { TABS } from "./components/TabBar.jsx";
import TtsDebug from "./components/TtsDebug.jsx";
import VerdictSheet from "./components/VerdictSheet.jsx";
import WordsTab from "./components/WordsTab.jsx";
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
  const [tab, setTab] = useState("practice");
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

  // Choosing a set to drill is a practice decision, so it hands the speller
  // back to the drill rather than leaving them to find the tab themselves.
  const pickPool = useCallback(
    (next) => {
      setFilter(next);
      setTab("practice");
    },
    [setFilter]
  );

  const micHint = IOS_DEVICE
    ? "Voice input on iPhone and iPad needs Safari."
    : "Voice input needs Chrome, Edge, or Safari.";

  const streak = current ? progress[current]?.streak ?? 0 : 0;
  const verdictOpen = tab === "practice" && Boolean(feedback);

  return (
    <div className="min-h-screen pb-[92px]">
      <header className="mx-auto w-full max-w-[560px] px-4 pt-7 pb-5">
        <h1 className="font-display text-2xl font-semibold">
          {TABS.find((t) => t.id === tab)?.label}
        </h1>
      </header>

      <main className="mx-auto w-full max-w-[560px] px-4">
        {tab === "practice" && (
          <PracticeTab
            filter={filter}
            remaining={remaining}
            current={current}
            streak={streak}
            answer={answer}
            onAnswerChange={setAnswer}
            onSubmit={handleSubmit}
            onSkip={advance}
            onSpeak={() => say(current)}
            onSpellOut={spellAloud}
            onToggleMic={toggleMic}
            speaking={speaking}
            listening={listening}
            micSupported={micSupported}
            micHint={micHint}
            heard={heard}
            interim={interim}
            micError={micError}
            restartUsed={restartUsed}
            ttsError={ttsError}
            verdictOpen={verdictOpen}
          />
        )}

        {tab === "progress" && (
          <ProgressTab
            words={words}
            progress={progress}
            current={current}
            counts={counts}
            filter={filter}
            onPick={pickPool}
          />
        )}

        {tab === "words" && (
          <WordsTab
            words={words}
            onSave={setWords}
            onReset={resetProgress}
            rate={rate}
            onRateChange={setRate}
            autoMic={autoMic}
            autoMicCapable={AUTO_MIC_CAPABLE}
            micSupported={micSupported}
            onToggleAutoMic={toggleAutoMic}
          />
        )}

        {(TTS_DEBUG || STT_DEBUG) && (
          <div className="mt-8 flex flex-col gap-5">
            {TTS_DEBUG && <TtsDebug snapshot={ttsSnapshot} log={ttsLog} error={ttsError} />}
            {STT_DEBUG && <SttDebug log={micLog} target={current} heard={heard} />}
          </div>
        )}
      </main>

      {verdictOpen && <VerdictSheet feedback={feedback} onContinue={advance} />}

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
