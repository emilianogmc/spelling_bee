import { useMemo, useRef, useState } from "react";
import ProgressComb, { CellGlyph, ListGlyph, STATUS_TEXT } from "./ProgressComb.jsx";
import WordInspector from "./WordInspector.jsx";
import { CLUSTER_SIZE, clusterOf } from "../lib/comb.js";
import { MASTERY_STREAK, cellState, statusOf } from "../lib/progress.js";

/** The sets the key can light up, each drawn with the cell it stands for.
    Hard follows the whole list because it is the set most worth drilling. */
const SETS = [
  { id: "all", label: "All words", glyph: null },
  { id: "hard", label: "Hard", glyph: { status: "hard", fill: 1 } },
  { id: "learning", label: "Learning", glyph: { status: "learning", fill: 2 / 3 } },
  { id: "new", label: "Untested", glyph: { status: "new", fill: 0 } },
  { id: "mastered", label: "Mastered", glyph: { status: "mastered", fill: 1 } },
];

const SET_NOUN = {
  all: "words",
  hard: "hard words",
  learning: "words you're learning",
  new: "untested words",
  mastered: "mastered words",
};

const SET_ONE = {
  hard: "hard word",
  learning: "word you're learning",
  new: "untested word",
  mastered: "mastered word",
};

/** What lighting a set and finding it empty says, instead of "Drill the 0". */
const SET_EMPTY = {
  hard: "No hard words yet",
  learning: "No words in progress yet",
  new: "Every word has been tried",
  mastered: "Nothing mastered yet",
};

const HARD_SHOWN = 24;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Progress is the comb. The key above it is also how a set is chosen: light
 * up the hard words and the bar at the bottom drills exactly those. A cell
 * opens its word. Below, the same information in words: the hard ones by
 * name, and every word as a plain list.
 */
