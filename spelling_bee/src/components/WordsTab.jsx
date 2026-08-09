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
        <p className="mb-4 text-[14px] text-muted">How the word is read, and when the mic opens.</p>

        <div className="rounded-xl border border-line bg-surface px-4 py-4">
          <label htmlFor="rate" className="block text-[15px] font-medium text-chalk">
            Reading speed
          </label>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[13px] text-muted">Slow</span>
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
            <span className="text-[13px] text-muted">Normal</span>
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
            className="h-5 w-5 shrink-0 accent-ember"
          />
          <span>
            <span className="block text-[15px] font-medium text-chalk">
              Open the mic automatically
            </span>
            <span className="block text-[13px] text-muted">
              {micSupported && !autoMicCapable
                ? "Unavailable on iPhone and iPad. Safari only opens the mic from a direct tap."
                : "Starts listening as soon as the word finishes."}
            </span>
          </span>
        </label>
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">Word list</h2>
        <p className="mb-4 text-[14px] text-muted">
          One word per line. {words.length} in the list now.
        </p>

        <textarea
          value={draft}
          spellCheck="false"
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Word list, one word per line"
          className="min-h-[220px] w-full resize-y rounded-xl border border-line bg-surface p-3.5 font-mono text-[13px] leading-relaxed text-chalk outline-none focus:border-ember"
        />

        <button
          type="button"
          onClick={() => onSave(parsed)}
          disabled={!dirty || parsed.length === 0}
          /* Filled ember carries its label at 3.1:1, which is large-text only,
             so every filled button in the app is 19px bold. */
          /* Nothing to save is a resting state, not a broken button. Dimming
             the filled version left an unreadable slab; going neutral says
             "already saved" and keeps the label legible. */
          className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 border-ember bg-ember text-[19px] font-bold text-chalk transition-colors hover:border-[#ff7452] hover:bg-[#ff7452] disabled:cursor-default disabled:border-line disabled:bg-transparent disabled:text-muted"
        >
          <Save size={19} aria-hidden="true" /> {dirty ? "Save word list" : "Saved"}
        </button>
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">Reset</h2>
        <p className="mb-4 text-[14px] text-muted">
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
              /* Outlined, not filled: ember text needs the page behind it to
                 reach 4.8:1, and a destructive action should not look like the
                 button you press to get on with the drill. */
              className="min-h-[52px] flex-1 rounded-xl border-2 border-ember text-[15px] font-semibold text-ember transition-colors hover:bg-ember/10"
            >
              Erase all progress
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="min-h-[52px] flex-1 rounded-xl border border-line bg-surface text-[15px] text-chalk transition-colors hover:border-chalk"
            >
              Keep it
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[15px] text-chalk transition-colors hover:border-chalk"
          >
            <RotateCcw size={17} aria-hidden="true" /> Reset progress
          </button>
        )}
      </section>
    </div>
  );
}
