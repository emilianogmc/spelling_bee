import { Mic, SkipForward, SpellCheck2, Square, Volume2 } from "lucide-react";
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
    <span className="flex items-center gap-1.5" aria-label={`Streak ${streak} of ${MASTERY_STREAK}`}>
      {Array.from({ length: MASTERY_STREAK }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full transition-colors ${
            i < streak ? "bg-honey" : "bg-line"
          }`}
        />
      ))}
    </span>
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
  onSkip,
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
  verdictOpen,
}) {
  if (!current) {
    return (
      <p className="mx-auto max-w-[46ch] px-2 py-16 text-center text-[15px] leading-relaxed text-muted">
        {EMPTY_COPY[filter] ?? EMPTY_COPY.all}
      </p>
    );
  }

  const status = micError ? (
    <span className="text-miss">{micError}</span>
  ) : heard ? (
    <>
      <span className="text-muted">{interim ? "hearing" : "heard"} </span>
      <b className="letters font-medium text-honey">{heard.toUpperCase().split("").join("-")}</b>
    </>
  ) : listening ? (
    <span className="text-honey">Listening. Spell it out.</span>
  ) : !micSupported ? (
    <span className="text-muted">{micHint}</span>
  ) : (
    <span className="text-muted">Tap the mic, then spell it aloud.</span>
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="text-muted">
          {FILTER_LABEL[filter] ?? FILTER_LABEL.all} · {remaining} left
        </span>
        <StreakPips streak={streak} />
      </div>

      <div className="flex flex-col items-center gap-5 py-2">
        <button
          type="button"
          onClick={onSpeak}
          aria-label="Hear the word"
          className={`flex h-32 w-32 items-center justify-center rounded-full border-2 transition-transform duration-200 ${
            speaking
              ? "border-honey bg-[#3a2f1c] text-honey"
              : "border-honeydim bg-raised text-honey hover:scale-105 hover:border-honey active:scale-95"
          }`}
        >
          <Volume2 size={44} strokeWidth={1.75} aria-hidden="true" />
        </button>

        <p className="min-h-6 px-2 text-center text-[15px] leading-snug">{status}</p>

        {listening && !micError && !restartUsed && (
          <p className="-mt-3 text-center text-[13px] text-muted">
            Tangled? Say "may I start over" for one fresh try.
          </p>
        )}

        {ttsError && ttsError !== "blocked-until-you-interact" && (
          <p className="-mt-3 text-center text-[13px] text-miss">Speech failed: {ttsError}</p>
        )}
      </div>

      {/* Thumb zone: everything pressed on every word lives down here. */}
      <div className={`flex flex-col gap-3 ${verdictOpen ? "invisible" : ""}`}>
        <div className="flex gap-2.5">
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
            placeholder="or type it"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-label="Type the spelling"
            className="letters min-h-[52px] min-w-0 flex-1 rounded-xl border border-line bg-ink px-4 text-base text-cream outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted focus:border-honey"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!answer.trim()}
            className="min-h-[52px] rounded-xl border border-line bg-raised px-5 text-sm font-semibold text-cream transition-colors hover:border-honeydim disabled:opacity-35"
          >
            Check
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleMic}
          disabled={!micSupported}
          title={micSupported ? undefined : micHint}
          className={`flex min-h-[60px] items-center justify-center gap-2.5 rounded-xl border-2 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
            listening
              ? "animate-pulse border-miss bg-missdim text-miss"
              : "border-honey bg-honey text-[#241a08] hover:bg-[#f0b64f]"
          }`}
        >
          {listening ? (
            <>
              <Square size={19} strokeWidth={2.5} aria-hidden="true" /> Stop and check
            </>
          ) : (
            <>
              <Mic size={19} strokeWidth={2.5} aria-hidden="true" /> Spell it out loud
            </>
          )}
        </button>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onSpellOut}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg text-[13px] text-muted transition-colors hover:text-cream"
          >
            <SpellCheck2 size={15} aria-hidden="true" /> Spell it to me
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg text-[13px] text-muted transition-colors hover:text-cream"
          >
            <SkipForward size={15} aria-hidden="true" /> Skip
          </button>
        </div>
      </div>
    </div>
  );
}
