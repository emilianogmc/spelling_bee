import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";

export default function WordsTab({
  words,
  onSave,
  onReset,
  rate,
  onRateChange,
  autoMic,
  autoMicCapable,
  micSupported,
  onToggleAutoMic,
}) {
  const [draft, setDraft] = useState(() => words.join("\n"));
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    setDraft(words.join("\n"));
  }, [words]);

  const parsed = draft
    .split("\n")
    .map((word) => word.trim())
    .filter(Boolean);
  const dirty = parsed.join("\n") !== words.join("\n");

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">Voice</h2>
        <p className="mb-4 text-[14px] text-sage">How the word is read, and when the mic opens.</p>

        <div className="rounded-xl border border-line bg-surface px-4 py-4">
          <label htmlFor="rate" className="block text-[15px] font-medium text-cream">
            Reading speed
          </label>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[13px] text-sage">Slow</span>
            <input
              id="rate"
              type="range"
              min="0.4"
              max="1"
              step="0.05"
              value={rate}
              onChange={(event) => onRateChange(Number(event.target.value))}
              className="h-11 min-w-0 flex-1"
            />
            <span className="text-[13px] text-sage">Normal</span>
          </div>
        </div>

        <label
          className={`mt-2.5 flex min-h-[60px] items-center gap-3.5 rounded-xl border border-line bg-surface px-4 py-3 ${
            micSupported && autoMicCapable ? "cursor-pointer" : "opacity-45"
          }`}
        >
          <input
            type="checkbox"
            checked={autoMic}
            disabled={!micSupported || !autoMicCapable}
            onChange={onToggleAutoMic}
            className="h-5 w-5 shrink-0 accent-honey"
          />
          <span>
            <span className="block text-[15px] font-medium text-cream">
              Open the mic automatically
            </span>
            <span className="block text-[13px] text-sage">
              {micSupported && !autoMicCapable
                ? "Unavailable on iPhone and iPad. Safari only opens the mic from a direct tap."
                : "Starts listening as soon as the word finishes."}
            </span>
          </span>
        </label>
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">Word list</h2>
        <p className="mb-4 text-[14px] text-sage">
          One word per line. {words.length} in the list now.
        </p>

        <textarea
          value={draft}
          spellCheck="false"
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Word list, one word per line"
          className="min-h-[220px] w-full resize-y rounded-xl border border-dim bg-surface p-3.5 font-mono text-[13px] leading-relaxed text-cream outline-none focus:border-honey"
        />

        <button
          type="button"
          onClick={() => onSave(parsed)}
          disabled={!dirty || parsed.length === 0}
          /* Ink on honey is 6.6:1 at any size; the label stays large because
             this section has one obvious action, not to prop up contrast.
             Nothing to save is a resting state rather than a broken button, so
             it goes neutral instead of dimming the fill into an unreadable
             slab. */
          className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 border-honey bg-honey text-[19px] font-bold text-ink transition-colors hover:border-honeypale hover:bg-honeypale disabled:cursor-default disabled:border-dim disabled:bg-transparent disabled:text-sage"
        >
          <Save size={19} aria-hidden="true" /> {dirty ? "Save word list" : "Saved"}
        </button>
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">Reset</h2>
        <p className="mb-4 text-[14px] text-sage">
          Clears every streak and mastery mark. The word list itself is kept.
        </p>

        {confirmingReset ? (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                onReset();
                setConfirmingReset(false);
              }}
              /* Outlined, not filled: a destructive action should not look
                 like the button you press to get on with the drill. The label
                 is emberpale because ember itself is 4.1:1 on the page, which
                 carries large text but not fifteen pixels of it. */
              className="min-h-[52px] flex-1 rounded-xl border-2 border-ember text-[15px] font-semibold text-emberpale transition-colors hover:bg-emberdim"
            >
              Erase all progress
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="min-h-[52px] flex-1 rounded-xl border border-dim bg-surface text-[15px] text-cream transition-colors hover:border-cream"
            >
              Keep it
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-dim bg-surface text-[15px] text-cream transition-colors hover:border-cream"
          >
            <RotateCcw size={17} aria-hidden="true" /> Reset progress
          </button>
        )}
      </section>
    </div>
  );
}
