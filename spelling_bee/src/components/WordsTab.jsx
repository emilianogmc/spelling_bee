import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { KEY_DRAFT, loadStored, saveStored, splitWords } from "../lib/progress.js";

/**
 * What is actually going to be saved, and what it costs.
 *
 * Two spellings that differ only in case are one word to the drill — it scores
 * on a lowercased comparison — but two cells in the comb and two entries in the
 * queue, so a pasted list with duplicates quietly drills some words twice. They
 * are folded here, first spelling wins, and the count says so before saving.
 */
function readDraft(draft, words) {
  const lines = splitWords(draft);

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
    <main className="pl-page">
      <h1 className="pl-page-title">Words</h1>

      {/* The list is what the tab is named after, so it opens the tab. Voice
          settings are set once and left alone; they used to sit on top of it. */}
      <section aria-labelledby="list-title">
        <h2 id="list-title" className="pl-section-title">
          Word list
        </h2>
        <p className="pl-section-note">One word per line, or separated by commas.</p>

        <textarea
          value={draft}
          spellCheck="false"
          onChange={(event) => setDraft(event.target.value)}
          aria-labelledby="list-title"
          aria-describedby="list-summary"
          autoCapitalize="off"
          autoCorrect="off"
          /* 16px or more: Safari zooms the page on any field under 16, and
             this one is read as much as it is typed into. */
          className="pl-textarea"
        />

        <p id="list-summary" aria-live="polite" className="pl-section-note">
          {summarise(state)}
        </p>

        <button
          type="button"
          onClick={() => onSave(parsed)}
          disabled={!dirty || parsed.length === 0}
          /* Nothing to save is a resting state rather than a broken button, so
             it turns into an outline instead of dimming the fill into mud. */
          className="pl-action"
        >
          <Save size={20} aria-hidden="true" /> {dirty ? "Save word list" : "Saved"}
        </button>

        {/* A draft that survives the tab has to be escapable, or a bad paste
            follows the speller around. */}
        {dirty && (
          <button type="button" onClick={() => setDraft(words.join("\n"))} className="pl-textbtn">
            Discard changes
          </button>
        )}
      </section>

      <section aria-labelledby="voice-title">
        <h2 id="voice-title" className="pl-section-title">
          Voice
        </h2>
        <p className="pl-section-note">How the word is read, and when the mic opens.</p>

        <div className="pl-setting">
          <label htmlFor="rate" className="pl-setting-label">
            Reading speed
          </label>
          <div className="pl-range">
            <span>Slow</span>
            <input
              id="rate"
              type="range"
              min="0.4"
              max="1"
              step="0.05"
              value={rate}
              onChange={(event) => onRateChange(Number(event.target.value))}
            />
            <span>Normal</span>
          </div>
        </div>

        <label className={`pl-setting pl-check ${micSupported && autoMicCapable ? "" : "is-off"}`}>
          <input
            type="checkbox"
            checked={autoMic}
            disabled={!micSupported || !autoMicCapable}
            onChange={onToggleAutoMic}
          />
          <span>
            <span className="pl-setting-label">Open the mic automatically</span>
            <span className="pl-setting-note">
              {!micSupported
                ? "This browser has no speech recognition, so spellings are typed."
                : !autoMicCapable
                  ? "Unavailable on iPhone and iPad. Safari only opens the mic from a direct tap."
                  : "Starts listening as soon as the word finishes."}
            </span>
          </span>
        </label>
      </section>

      <section aria-labelledby="reset-title">
        <h2 id="reset-title" className="pl-section-title">
          Reset
        </h2>
        <p className="pl-section-note">Clears every streak and mastery mark. The word list itself is kept.</p>

        {confirmingReset ? (
          <div className="pl-confirm">
            <button
              type="button"
              onClick={() => {
                onReset();
                setConfirmingReset(false);
              }}
              /* Vermilion, and an outline: a destructive action should not look
                 like the button you press to get on with the drill. */
              className="pl-action pl-action--danger"
            >
              Erase all progress
            </button>
            <button type="button" onClick={() => setConfirmingReset(false)} className="pl-action pl-action--quiet">
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingReset(true)} className="pl-action pl-action--quiet">
            <RotateCcw size={18} aria-hidden="true" /> Reset progress
          </button>
        )}
      </section>

      {/* What leaves the device, said plainly, because the app can't keep
          that promise on its own: speech recognition belongs to the browser. */}
      <section aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="pl-section-title">
          Privacy
        </h2>
        <p className="pl-section-note pl-prose">
          Your word list and progress are saved in this browser only and never uploaded. There are no accounts.
        </p>
        <p className="pl-section-note pl-prose">
          Turning your voice into letters is done by your browser. Chrome sends the audio to Google to do it, Edge
          to Microsoft, and Safari uses Apple's speech recognition. Typing sends nothing. A definition is looked up
          at FreeDictionaryAPI.com, which sees the word you asked about.
        </p>
      </section>

      {/* freedictionaryapi.com's terms require visible credit and a link back
          to Wiktionary in return for a free, keyless feed — this is that,
          kept to the one place in the app that already reads as a footer. */}
      <footer className="pl-credits">
        <p>
          Definitions from{" "}
          <a href="https://en.wiktionary.org" target="_blank" rel="noopener noreferrer">
            Wiktionary
          </a>
          , via{" "}
          <a href="https://freedictionaryapi.com" target="_blank" rel="noopener noreferrer">
            FreeDictionaryAPI.com
          </a>
        </p>
        <p>Built by DarwinGMC · MSW</p>
      </footer>
    </main>
  );
}
