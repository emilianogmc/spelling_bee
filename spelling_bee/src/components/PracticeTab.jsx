import { useEffect, useRef } from "react";
import { Volume2 } from "lucide-react";
import Letters from "./Letters.jsx";
import { CellGlyph } from "./ProgressComb.jsx";
import MissComparison from "./MissComparison.jsx";
import { spaced } from "../lib/letters.js";
import { MASTERY_STREAK, poolLabel } from "../lib/progress.js";
import { targetMarks } from "../lib/scoring.js";
import { isIOS } from "../lib/platform.js";

const IOS_DEVICE = isIOS();

/**
 * Practice, as a placard. The whole screen is the state, so it reads from
 * across the room: ink while it waits on you, honey while the voice speaks,
 * olive when you're right, cream when you're not, vermilion when the mic
 * can't work. While the mic is open the field stays ink and only the bar, the
 * dot and the caret go vermilion, so vermilion keeps meaning "look here".
 */

/** What the start screen calls the set: "162 words", "15 hard words". */
function introNoun(filter, count) {
  if (filter === "all") return count === 1 ? "word" : "words";
  if (filter.startsWith("cluster:")) return `words from cluster ${Number(filter.slice(8)) + 1}`;
  if (filter.startsWith("word:")) return "word";
  return { new: "untested words", learning: "words you're learning", hard: "hard words", mastered: "mastered words" }[filter];
}

const EMPTY_COPY = {
  mastered: "Nothing mastered yet. Three right in a row moves a word here.",
  hard: "No hard words right now. Run the full list to find them.",
  learning: "Nothing in progress. Words land here after their first right answer.",
  new: "Every word has been tried at least once.",
  all: "The word list is empty. Add words in the Words tab.",
};

const DEFINE_COPY = {
  loading: "Looking up the definition.",
  "not-found": "No definition on file for this word.",
  error: "Couldn't reach the dictionary.",
};

function micErrorKind(message) {
  if (!message) return null;
  if (/switched off/i.test(message)) return "off";
  if (/blocked|allow/i.test(message)) return "blocked";
  if (/internet|network|connection/i.test(message)) return "network";
  if (/no microphone/i.test(message)) return "nomic";
  return "other";
}

const ERROR_COPY = {
  nomic: {
    big: "No mic found.",
    body: "Connect or switch on a microphone, then try again. Typing works in the meantime.",
  },
  // iOS Safari has no microphone control in the address bar, and its speech
  // recognition is Dictation's, so the way back differs there.
  blocked: {
    big: "Mic blocked.",
    body: IOS_DEVICE
      ? "Allow the microphone for this site in Safari's website settings, then try again. Typing works in the meantime."
      : "Allow microphone access for this site in the address bar, then try again. Typing works in the meantime.",
  },
  off: {
    big: "Voice input is off.",
    body: IOS_DEVICE
      ? "Speech recognition needs Dictation: turn it on in Settings, under Keyboard, then try again. Typing works in the meantime."
      : "This browser or computer has speech recognition switched off. Typing works in the meantime.",
  },
  network: {
    big: "Offline.",
    body: "Speech recognition sends audio to be turned into letters, so it needs a connection. Typing works offline.",
  },
  other: { big: "Mic problem.", body: "The microphone stopped working. Try again, or type the spelling." },
};

/** Which screen the drill is on. Order matters: a verdict outranks everything,
    a broken mic outranks the voice, and so on down to waiting on you. */
export function stageOf(p) {
  if (!p.started) return "intro";
  if (p.finished) return "done";
  if (!p.current) return "empty";
  const typed = p.typing || !p.micSupported;
  if (p.feedback?.kind === "correct") return "correct";
  if (p.feedback?.kind === "wrong") return "wrong";
  if (p.micError && !typed) return "error";
  if (p.checking) return "checking";
  if (p.listening) return "listening";
  if (p.speaking || p.voice) return "speaking";
  if (p.arming) return "arming";
  // Typing outranks the definition lookup, so the box being typed into stays.
  if (typed) return "typing";
  if (p.defineState === "loading") return "defining";
  if (p.voiceFailed) return "silent";
  if (p.feedback?.kind === "unclear" || p.feedback?.kind === "truncated") return "retry";
  return "ready";
}

