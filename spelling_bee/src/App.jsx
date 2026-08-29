import { useCallback, useEffect, useRef, useState } from "react";
import PracticeTab from "./components/PracticeTab.jsx";
import ProgressTab from "./components/ProgressTab.jsx";
import SttDebug from "./components/SttDebug.jsx";
import TabBar, { TABS } from "./components/TabBar.jsx";
import TtsDebug from "./components/TtsDebug.jsx";
import WordsTab from "./components/WordsTab.jsx";
import { useDefinition } from "./hooks/useDefinition.js";
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
  // idle | loading | speaking | not-found | error — where a definition
  // lookup started for `current` currently stands.
  const [defineState, setDefineState] = useState("idle");
  const define = useDefinition();

  const {
    speak,
    cancel,
    speaking,
    error: ttsError,
    log: ttsLog,
    snapshot: ttsSnapshot,
  } = useSpeechSynth();

  // say(), armMic() and the recogniser's own reset() are all defined below the
  // recognition hook but are needed by its callbacks, so they are reached
  // through refs.
  const sayRef = useRef(null);
  const armMicRef = useRef(null);
  const resetMicRef = useRef(null);
  const armTimerRef = useRef(null);
  // Chrome refuses — and can wedge on — speech queued before the first
  // interaction, so the word is not read aloud until the page has been touched.
  const interactedRef = useRef(false);
  const [interacted, setInteracted] = useState(false);
  // A definition lookup is async and the word can move on before it answers
  // — a skip, an advance — so the callback checks this rather than trusting
  // its own closed-over `current`.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

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
      // A mic mix-up holds the same word, so open the mic again for another try.
      // Its letters deliberately never reach the input: parking a rejected
      // reading there turns the next "Check" tap into a scored miss.
      if (submit(letters, { fromVoice: true }) === "unclear") {
        // Wipe the rejected letters first. They are what the retry message is
        // about, so leaving them on screen would suppress it — and on iOS,
        // where nothing re-arms the mic to clear them, suppress it for good.
        resetMicRef.current?.();
        armMicRef.current?.();
        return;
      }
      setAnswer(letters);
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
  // back on the moment it stops. A caller can still ride along on that same
  // end — the definition's status resets that way — as long as the mic still
  // gets the last word.
  const say = useCallback(
    (text, { onEnd, ...options } = {}) => {
      clearArmTimer();
      if (!text) return;
      resetMic();
      speak(text, {
        rate,
        ...options,
        onEnd: () => {
          onEnd?.();
          armMicRef.current?.();
        },
      });
    },
    [clearArmTimer, rate, resetMic, speak]
  );

  useEffect(() => {
    armMicRef.current = armMic;
    sayRef.current = say;
    resetMicRef.current = resetMic;
  }, [armMic, resetMic, say]);

  useEffect(() => clearArmTimer, [clearArmTimer]);

  // Say each new word and clear the previous attempt. The very first word waits
  // for a tap: speaking before any interaction is refused by Chrome and can
  // leave the synthesiser unable to speak for the rest of the page's life.
  useEffect(() => {
    setAnswer("");
    resetMic();
    setDefineState("idle");
    if (interactedRef.current) say(current);
    // Rate changes shouldn't re-trigger speech on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // The effect above runs before the page has been touched, so the very first
  // word is skipped and nothing else would ever go back for it: the drill sat
  // silent until the speller pressed something. Say it the moment the gate
  // opens instead.
  useEffect(() => {
    if (interacted) sayRef.current?.(current);
    // Only the unlock matters here; a new word is the other effect's job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interacted]);

  const handleSubmit = useCallback(() => {
    if (!answer.trim()) {
      say(current);
      return;
    }
    // The voice path closes the mic on its way to a result; a typed answer
    // never did, so the mic stayed open through the verdict and carried on
    // transcribing the room.
    resetMicRef.current?.();
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

  // Real bees answer this from the judges' own dictionary; this one asks an
  // actual dictionary rather than shipping a second, hand-written copy of the
  // word list that would drift the moment the Words tab edits the first one.
  // Spoken only — there is nowhere on this screen to put a paragraph of text,
  // and the speller's eyes are on the word, not the app.
  const defineAloud = useCallback(async () => {
    if (!current) return;
    const word = current;
    clearArmTimer();
    resetMicRef.current?.();
    setDefineState("loading");

    const { text, status } = await define(word);
    // The word moved on while this was in flight — a skip, an advance — so
    // whatever answer just arrived belongs to a question nobody is asking.
    if (word !== currentRef.current) return;

    if (status !== "ok") {
      setDefineState(status === "aborted" ? "idle" : status);
      return;
    }
    setDefineState("speaking");
    say(text, { onEnd: () => setDefineState("idle") });
  }, [clearArmTimer, current, define, say]);

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

  return (
    <div className="flex min-h-[100dvh] flex-col pb-[72px]">
      {/* The drill's own screen carries no title bar: the tab bar already names
          it, and that space is the scarcest thing on a phone. */}
      {tab === "practice" ? (
        <h1 className="sr-only">Practice</h1>
      ) : (
        <header className="mx-auto w-full max-w-[560px] px-4 pt-7 pb-5">
          <h1 className="font-display text-2xl font-semibold">
            {TABS.find((t) => t.id === tab)?.label}
          </h1>
        </header>
      )}

      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pt-5">
        {tab === "practice" && (
          <PracticeTab
            filter={filter}
            remaining={remaining}
            current={current}
            streak={streak}
            answer={answer}
            onAnswerChange={setAnswer}
            onSubmit={handleSubmit}
            onAdvance={advance}
            onSpeak={() => say(current)}
            onSpellOut={spellAloud}
            onDefine={defineAloud}
            defineState={defineState}
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
            feedback={feedback}
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

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
