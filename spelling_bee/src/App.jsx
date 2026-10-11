import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import PracticeTab, { fieldFor } from "./components/PracticeTab.jsx";
import ProgressTab from "./components/ProgressTab.jsx";
import SttDebug from "./components/SttDebug.jsx";
import TabBar from "./components/TabBar.jsx";
import TtsDebug from "./components/TtsDebug.jsx";
import WordsTab from "./components/WordsTab.jsx";
import { useDefinition } from "./hooks/useDefinition.js";
import { useDrill } from "./hooks/useDrill.js";
import { useSpeechSynth } from "./hooks/useSpeechSynth.js";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition.js";
import { KEY_AUTOMIC, KEY_RATE, cellState, cleanRate, loadStored, saveStored } from "./lib/progress.js";
import { lettersOf } from "./lib/scoring.js";
import { isIOS } from "./lib/platform.js";

/** A beat of silence after the voice stops, so the mic doesn't catch the tail. */
const MIC_ARM_DELAY = 300;

/** How long "the voice is about to speak" or "the mic is opening" may stand in
    before the app stops waiting for the browser to confirm it. */
const VOICE_START_LIMIT = 2500;
// Long enough for a first-visit permission prompt to be read and answered.
const MIC_START_LIMIT = 15000;

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
  const drill = useDrill();
  const { words, setWords, progress, filter, current, feedback, submit, advance } = drill;

  const [answer, setAnswer] = useState("");
  const [rate, setRate] = useState(() => cleanRate(loadStored(KEY_RATE, 0.75)));
  const [tab, setTab] = useState("practice");
  // Read by callbacks that outlive a render: the voice and the mic only ever
  // work for the drill while it is the screen in front of the speller.
  const tabRef = useRef("practice");
  // What the app is saying, from the moment it asks the browser until the
  // voice ends: "word", "spell" or "definition". The browser's own speaking
  // flag only turns on once audio starts, and the gap between showed a frame
  // of "Your turn" before every word.
  const [voice, setVoice] = useState(null);
  const voiceRef = useRef(null);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);
  // The mic has been asked to open and the browser hasn't confirmed it yet.
  // Shown as the spelling screen without the live marks, not as "Your turn".
  const [arming, setArming] = useState(false);
  // A new word arrived while the drill was out of sight, so it hasn't been
  // read aloud yet.
  const [unread, setUnread] = useState(false);
  const [typing, setTyping] = useState(false);
  // Between "stop" and the recogniser's last letters landing. stop() asks the
  // engine to finish reading audio it already has, which can take a second;
  // this is that second, shown honestly as checking rather than as idle.
  const [checking, setChecking] = useState(false);
  // The voice failed to say the word (a wedged or missing synthesiser), so the
  // mic is not opened for a word the speller never heard.
  const [voiceFailed, setVoiceFailed] = useState(false);
  // "Spell it to me" was used on this word: a right answer after that is
  // repetition, and doesn't count toward mastered.
  const helpedRef = useRef(false);
  const [autoMic, setAutoMic] = useState(
    () => AUTO_MIC_CAPABLE && loadStored(KEY_AUTOMIC, true) !== false
  );
  // idle | loading | speaking | not-found | error — where a definition
  // lookup started for `current` currently stands.
  const [defineState, setDefineState] = useState("idle");
  const define = useDefinition();

  // Chrome refuses — and can wedge on — speech queued before the first
  // interaction, so nothing is read aloud until the speller presses Start.
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);

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
  // A definition lookup is async and the word can move on before it answers
  // — a skip, an advance — so the callback checks this rather than trusting
  // its own closed-over `current`.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => saveStored(KEY_AUTOMIC, autoMic), [autoMic]);
  useEffect(() => saveStored(KEY_RATE, rate), [rate]);

  // A verdict on screen means this word is judged. Nothing may open the mic
  // over it, or a reading of the printed answer would score again.
  const feedbackRef = useRef(feedback);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);
  const judged = () => ["correct", "wrong"].includes(feedbackRef.current?.kind);

  const handleVoiceResult = useCallback(
    (letters, meta) => {
      setChecking(false);
      // A late result can't rewrite a verdict already on screen.
      if (judged()) return;
      if (!letters && !meta?.wordOnly) return;
      // A mic mix-up holds the same word, so open the mic again for another try.
      // Its letters deliberately never reach the input: parking a rejected
      // reading there turns the next "Check" tap into a scored miss.
      if (submit(letters, { fromVoice: true, helped: helpedRef.current, wordOnly: meta?.wordOnly }) === "unclear") {
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
    // Letters only, so a custom word like "o'clock" can be matched as spelled.
    target: lettersOf(current),
    onResult: handleVoiceResult,
    onRestart: handleVoiceRestart,
    // The same tap rule as auto-mic: on iOS nothing may restart the mic
    // outside a tap, including the recogniser bridging a pause.
    respawn: AUTO_MIC_CAPABLE,
  });

  const clearArmTimer = useCallback(() => {
    setArming(false);
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  }, []);

  // The mic opens only for the drill, while it's on screen, for a word that
  // hasn't been judged. It used to open behind Progress after an auto-advance
  // and score narration, and over a miss after "Again", turning it into Right.
  const micAllowed = () =>
    tabRef.current === "practice" && !document.hidden && !judged() && Boolean(currentRef.current);

  const armMic = useCallback(() => {
    clearArmTimer();
    // No check on `listening` here: this runs from callbacks one render
    // behind, where it can still read true after the mic has closed, and
    // start() itself discards any recogniser that's still around.
    if (!AUTO_MIC_CAPABLE || !autoMic || !micSupported || micError || typing) return;
    if (!micAllowed()) return;
    setArming(true);
    armTimerRef.current = setTimeout(() => {
      armTimerRef.current = null;
      if (!micAllowed()) {
        setArming(false);
        return;
      }
      start();
    }, MIC_ARM_DELAY);
  }, [autoMic, clearArmTimer, micError, micSupported, start, typing]);

  useEffect(() => {
    if (listening || micError) setArming(false);
  }, [listening, micError]);

  useEffect(() => {
    if (!arming) return undefined;
    const timer = setTimeout(() => setArming(false), MIC_START_LIMIT);
    return () => clearTimeout(timer);
  }, [arming]);

  useEffect(() => {
    if (!voice || speaking) return undefined;
    const timer = setTimeout(() => setVoice(null), VOICE_START_LIMIT);
    return () => clearTimeout(timer);
  }, [voice, speaking]);

  const hush = useCallback(() => {
    cancel();
    setVoice(null);
  }, [cancel]);

  // Leaving cuts off a word mid-read: it counts as not heard yet.
  const leave = useCallback(() => {
    if (voiceRef.current === "word" || voiceRef.current === "spell") setUnread(true);
    hush();
  }, [hush]);

  // One rule for everything the app says: mic off while the voice talks, mic
  // back on the moment it stops. A caller can still ride along on that same
  // end — the definition's status resets that way — as long as the mic still
  // gets the last word.
  const say = useCallback(
    (text, { onEnd, as = "word", ...options } = {}) => {
      clearArmTimer();
      if (!text) return;
      setChecking(false);
      setVoiceFailed(false);
      resetMic();
      setVoice(as);
      if (as !== "definition") {
        setUnread(false);
        // A definition cut off by this never reaches its own end.
        setDefineState((state) => (state === "speaking" ? "idle" : state));
      }
      speak(text, {
        rate,
        ...options,
        onEnd: (result) => {
          setVoice(null);
          onEnd?.();
          if (result?.spoken === false) {
            setVoiceFailed(true);
            return;
          }
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

  // Say each new word and clear the previous attempt — once the speller has
  // started; before that, speaking would be refused and could wedge Chrome's
  // synthesiser for the rest of the page's life. Only while the drill is on
  // screen: a word that arrives behind another tab, or a hidden page, waits
  // until the speller is back. A layout effect, so the screen goes straight
  // from the last verdict to the voice with no frame in between.
  useLayoutEffect(() => {
    // Including the mic the last word was about to open: a Skip in that
    // moment on the last word would otherwise open it on "Pass complete".
    clearArmTimer();
    setAnswer("");
    setChecking(false);
    setVoiceFailed(false);
    helpedRef.current = false;
    resetMic();
    setDefineState("idle");
    setUnread(false);
    if (!startedRef.current || !current) return;
    if (tabRef.current === "practice" && !document.hidden) say(current);
    else setUnread(true);
    // Rate changes shouldn't re-trigger speech on their own. A new pass counts
    // as a new word even when it opens on the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, drill.passId]);

  const begin = useCallback(() => {
    startedRef.current = true;
    setStarted(true);
    say(currentRef.current);
  }, [say]);

  // Leaving the drill closes the mic and silences the voice: nothing should
  // keep listening to the room from behind the Progress tab. Coming back to a
  // word that arrived meanwhile reads it, as any new word is read.
  const changeTab = useCallback(
    (next) => {
      tabRef.current = next;
      if (next !== "practice") {
        clearArmTimer();
        leave();
        resetMic();
        setChecking(false);
      } else if (unread && startedRef.current && currentRef.current) {
        say(currentRef.current);
      }
      setTab(next);
    },
    [clearArmTimer, leave, resetMic, say, unread]
  );

  // A hidden page (another tab, a locked phone) gets the same: no voice, no
  // mic. The word stays, with Again to hear it.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) return;
      clearArmTimer();
      leave();
      resetMicRef.current?.();
      setChecking(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [clearArmTimer, leave]);

  const handleSubmit = useCallback(() => {
    if (!answer.trim()) {
      say(current);
      return;
    }
    // The voice path closes the mic on its way to a result; a typed answer
    // never did, so the mic stayed open through the verdict and carried on
    // transcribing the room.
    resetMicRef.current?.();
    submit(answer, { helped: helpedRef.current });
  }, [answer, current, say, submit]);

  const toggleMic = useCallback(() => {
    clearArmTimer();
    if (listening) {
      setChecking(true);
      stop();
      return;
    }
    hush();
    setChecking(false);
    setVoiceFailed(false);
    setArming(true);
    start();
  }, [clearArmTimer, hush, listening, start, stop]);

  const toggleTyping = useCallback(() => {
    clearArmTimer();
    if (!typing) resetMic();
    setTyping(!typing);
  }, [clearArmTimer, resetMic, typing]);

  const toggleAutoMic = useCallback(() => {
    if (!AUTO_MIC_CAPABLE) return;
    clearArmTimer();
    setAutoMic(!autoMic);
  }, [autoMic, clearArmTimer]);

  const spellAloud = useCallback(() => {
    helpedRef.current = true;
    say(current, { rate: 0.8, spellOut: true, as: "spell" });
  }, [current, say]);

  // Real bees answer this from the judges' own dictionary; this one asks an
  // actual dictionary rather than shipping a second, hand-written copy of the
  // word list that would drift the moment the Words tab edits the first one.
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
    say(text, { as: "definition", onEnd: () => setDefineState("idle") });
  }, [clearArmTimer, current, define, say]);

  // Choosing a set to drill is a practice decision, so it hands the speller
  // back to the drill, on a fresh pass of that set.
  const { choose } = drill;
  const pickPool = useCallback(
    (next) => {
      // The new pass reads its own first word, so nothing left unread from
      // before is read first.
      tabRef.current = "practice";
      setUnread(false);
      choose(next);
      setTab("practice");
    },
    [choose]
  );

  const micHint = IOS_DEVICE
    ? "Voice input on iPhone and iPad needs Safari, so type the spelling here."
    : "Voice input needs Chrome, Edge or Safari, so type the spelling here.";

  const cell = current ? cellState(current, progress) : null;

  const practice = {
    started,
    onBegin: begin,
    filter,
    current,
    cell,
    remaining: drill.remaining,
    passTotal: drill.passTotal,
    passResults: drill.passResults,
    finished: drill.finished,
    counts: drill.counts,
    onNewPass: drill.newPass,
    onPickPool: pickPool,
    answer,
    onAnswerChange: setAnswer,
    onSubmit: handleSubmit,
    onAdvance: advance,
    onSkip: drill.skip,
    onSpeak: () => say(current),
    onSpellOut: spellAloud,
    onDefine: defineAloud,
    defineState,
    onToggleMic: toggleMic,
    typing,
    onToggleTyping: toggleTyping,
    speaking,
    voice,
    arming,
    unread,
    listening,
    checking,
    voiceFailed,
    micSupported,
    micHint,
    heard,
    interim,
    micError,
    restartUsed,
    ttsError,
    feedback,
  };

  // The colour field belongs to the drill. The other tabs sit on ink.
  const field = tab === "practice" ? fieldFor(practice) : "ink";

  return (
    <div className={`pl pl--${field} ${tab === "practice" ? "pl--drill" : "pl--page"}`}>
      {tab === "practice" && <PracticeTab {...practice} />}

      {tab === "progress" && (
        <ProgressTab
          words={words}
          progress={progress}
          history={drill.history}
          current={current}
          counts={drill.counts}
          filter={filter}
          started={started}
          finished={drill.finished}
          remaining={drill.remaining}
          onPick={pickPool}
          onContinue={() => changeTab("practice")}
          // Hearing a word from the comb is a lookup, not a turn: the voice
          // reads it and the mic stays shut.
          onHear={(word) => speak(word, { rate })}
        />
      )}

      {tab === "words" && (
        <WordsTab
          words={words}
          onSave={setWords}
          onReset={drill.resetProgress}
          rate={rate}
          onRateChange={setRate}
          autoMic={autoMic}
          autoMicCapable={AUTO_MIC_CAPABLE}
          micSupported={micSupported}
          onToggleAutoMic={toggleAutoMic}
        />
      )}

      {(TTS_DEBUG || STT_DEBUG) && (
        <div className="pl-debug">
          {TTS_DEBUG && <TtsDebug snapshot={ttsSnapshot} log={ttsLog} error={ttsError} />}
          {STT_DEBUG && <SttDebug log={micLog} target={current} heard={heard} />}
        </div>
      )}

      <TabBar active={tab} onChange={changeTab} />
    </div>
  );
}