export default function ProgressTab({
  words,
  progress,
  history,
  current,
  counts,
  filter,
  started,
  finished,
  remaining,
  onPick,
  onContinue,
  onHear,
}) {
  const [focus, setFocus] = useState(() => (SETS.some((s) => s.id === filter) ? filter : "all"));
  const [picked, setPicked] = useState(null);
  const [query, setQuery] = useState("");
  const inspectorRef = useRef(null);

  const hard = useMemo(
    () => words.filter((word) => statusOf(word, progress) === "hard").sort((a, b) => a.localeCompare(b)),
    [words, progress]
  );

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? new Set(words.filter((w) => w.toLowerCase().includes(q))) : null),
    [q, words]
  );

  if (!words.length) {
    return (
      <main className="pl-page">
        <h1 className="pl-page-title">Progress</h1>
        <p className="pl-body">No words yet. Add them in the Words tab and the comb fills in as you drill.</p>
      </main>
    );
  }

  // Picking a word always brings its inspector into view, clear of the
  // docked bar: on a phone it sits under the comb, out of sight otherwise.
  const pick = (index) => {
    setPicked(index);
    requestAnimationFrame(() =>
      inspectorRef.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" })
    );
  };

  const onQuery = (value) => {
    setQuery(value);
    const needle = value.trim().toLowerCase();
    if (!needle) return;
    const exact = words.findIndex((w) => w.toLowerCase() === needle);
    const prefix = words.findIndex((w) => w.toLowerCase().startsWith(needle));
    const any = words.findIndex((w) => w.toLowerCase().includes(needle));
    const hit = exact >= 0 ? exact : prefix >= 0 ? prefix : any;
    if (hit >= 0) setPicked(hit);
  };

  const isLit = (word, state) => (matches ? matches.has(word) : focus === "all" || state.status === focus);

  const pickedWord = picked === null ? null : words[picked] ?? null;
  const pickedCluster = pickedWord ? clusterOf(picked) : 0;
  const clusterStart = pickedCluster * CLUSTER_SIZE;
  const clusterSize = Math.min(CLUSTER_SIZE, words.length - clusterStart);
  const clusterCount = Math.ceil(words.length / CLUSTER_SIZE);

  // One primary action: drill the set that is lit, or carry on with the one
  // already in play rather than restarting it.
  const count = counts[focus] ?? 0;
  const continuing = started && focus === filter && !finished && remaining > 0;
  const band = continuing
    ? { label: "Keep drilling", note: `${remaining} left`, onClick: onContinue }
    : {
        label:
          focus === "all"
            ? `Drill all ${count} ${count === 1 ? "word" : "words"}`
            : count === 0
              ? SET_EMPTY[focus] ?? "Nothing to drill"
              : count === 1
                ? `Drill the 1 ${SET_ONE[focus] ?? "word"}`
                : `Drill the ${count} ${SET_NOUN[focus]}`,
        note: null,
        onClick: () => onPick(focus),
        disabled: count === 0,
      };

  return (
    <main className="pl-page pl-page--progress">
      <header className="pl-progress-head">
        <h1 className="pl-page-title">Progress</h1>
        <p className="pl-progress-summary">
          <strong>{counts.mastered}</strong> of {counts.all} mastered
          {counts.hard ? (
            <>
              , <strong className="pl-hardnum">{counts.hard}</strong> hard
            </>
          ) : null}
          .
        </p>
      </header>

      {/* One grid, four areas. On a phone they stack key, comb, inspector,
          find, so lighting a set and picking a word happen in the same view
          as the comb; on a wide screen the comb takes the left column. */}
      <div className="pl-progress-grid">
        <section className="pl-area-key" aria-labelledby="sets-title">
          <h2 id="sets-title" className="pl-section-title">
            Light up a set
          </h2>
          <ul className="pl-sets">
            {SETS.map(({ id, label, glyph }) => (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={focus === id}
                  onClick={() => {
                    setFocus(id);
                    setQuery("");
                  }}
                  className={`pl-set pl-set--${id} ${focus === id ? "is-on" : ""}`}
                >
                  {glyph ? <CellGlyph {...glyph} /> : <ListGlyph counts={counts} />}
                  <span className="pl-set-count">{counts[id] ?? 0}</span>
                  <span className="pl-set-label">
                    {label}
                    {id === filter && started && !finished ? <span className="pl-set-play"> in play</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="pl-area-comb" aria-labelledby="comb-title">
          <h2 id="comb-title" className="pl-sr">
            The comb
          </h2>
          <ProgressComb
            words={words}
            progress={progress}
            current={current}
            picked={picked}
            onPick={pick}
            isLit={isLit}
          />
          <p className="pl-comb-caption">
            Empty cells are untested. Honey fills a cell a third at a time as you get it right, up to{" "}
            {MASTERY_STREAK} in a row. Vermilion with a hole: missed last time. Each cluster is{" "}
            {CLUSTER_SIZE} words of your list, in order.
          </p>
        </section>

        <div className="pl-area-inspect" ref={inspectorRef}>
          {pickedWord ? (
            <WordInspector
              word={pickedWord}
              index={picked}
              state={cellState(pickedWord, progress)}
              record={history[pickedWord]}
              inPlay={pickedWord === current}
              cluster={pickedCluster}
              clusterCount={clusterCount}
              clusterStart={clusterStart}
              clusterSize={clusterSize}
              onHear={onHear}
              onDrillWord={() => onPick(`word:${pickedWord}`)}
              onDrillCluster={() => onPick(`cluster:${pickedCluster}`)}
            />
          ) : (
            <p className="pl-inspect-empty">Pick a cell to see its word, how it has gone, and drill it.</p>
          )}
        </div>

        <div className="pl-area-find">
          <label className="pl-find">
            <span className="pl-find-label">Find a word</span>
            <input
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Start typing"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </label>
          {matches && (
            <p className="pl-find-note" aria-live="polite">
              {matches.size === 0 ? "No word in the list matches." : `${matches.size} ${matches.size === 1 ? "match" : "matches"} lit.`}
            </p>
          )}
        </div>
      </div>

      {hard.length > 0 && (
        <section aria-labelledby="hard-title">
          <h2 id="hard-title" className="pl-section-title">
            Hard words
          </h2>
          <p className="pl-section-note">Missed the last time they came up. Pick one to open it.</p>
          <ul className="pl-hardlist">
            {hard.slice(0, HARD_SHOWN).map((word) => (
              <li key={word}>
                <button type="button" onClick={() => pick(words.indexOf(word))}>
                  {word}
                </button>
              </li>
            ))}
          </ul>
          {hard.length > HARD_SHOWN && (
            <p className="pl-section-note">And {hard.length - HARD_SHOWN} more: light up Hard to see them all.</p>
          )}
        </section>
      )}

      <details className="pl-every">
        <summary>Every word as a list</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Word</th>
              <th scope="col">Status</th>
              <th scope="col">In a row</th>
              <th scope="col">Tried</th>
            </tr>
          </thead>
          <tbody>
            {words.map((word) => {
              const state = cellState(word, progress);
              const record = history[word];
              return (
                <tr key={word} className={`pl-every--${state.status}`}>
                  <th scope="row">{word}</th>
                  <td>{STATUS_TEXT[state.status]}</td>
                  <td>{state.streak ?? "–"}</td>
                  <td>{record ? `${record.tries} (${record.misses} missed)` : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      <div className="pl-page-bar">
        <button type="button" className="pl-band" onClick={band.onClick} disabled={band.disabled}>
          <span>
            {band.label}
            {band.note && <span className="pl-band-note"> · {band.note}</span>}
          </span>
          <span className="pl-band-mark" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </main>
  );
}