const FIELDS = { correct: "olive", wrong: "cream", error: "ember", speaking: "honey" };

export function fieldFor(p) {
  return FIELDS[stageOf(p)] ?? "ink";
}

/** Why a turn wasn't scored. The "Not scored" itself is the screen's label. */
function retryCopy(feedback) {
  if (feedback.wordOnly) return "Heard the word, not its letters. Spell it one letter at a time.";
  if (feedback.heard.includes("?")) return "Heard a word that isn't a letter. Spell it again, one letter at a time.";
  if (feedback.kind === "truncated") return `Only caught ${spaced(feedback.heard)}. Spell the whole word again.`;
  return `Heard ${spaced(feedback.heard)}, but a letter came through unclearly. Spell it again; "papa" for P and "bravo" for B come through more reliably.`;
}

const isRetry = (feedback) => feedback?.kind === "unclear" || feedback?.kind === "truncated";

function streakLine(feedback) {
  if (feedback.kind === "wrong") return `It's ${spaced(feedback.word)}. It goes on the list to revisit.`;
  if (feedback.helped) return "Right, with help. It was spelled to you, so it doesn't count toward mastered.";
  return feedback.mastered ? "Three in a row. Mastered." : `${feedback.streak} of ${MASTERY_STREAK} in a row toward mastered.`;
}

function announcement(p, stage) {
  switch (stage) {
    case "speaking":
      return p.voice === "spell" ? "Spelling it out." : p.voice === "definition" ? "Reading the definition." : "Reading the word.";
    case "listening":
      return isRetry(p.feedback) && !p.heard ? `Not scored. ${retryCopy(p.feedback)} Listening.` : "Listening.";
    case "checking":
      return "Checking.";
    case "correct":
      return `Right. ${streakLine(p.feedback)}`;
    case "wrong":
      return `Not quite. ${streakLine(p.feedback)}`;
    case "retry":
      return `Not scored. ${retryCopy(p.feedback)}`;
    case "error":
      // The error block announces itself as an alert; saying it here too
      // would read it out twice.
      return "";
    case "silent":
      return "The voice didn't play.";
    case "done":
      return "Pass complete.";
    default:
      return "";
  }
}

/** The word in play as its comb cell, so the header and the comb speak the
    same language: empty, filling a third at a time, full, or holed. */
function WordCell({ cell }) {
  const label =
    cell.status === "learning"
      ? `${cell.streak} of ${MASTERY_STREAK}`
      : cell.status === "hard"
        ? "Hard"
        : cell.status === "mastered"
          ? "Mastered"
          : "Untested";
  return (
    <span className="pl-wordcell">
      <CellGlyph status={cell.status} fill={cell.fill} />
      <span>{label}</span>
    </span>
  );
}

function Counts({ counts }) {
  const rows = [
    ["hard", "hard"],
    ["learning", "learning"],
    ["new", "untested"],
    ["mastered", "mastered"],
  ];
  return (
    <dl className="pl-counts">
      {rows.map(([id, label]) => (
        <div key={id} className={`pl-count ${id === "hard" && counts.hard > 0 ? "pl-count--hard" : ""}`}>
          <dt>{label}</dt>
          <dd>{counts[id]}</dd>
        </div>
      ))}
    </dl>
  );
}

function TypedInput({ value, onChange, onSubmit }) {
  return (
    <input
      className="pl-typed"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/[^a-z'-]/gi, ""))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
      }}
      aria-label="Type the spelling"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck="false"
      enterKeyHint="go"
      autoFocus
    />
  );
}

