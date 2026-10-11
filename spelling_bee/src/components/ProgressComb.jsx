import { useMemo, useRef } from "react";
import { CELL_H, combLayout, neighbor } from "../lib/comb.js";
import { MASTERY_STREAK, cellState } from "../lib/progress.js";

/**
 * The comb: one hexagonal cell per word, in clusters of nineteen.
 *
 * It fills with honey as the list is learned, and the fill is the real
 * streak: an untested word is an empty cell, a word right once or twice is a
 * third or two thirds full, a mastered word is full. A hard word is the one
 * break: full, vermilion, and holed, because it is the state worth scanning a
 * hundred and sixty cells for. Each status differs in shape as well as colour,
 * so none of it depends on telling hues apart.
 *
 * A cell is a word, so it is picked to inspect that word. The cells are a
 * listbox with one tab stop and spatial arrow keys, because arrowing through
 * a hundred and sixty tab stops is not keyboard access. They sit under the
 * 44px this project holds itself to elsewhere and can't not: a hundred and
 * sixty of them fit a phone. Everything they carry is also in text on the
 * same screen, so the comb is the fast way to a word, never the only way.
 */

export const STATUS_TEXT = {
  new: "untested",
  learning: "learning",
  hard: "hard",
  mastered: "mastered",
};

export function describeCell(word, state) {
  if (state.status === "learning") return `${word}, learning, ${state.streak} of ${MASTERY_STREAK} in a row`;
  if (state.status === "hard") return `${word}, hard, missed last time`;
  if (state.status === "mastered") return `${word}, mastered`;
  return `${word}, untested`;
}

/** Widest a cell may get, so a short list makes a small comb rather than a
    handful of enormous tiles. */
const MAX_CELL = 34;

/** Smallest a cell may get before the page scrolls instead: below this a
    cell stops being something a finger or an eye can find. */
const MIN_CELL = 13;

export default function ProgressComb({ words, progress, current, picked, onPick, isLit }) {
  const gridRef = useRef(null);
  const layout = useMemo(() => (words.length ? combLayout(words.length) : null), [words.length]);
  if (!layout) return null;

  const { cells, width, height } = layout;
  const pct = (value, span) => `${(value / span) * 100}%`;
  const focusIndex = picked ?? cells[0]?.index ?? 0;
  const pickedCluster = picked === null ? null : cells.find((c) => c.index === picked)?.cluster ?? null;

  const move = (to) => {
    if (to === null || to === undefined) return;
    onPick(to);
    gridRef.current?.querySelector(`[data-cell="${to}"]`)?.focus();
  };

  const onKeyDown = (event) => {
    const keys = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    if (event.key in keys) move(neighbor(cells, focusIndex, keys[event.key]));
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(words.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      ref={gridRef}
      role="listbox"
      aria-label={`The comb: ${words.length} words, one cell each. Arrow keys move between cells.`}
      onKeyDown={onKeyDown}
      className="pl-comb"
      // Capped by the viewport's height too, so the whole comb fits above the
      // docked bar on a laptop screen instead of running underneath it.
      style={{
        aspectRatio: `${width} / ${height}`,
        maxWidth: `max(${width * MIN_CELL}px, min(${width * MAX_CELL}px, calc((100dvh - var(--pl-comb-chrome)) * ${(width / height).toFixed(4)})))`,
      }}
    >
      {cells.map(({ index, cluster, x, y }) => {
        const word = words[index];
        const state = cellState(word, progress);
        const inPlay = word === current;
        const chosen = index === picked;
        const lit = isLit ? isLit(word, state) : true;
        const sameCluster = pickedCluster !== null && cluster === pickedCluster;
        return (
          <button
            key={index}
            type="button"
            role="option"
            data-cell={index}
            data-status={state.status}
            aria-selected={chosen}
            aria-label={`${describeCell(word, state)}${inPlay ? ", in play" : ""}`}
            // Roving tabindex: one stop for the whole comb, arrows inside it.
            tabIndex={index === focusIndex ? 0 : -1}
            onClick={() => onPick(index)}
            className={`pl-cellbtn ${chosen ? "is-picked" : ""} ${lit ? "" : "is-faded"} ${sameCluster ? "in-cluster" : ""}`}
            style={{
              left: pct(x - 0.5, width),
              top: pct(y - CELL_H / 2, height),
              width: pct(1, width),
              height: pct(CELL_H, height),
            }}
          >
            {/* Rings are hexagons themselves: an outline on a clip-path element
                is clipped away with everything outside the shape. */}
            <span className={`hex pl-ring ${inPlay || chosen ? "is-on" : ""}`}>
              <span className="hex pl-gap">
                <span className={`hex pl-hex pl-hex--${state.status}`} style={{ "--fill": state.fill }}>
                  <span className="hex pl-hex-in" />
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The whole list as one cell: its real mix of statuses, mastered to untested. */
export function ListGlyph({ counts }) {
  const total = Math.max(1, counts.all);
  const stops = [];
  let at = 0;
  [
    ["mastered", "var(--pl-honey-pale)"],
    ["learning", "var(--pl-honey)"],
    ["hard", "var(--pl-ember)"],
    ["new", "#5d524f"],
  ].forEach(([key, colour]) => {
    const next = at + (counts[key] / total) * 100;
    stops.push(`${colour} ${at}% ${next}%`);
    at = next;
  });
  return <span className="pl-glyph pl-glyph--all" style={{ background: `conic-gradient(${stops.join(", ")})` }} aria-hidden="true" />;
}

/** A single cell drawn at a fixed size, for the key. */
export function CellGlyph({ status, fill }) {
  return (
    <span className="pl-glyph" aria-hidden="true">
      <span className={`hex pl-hex pl-hex--${status}`} style={{ "--fill": fill }}>
        <span className="hex pl-hex-in" />
      </span>
    </span>
  );
}
