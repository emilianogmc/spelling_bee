import { Repeat, SkipForward, SpellCheck2 } from "lucide-react";
import FilterChips from "./FilterChips.jsx";
import SpeakControl from "./SpeakControl.jsx";
import AnswerRow from "./AnswerRow.jsx";
import Feedback from "./Feedback.jsx";
import StatRow from "./StatRow.jsx";

const EMPTY_COPY = {
  mastered: "Nothing mastered yet. Three correct in a row moves a word here.",
  hard: "No hard words right now. Run the full list to find them.",
  new: "Every word has been tested at least once.",
  all: "Word list is empty. Add words below.",
};

export default function DrillCard({
  filter,
  counts,
  onFilterChange,
  remaining,
  current,
  answer,
  onAnswerChange,
  onSubmit,
  onSkip,
  onSpeak,
  onSpellOut,
  speaking,
  rate,
  onRateChange,
  listening,
  micSupported,
  autoMic,
  autoMicCapable,
  onToggleAutoMic,
  heard,
  interim,
  micError,
  restartUsed,
  feedback,
  onToggleEditor,
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-5">
      <FilterChips active={filter} counts={counts} onChange={onFilterChange} />

      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs text-muted">
          {counts[filter] ?? 0} in view · {remaining} left this pass
        </span>
        <button
          type="button"
          onClick={onToggleEditor}
          className="cursor-pointer text-xs text-muted underline underline-offset-2 hover:text-honey"
        >
          edit word list
        </button>
      </div>

      {current ? (
        <>
          <SpeakControl
            onSpeak={onSpeak}
            speaking={speaking}
            rate={rate}
            onRateChange={onRateChange}
            disabled={!current}
          />

          <AnswerRow
            value={answer}
            onChange={onAnswerChange}
            onSubmit={onSubmit}
            onToggleMic={onSpellOut.toggleMic}
            listening={listening}
            micSupported={micSupported}
            disabled={!current}
          />

          <p className="mt-2.5 min-h-4 font-mono text-xs tracking-widest text-muted">
            {micError ? (
              <span className="text-miss">{micError}</span>
            ) : heard ? (
              <>
                {interim ? "hearing " : "heard "}
                <b className="font-medium text-honey">
                  {heard.toUpperCase().split("").join("-")}
                </b>
              </>
            ) : listening ? (
              "listening… spell it out"
            ) : !micSupported ? (
              "voice input needs chrome, edge, or safari"
            ) : (
              ""
            )}
          </p>

          {listening && !micError && (
            <p className="mt-1 text-[11px] text-muted">
              {restartUsed
                ? "Start-over already used on this word."
                : "Tangled? Say “may I start over” for one fresh try."}
            </p>
          )}

          <label
            title={
              micSupported && !autoMicCapable
                ? "iPhone and iPad require tapping the mic each time — Safari blocks starting it any other way."
                : undefined
            }
            className={`mt-2 inline-flex items-center gap-2 text-[11px] text-muted ${
              micSupported && autoMicCapable ? "cursor-pointer hover:text-cream" : "opacity-40"
            }`}
          >
            <input
              type="checkbox"
              checked={autoMic}
              disabled={!micSupported || !autoMicCapable}
              onChange={onToggleAutoMic}
              className="h-3.5 w-3.5 accent-honey"
            />
            {micSupported && !autoMicCapable
              ? "Open the mic as soon as the word is read (not on iPhone/iPad — tap the mic instead)"
              : "Open the mic as soon as the word is read"}
          </label>

          <Feedback feedback={feedback} />

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onSpeak}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-4 py-2.5 text-sm text-cream transition-colors hover:border-honeydim"
            >
              <Repeat size={16} /> Repeat word
            </button>
            <button
              type="button"
              onClick={onSpellOut.aloud}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-4 py-2.5 text-sm text-cream transition-colors hover:border-honeydim"
            >
              <SpellCheck2 size={16} /> Spell it to me
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-4 py-2.5 text-sm text-cream transition-colors hover:border-honeydim"
            >
              <SkipForward size={16} /> Skip
            </button>
          </div>
        </>
      ) : (
        <p className="py-9 text-center text-[13px] text-muted">
          {EMPTY_COPY[filter] ?? EMPTY_COPY.all}
        </p>
      )}

      <StatRow counts={counts} />
    </div>
  );
}