function Stage({ p, stage }) {
  const typed = p.typing || !p.micSupported;

  switch (stage) {
    case "intro":
      return (
        <div className="pl-intro">
          <p className="pl-mega" aria-hidden="true">
            {p.passTotal}
          </p>
          <h1 className="pl-introtitle">
            <span className="pl-sr">{p.passTotal} </span>
            {introNoun(p.filter, p.passTotal)}, read aloud. {p.passTotal === 1 ? "Spell it back." : "Spell each one back."}
          </h1>
          <Counts counts={p.counts} />
          <p className="pl-hint pl-intro-note">
            {p.micSupported
              ? "Sound on. Each word is read aloud, then you spell it out loud; your browser will ask to use the microphone."
              : `Sound on. Each word is read aloud. ${p.micHint}`}
          </p>
        </div>
      );

    case "empty":
      return (
        <p className="pl-body pl-body--big">
          {EMPTY_COPY[p.filter] ?? "That set isn't in the word list any more. Pick another in Progress."}
        </p>
      );

    case "done": {
      const right = p.passResults.filter((r) => r.outcome === "right").length;
      const helped = p.passResults.filter((r) => r.outcome === "helped").length;
      const missed = p.passResults.filter((r) => r.outcome === "missed");
      const skipped = p.passResults.filter((r) => r.outcome === "skipped").length;
      const rest = [
        helped && `${helped} right with help`,
        missed.length && `${missed.length} missed`,
        skipped && `${skipped} skipped`,
      ].filter(Boolean);
      return (
        <div className="pl-done">
          <p className="pl-mega" aria-hidden="true">
            {right}
          </p>
          <p className="pl-introtitle">
            <span className="pl-sr">{right} </span>
            of {p.passTotal} right{rest.length ? `, ${rest.join(", ")}` : ""}.
          </p>
          {missed.length > 0 && (
            <ol className="pl-list">
              {missed.map((r) => (
                <li key={r.word}>
                  <span className="pl-list-word">{r.word}</span>
                  <span className="pl-list-note">you said {spaced(r.attempt)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      );
    }

    case "error": {
      const copy = ERROR_COPY[micErrorKind(p.micError)];
      return (
        <div className="pl-error" role="alert">
          <p className="pl-error-big">{copy.big}</p>
          <p className="pl-body">{copy.body}</p>
        </div>
      );
    }

    case "correct":
      return (
        <div className="pl-word">
          <Letters text={p.feedback.word} minCols={p.feedback.word.length} />
          <p className="pl-body pl-body--strong">{streakLine(p.feedback)}</p>
        </div>
      );

    case "wrong": {
      const { letters } = targetMarks(p.feedback.attempt, p.feedback.word);
      return (
        <div className="pl-word">
          <Letters
            text={p.feedback.word}
            minCols={p.feedback.word.length}
            marks={letters.map((l) => l.fixed)}
            inserts={letters.map((l) => l.extraBefore)}
          />
          <MissComparison attempt={p.feedback.attempt} word={p.feedback.word} />
          <p className="pl-body">{streakLine(p.feedback)}</p>
        </div>
      );
    }

    case "speaking": {
      const caption =
        p.voice === "spell" ? "Spelling it out." : p.voice === "definition" ? "Reading the definition." : "Reading the word.";
      // While typing, the same shape as the typing screen with the box in the
      // same place, so hearing the word again neither swaps the input (on a
      // phone, closing the keyboard) nor moves it.
      if (typed)
        return (
          <div className="pl-word">
            {null}
            {null}
            <TypedInput value={p.answer} onChange={p.onAnswerChange} onSubmit={p.onSubmit} />
            <p className="pl-body">{caption}</p>
          </div>
        );
      return (
        <div className="pl-speaking">
          <p className="pl-body pl-body--strong">{caption}</p>
          <span className="pl-progress" aria-hidden="true" />
        </div>
      );
    }

    case "listening":
    case "arming":
    case "checking": {
      // Opening the mic looks exactly like listening, minus the live marks,
      // so nothing moves when it opens.
      const retrying = !p.heard && isRetry(p.feedback);
      return (
        <div className="pl-word">
          <Letters text={p.heard} live={stage === "listening"} minCols={12} />
          <p className="pl-body">
            {stage === "checking"
              ? "Reading back what was heard."
              : retrying
                ? retryCopy(p.feedback)
                : p.heard
                  ? "Stop talking when you're done."
                  : "Spell it out, one letter at a time."}
          </p>
          {stage !== "checking" && !p.restartUsed && (
            <p className="pl-hint">Tangled? Say “may I start over” for one fresh try.</p>
          )}
        </div>
      );
    }

    case "retry":
      return (
        <div className="pl-word pl-word--dim">
          <Letters text={p.feedback.heard} minCols={18} small />
          <p className="pl-body" role="status">
            {retryCopy(p.feedback)}
          </p>
        </div>
      );

    case "defining":
      return <p className="pl-body pl-body--strong">{DEFINE_COPY.loading}</p>;

    case "silent":
      return (
        <p className="pl-body pl-body--strong">
          The voice didn't play, so the mic stayed shut. Hear the word, then spell it.
        </p>
      );

    case "typing":
      return (
        <div className="pl-word">
          {null}
          {null}
          <TypedInput value={p.answer} onChange={p.onAnswerChange} onSubmit={p.onSubmit} />
          <p className="pl-body">
            {DEFINE_COPY[p.defineState] ?? (p.micSupported ? "Type the spelling, then check it." : p.micHint)}
          </p>
        </div>
      );

    default:
      return (
        <p className="pl-body pl-body--strong">
          {DEFINE_COPY[p.defineState] ??
            (p.unread ? "Hear the word, then spell it." : "Press Spell it out loud when you're ready.")}
        </p>
      );
  }
}

const LABEL = {
  intro: null,
  empty: null,
  done: "Pass complete",
  correct: "Right",
  wrong: "Not quite",
  speaking: "Listen",
  silent: "No sound",
  listening: "Spell",
  arming: "Spell",
  checking: "Checking",
  retry: "Not scored",
  defining: "Definition",
  typing: "Type it",
  ready: "Your turn",
  error: null,
};

export default function PracticeTab(p) {
  const stage = stageOf(p);
  const typed = p.typing || !p.micSupported;
  const inTurn = !["intro", "done", "empty", "correct", "wrong"].includes(stage);
  const scored = stage === "correct" || stage === "wrong";
  const retrying = (stage === "listening" || stage === "arming") && !p.heard && isRetry(p.feedback);
  const label =
    stage === "correct" && p.feedback.mastered ? "Mastered" : retrying ? "Not scored" : LABEL[stage];
  const position = p.passTotal - p.remaining + 1;

  // Exactly one primary action, always in the same place.
  let primary;
  if (stage === "intro") primary = { label: "Start", onClick: p.onBegin, disabled: !p.current };
  else if (stage === "done") primary = { label: "Start another pass", onClick: p.onNewPass };
  else if (stage === "empty") primary = { label: "Drill all words", onClick: () => p.onPickPool("all") };
  else if (scored) primary = { label: "Next word", onClick: p.onAdvance };
  else if (stage === "error") primary = { label: "Type it instead", onClick: p.onToggleTyping };
  else if (typed) primary = { label: "Check spelling", onClick: p.onSubmit, disabled: !p.answer.trim() };
  else if (stage === "checking") primary = { label: "Checking", onClick: () => {}, disabled: true };
  else if (stage === "listening") primary = { label: "Stop and check", onClick: p.onToggleMic, live: true };
  else if (stage === "arming") primary = { label: "Opening the mic", onClick: () => {}, disabled: true };
  else if (stage === "retry") primary = { label: "Spell it again", onClick: p.onToggleMic };
  else if (stage === "silent" || p.unread) primary = { label: "Hear the word", onClick: p.onSpeak };
  else primary = { label: "Spell it out loud", onClick: p.onToggleMic };

  // Spelling it out is a crutch, so it sits behind the definition and the
  // mode switch rather than first in line.
  const secondary = [];
  if (inTurn || scored) secondary.push({ id: "define", label: "Definition", onClick: p.onDefine });
  if (stage === "error") secondary.push({ id: "mic", label: "Try the mic again", onClick: p.onToggleMic });
  else if (stage === "silent") secondary.push({ id: "mic", label: "Spell it out loud", onClick: p.onToggleMic });
  if (stage !== "error" && inTurn && p.micSupported)
    secondary.push({ id: "mode", label: typed ? "Use the mic" : "Type instead", onClick: p.onToggleTyping });
  if (inTurn) secondary.push({ id: "spell", label: "Spell it to me", onClick: p.onSpellOut });
  if (inTurn) secondary.push({ id: "skip", label: "Skip", onClick: p.onSkip });
  if (stage === "done" && p.counts.hard > 0)
    secondary.push({
      id: "hard",
      label: p.counts.hard === 1 ? "Drill the 1 hard word" : `Drill the ${p.counts.hard} hard words`,
      onClick: () => p.onPickPool("hard"),
    });

  const showAgain = Boolean(p.current) && !["intro", "done", "empty"].includes(stage);
  const voiceNote = typed && p.voiceFailed ? "The voice didn't play. Press Again to hear the word." : null;

  // A tap aimed at the last screen's bar lands on this one's: "Next word"
  // pressed a beat late would open the mic over the next word. Taps in the
  // first moment after the screen changes are ignored.
  // Keyed on an actual change of stage, not on the effect running: React's
  // development mode runs it twice on mount, which armed the guard against a
  // first tap.
  const changedAt = useRef(0);
  const lastStage = useRef(stage);
  useEffect(() => {
    if (lastStage.current === stage) return;
    lastStage.current = stage;
    changedAt.current = Date.now();
  }, [stage]);
  const guarded = (fn) => () => {
    if (Date.now() - changedAt.current < 450) return;
    fn();
  };

  return (
    <div className={`pl-screen pl-stage--${stage} ${typed ? "pl-screen--typed" : ""}`}>
      <p className="pl-sr" role="status" aria-live="polite">
        {announcement(p, stage)}
      </p>
      <h1 className="pl-sr">Practice</h1>

      <header className="pl-top">
        {p.current && !["intro", "done", "empty"].includes(stage) ? (
          <p className="pl-placard" aria-label={`Word ${position} of ${p.passTotal}`}>
            <span className="pl-placard-no">No.</span>
            <span className="pl-placard-n">{String(position).padStart(2, "0")}</span>
          </p>
        ) : (
          <p className="pl-wordmark">spelling.help</p>
        )}
        <div className="pl-top-right">
          <p className="pl-pool">
            {poolLabel(p.filter)}
            {p.current && stage !== "intro" ? ` · ${p.remaining} left` : ""}
          </p>
          {p.cell && !["intro", "done", "empty"].includes(stage) && <WordCell cell={p.cell} />}
        </div>
      </header>

      <main className="pl-main">
        {label && (
          <p className={`pl-label ${stage === "listening" ? "is-live" : ""}`}>
            {stage === "listening" && <span className="pl-dot" aria-hidden="true" />}
            {label}
          </p>
        )}
        <Stage p={p} stage={stage} />
      </main>

      <footer className="pl-foot">
        {voiceNote && <p className="pl-note">{voiceNote}</p>}
        {secondary.length > 0 && (
          <ul className="pl-secondary">
            {secondary.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={a.onClick}>
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="pl-bar">
          {showAgain && (
            <button
              type="button"
              className={`pl-again ${p.speaking ? "is-busy" : ""}`}
              onClick={p.onSpeak}
              aria-label="Hear the word again"
            >
              <Volume2 size={26} strokeWidth={2.2} aria-hidden="true" />
              <span>Again</span>
            </button>
          )}
          <button
            type="button"
            className={`pl-band ${primary.live ? "is-live" : ""}`}
            onClick={guarded(primary.onClick)}
            disabled={primary.disabled}
          >
            <span>{primary.label}</span>
            <span className="pl-band-mark" aria-hidden="true">
              {primary.live ? "■" : "→"}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
}
