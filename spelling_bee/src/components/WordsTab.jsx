import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { KEY_DRAFT, loadStored, saveStored } from "../lib/progress.js";

/**
 * What is actually going to be saved, and what it costs.
 *
 * Two spellings that differ only in case are one word to the drill — it scores
 * on a lowercased comparison — but two cells in the comb and two entries in the
 * queue, so a pasted list with duplicates quietly drills some words twice. They
 * are folded here, first spelling wins, and the count says so before saving.
 */
function readDraft(draft, words) {
  const lines = draft.split("\n").map((line) => line.trim()).filter(Boolean);

  const seen = new Set();
  const parsed = [];
  lines.forEach((word) => {
    const key = word.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parsed.push(word);
  });

  const saved = new Set(words.map((word) => word.toLowerCase()));
  return {
    parsed,
    duplicates: lines.length - parsed.length,
    added: parsed.filter((word) => !saved.has(word.toLowerCase())).length,
    removed: words.filter((word) => !seen.has(word.toLowerCase())).length,
    dirty: parsed.join("\n") !== words.join("\n"),
  };
}

/** One line of plain arithmetic under the box, so nothing about a paste is a
    surprise until after it lands. */
function summarise({ parsed, duplicates, added, removed, dirty }) {
  if (!parsed.length) return "Nothing to save. Add at least one word.";

  const counted = `${parsed.length} ${parsed.length === 1 ? "word" : "words"}.`;
  if (!dirty && !duplicates) return counted;

  const changes = [];
  if (added) changes.push(`${added} added`);
  if (removed) changes.push(`${removed} removed`);
  if (duplicates) changes.push(`${duplicates} duplicate${duplicates === 1 ? "" : "s"} folded`);
  return `${counted} ${changes.join(", ")}.`;
}

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
  // An edit outlives the tab. This component unmounts the moment the speller
  // checks something in Practice, which used to throw away everything typed.
  const [draft, setDraft] = useState(() => {
    const stored = loadStored(KEY_DRAFT, null);
    return typeof stored === "string" ? stored : words.join("\n");
  });
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Only a save — or an edit in another tab — should overwrite what is in the
  // box. Comparing identity rather than contents keeps the restored draft
  // through the mount, where a plain [words] effect would wipe it.
  const savedRef = useRef(words);
  useEffect(() => {
    if (savedRef.current === words) return;
    savedRef.current = words;
    setDraft(words.join("\n"));
  }, [words]);

  useEffect(() => saveStored(KEY_DRAFT, draft), [draft]);

  const state = useMemo(() => readDraft(draft, words), [draft, words]);
  const { parsed, dirty } = state;

  return (
    <div className="flex flex-col gap-8">
      {/* The list is what the tab is named after, so it opens the tab. Voice
          settings are set once and left alone; they used to sit on top of it. */}
      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">Word list</h2>
        <p className="mb-4 text-[14px] text-sage">One word per line.</p>

        <textarea
          value={draft}
          spellCheck="false"
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Word list, one word per line"
          aria-describedby="list-summary"
          autoCapitalize="off"
          autoCorrect="off"
          /* 16px, not the 13 it was: Safari zooms the page on any field under
             16 and this one is read as much as it is typed into. */
          className="min-h-[min(46vh,420px)] w-full resize-y rounded-xl border border-dim bg-surface p-3.5 font-mono text-base leading-relaxed text-cream outline-none focus:border-honey"
        />

        <p id="list-summary" aria-live="polite" className="mt-2 text-[14px] text-sage">
          {summarise(state)}
        </p>

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

        {/* A draft that survives the tab has to be escapable, or a bad paste
            follows the speller around. */}
        {dirty && (
          <button
            type="button"
            onClick={() => setDraft(words.join("\n"))}
            className="mx-auto mt-1 flex min-h-[44px] items-center px-3 text-[14px] text-sage transition-colors hover:text-cream"
          >
            Discard changes
          </button>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">Voice</h2>
        <p className="mb-4 text-[14px] text-sage">
          How the word is read, and when the mic opens.
        </p>

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

      <p className="pb-2 text-center text-[12px] text-dim">Built by DarwinGMC · MSW</p>
    </div>
  );
}
