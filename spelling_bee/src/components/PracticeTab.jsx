import { useState } from "react";
import { Keyboard, Mic, SkipForward, SpellCheck2, Square, Volume2 } from "lucide-react";
import Verdict from "./Verdict.jsx";
import { spaced } from "../lib/letters.js";
import { MASTERY_STREAK } from "../lib/progress.js";

const FILTER_LABEL = {
  all: "All words",
  new: "Untested",
  learning: "Learning",
  hard: "Hard words",
  mastered: "Mastered",
};

const EMPTY_COPY = {
  mastered: "Nothing mastered yet. Three correct in a row moves a word here.",
  hard: "No hard words right now. Run the full list to find them.",
  new: "Every word has been tested at least once.",
  all: "The word list is empty. Add words in the Words tab.",
};

/** How close this word is to mastered, shown as filled pips. */
function StreakPips({ streak }) {
  return (
    <span
      className="flex items-center gap-1.5"
      aria-label={`Streak ${streak} of ${MASTERY_STREAK}`}
    >
      {Array.from({ length: MASTERY_STREAK }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full transition-colors ${
            i < streak ? "bg-ember" : "bg-stone"
          }`}
        />
      ))}
    </span>
  );
}

/** Quiet text control. Everything in the row under the primary button. */
function Tertiary({ onClick, Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg px-1 text-[13px] text-muted transition-colors hover:text-chalk"
    >
      <Icon size={15} aria-hidden="true" /> {children}
    </button>
  );
}

export default function PracticeTab({
  filter,
  remaining,
  current,
  streak,
  answer,
  onAnswerChange,
  onSubmit,
  onAdvance,
  onSpeak,
  onSpellOut,
  onToggleMic,
  speaking,
  listening,
  micSupported,
  micHint,
  heard,
  interim,
  micError,
  restartUsed,
  ttsError,
  feedback,
}) {
  const [typing, setTyping] = useState(false);

  if (!current) {
    return (
      <p className="mx-auto max-w-[46ch] px-2 py-16 text-center text-[15px] leading-relaxed text-muted">
        {EMPTY_COPY[filter] ?? EMPTY_COPY.all}
      </p>
    );
  }

  // Typing is the fallback, so it stays behind a toggle — except where the mic
  // was never an option, which makes it the only path there is.
  const typed = typing || !micSupported;
  const scored = feedback?.kind === "correct" || feedback?.kind === "wrong";
  const retry = feedback?.kind === "truncated" || feedback?.kind === "unclear";

  /* The stage. One slot, showing whatever the drill's state actually is: what
     was heard, what the verdict was, or what to do next. Nothing else competes
     with it, and it is sized so the button below never moves between states. */
  let stage;
  if (scored) {
    stage = <Verdict feedback={feedback} />;
  } else if (micError) {
    stage = (
      <p role="alert" className="max-w-[34ch] text-center text-[15px] text-ember">
        {micError}
      </p>
    );
  } else if (heard) {
    stage = (
      <div className="flex flex-col items-center gap-3">
        <p className="letters text-center text-[clamp(1.5rem,7vw,2.125rem)] font-medium break-all text-chalk">
          {spaced(heard)}
        </p>
        <p className="text-[13px] text-muted">{interim ? "hearing" : "heard"}</p>
      </div>
    );
  } else if (retry) {
    stage = (
      <p role="status" className="max-w-[34ch] text-center text-[15px] leading-relaxed text-ember">
        {feedback.kind === "truncated" ? (
          <>
            Only caught <b className="letters font-medium">{spaced(feedback.heard)}</b>. Not
            scored. Spell it again and hold the last letter a beat longer.
          </>
        ) : (
          <>
            Didn't catch that clearly, heard{" "}
            <b className="letters font-medium">{spaced(feedback.heard)}</b>. Not scored. Try
            "papa" for P, "bravo" for B.
          </>
        )}
      </p>
    );
  } else if (listening) {
    stage = (
      <p className="flex items-center gap-2.5 text-[17px] text-chalk">
        <span className="live-dot h-2.5 w-2.5 rounded-full bg-ember" aria-hidden="true" />
        Listening. Spell it out.
      </p>
    );
  } else if (speaking) {
    stage = <p className="text-[17px] text-muted">Reading the word.</p>;
  } else {
    // Every other stage state speaks at 17px; the idle prompt matched none of
    // them and read as leftover placeholder in all that space.
    stage = (
      <p className="max-w-[30ch] text-center text-[17px] leading-relaxed text-muted">
        {micSupported ? "Listen, then spell it out loud." : micHint}
      </p>
    );
  }

  // Exactly one action is primary at a time, and it always sits in the same
  // place, so it can be pressed without looking.
  const primary = scored
    ? { label: "Next word", Icon: SkipForward, onClick: onAdvance }
    : typed
      ? {
          label: "Check spelling",
          Icon: SpellCheck2,
          onClick: onSubmit,
          disabled: !answer.trim(),
        }
      : listening
        ? { label: "Stop and check", Icon: Square, onClick: onToggleMic, live: true }
        : { label: "Spell it out loud", Icon: Mic, onClick: onToggleMic };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-3 text-[13px]">
        <span className="text-muted">
          {FILTER_LABEL[filter] ?? FILTER_LABEL.all} · {remaining} left
        </span>
        <StreakPips streak={streak} />
      </div>

      {/* Deliberately not a live region as a whole: the letters change on every
          interim result, and announcing each one would talk over a speller who
          is still spelling. The states that must be heard carry their own role
          (the retry message below, and the verdict's alert). */}
      <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center py-8">
        {stage}
      </div>

      {/* Thumb zone. Everything pressed on every word lives down here, and the
          primary target holds its position through every state change. */}
      <div className="flex flex-col gap-3">
        {ttsError && ttsError !== "blocked-until-you-interact" && (
          <p className="text-center text-[13px] text-ember">Speech failed: {ttsError}</p>
        )}

        {listening && !scored && !restartUsed && (
          <p className="text-center text-[13px] text-muted">
            Tangled? Say "may I start over" for one fresh try.
          </p>
        )}

        {typed && !scored && (
          <input
            type="text"
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Spell it here"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-label="Type the spelling"
            className="letters min-h-[56px] w-full rounded-xl border border-line bg-surface px-4 text-base text-chalk outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted focus:border-ember"
          />
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onSpeak}
            aria-label="Hear the word again"
            className={`flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
              speaking
                ? "border-ember bg-surface text-ember"
                : "border-line bg-surface text-chalk hover:border-ember hover:text-ember"
            }`}
          >
            <Volume2 size={26} strokeWidth={1.9} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={primary.onClick}
            disabled={primary.disabled}
            /* 19px/700 is not styling: chalk on vermilion is 3.1:1, which WCAG
               allows for large text only. Below 18.66px bold this button would
               fail AA. The filled state means "press me"; the outlined state
               means "live, press to stop". */
            className={`flex min-h-[60px] flex-1 items-center justify-center gap-2.5 rounded-xl border-2 text-[19px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              primary.live
                ? "border-ember bg-transparent text-ember hover:bg-ember/10"
                : "border-ember bg-ember text-chalk hover:border-[#ff7452] hover:bg-[#ff7452]"
            }`}
          >
            <primary.Icon size={20} strokeWidth={2.5} aria-hidden="true" /> {primary.label}
          </button>
        </div>

        {!scored && (
          <div className="flex gap-1">
            {micSupported && (
              <Tertiary onClick={() => setTyping(!typing)} Icon={typed ? Mic : Keyboard}>
                {typed ? "Use the mic" : "Type instead"}
              </Tertiary>
            )}
            <Tertiary onClick={onSpellOut} Icon={SpellCheck2}>
              Spell it to me
            </Tertiary>
            <Tertiary onClick={onAdvance} Icon={SkipForward}>
              Skip
            </Tertiary>
          </div>
        )}
      </div>
    </div>
  );
}
