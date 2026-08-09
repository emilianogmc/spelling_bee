import { useRef, useState } from "react";
import { CELL_H, combLayout } from "../lib/comb.js";
import { statusOf } from "../lib/progress.js";

/**
 * Untested, learning and mastered are one progression, so they get one hue and
 * climb it: an unlit cell, then honey, then pale honey. The comb fills with
 * honey as the list is learned, which is both what the data is and what the
 * thing is a picture of.
 *
 * Hard is not a step on that progression. It is the state the whole tab exists
 * to surface, and the only one worth scanning a hundred and sixty cells for,
 * so it keeps the one hue break. Olive left the comb; it still marks a correct
 * answer on the verdict, where green is doing semantic work rather than
 * competing for attention in a field.
 *
 * Luminances run 0.11 / 0.44 / 0.65 for the ramp against 0.26 for ember, so
 * the states stay apart by lightness alone and survive colour blindness.
 *
 * `note` is where the vocabulary is defined, once. The pool chips above used to
 * repeat it under every label, which cost three hundred pixels to say a thing
 * the speller learns on their first visit.
 *
 * `text` is the tone as a label rather than a fill, so it has to clear 4.5:1 on
 * the page: ember is 4.1:1 and hands off to emberpale, and `hover` is 2.1:1 and
 * hands off to sage.
 */
export const STATUS = {
  new: { label: "untested", note: "not tried yet", tone: "bg-hover", text: "text-sage" },
  learning: {
    label: "learning",
    note: "right at least once",
    tone: "bg-honey",
    text: "text-honey",
  },
  hard: {
    label: "hard",
    note: "missed last time",
    tone: "bg-ember",
    text: "text-emberpale",
  },
  mastered: {
    label: "mastered",
    note: "three in a row",
    tone: "bg-honeypale",
    text: "text-honeypale",
  },
};

const KEY_ORDER = ["new", "learning", "hard", "mastered"];

/** Widest a cell is allowed to get, so a short list makes a small comb rather
    than a handful of enormous tiles. */
const MAX_CELL = 26;

/**
 * The comb is built the way a comb is: clusters of nineteen cells, one cell
 * per word, set slightly apart and arranged into a hexagon themselves.
 *
 * Every position comes from combLayout in cell widths; this only turns them
 * into percentages, so the whole thing scales with its container and the
 * arithmetic stays somewhere it can be tested.
 *
 * A cell is a word, so it says which word it is when picked. It used to say so
 * through `title` alone, which on the phone this is built for meant not at all:
 * a hundred and sixty cells of colour and no way to read one. Picked cells are
 * a listbox rather than a set of buttons, because arrowing through a hundred
 * and sixty tab stops is not keyboard access.
 *
 * The cells sit well under the 44px this project holds itself to elsewhere, and
 * they can't not: a hundred and sixty of them have to fit a phone. Everything
 * they carry is also in text on this tab — counts on the chips, the hard words
 * in a list — so the comb is the fast way to it, never the only way.
 */
export default function ProgressComb({ words, progress, current }) {
  const [picked, setPicked] = useState(null);
  const gridRef = useRef(null);

  if (!words.length) return null;

  const { cells, width, height } = combLayout(words.length);
  const pct = (value, span) => `${(value / span) * 100}%`;

  // Cells are laid out from the middle of the comb outward, so up and down mean
  // nothing here. Left and right are honest: they step through the word list.
  const move = (to) => {
    const next = Math.max(0, Math.min(to, words.length - 1));
    setPicked(next);
    gridRef.current?.querySelector(`[data-cell="${next}"]`)?.focus();
  };

  const onKeyDown = (event) => {
    const from = picked ?? 0;
    const step = { ArrowRight: 1, ArrowLeft: -1 };
    if (event.key in step) move(from + step[event.key]);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(words.length - 1);
    else return;
    event.preventDefault();
  };

  // Saving a shorter list can strand the pick past the end of it.
  const word = picked === null ? null : (words[picked] ?? null);
  const status = word ? STATUS[statusOf(word, progress)] : null;

  return (
    <div>
      <div
        ref={gridRef}
        role="listbox"
        aria-label={`${words.length} words, one cell each, coloured by status`}
        onKeyDown={onKeyDown}
        style={{ aspectRatio: `${width} / ${height}`, maxWidth: `${width * MAX_CELL}px` }}
        className="relative mx-auto w-full"
      >
        {cells.map(({ index, x, y }) => {
          const cellWord = words[index];
          const cellStatus = statusOf(cellWord, progress);
          const inPlay = cellWord === current;
          const chosen = index === picked;
          return (
            <button
              key={index}
              type="button"
              role="option"
              data-cell={index}
              aria-selected={chosen}
              aria-label={`${cellWord}, ${STATUS[cellStatus].label}${inPlay ? ", in play" : ""}`}
              // Roving tabindex: one stop for the whole comb, arrows inside it.
              tabIndex={chosen || (picked === null && index === 0) ? 0 : -1}
              title={cellWord}
              onClick={() => setPicked(index)}
              style={{
                position: "absolute",
                left: pct(x - 0.5, width),
                top: pct(y - CELL_H / 2, height),
                width: pct(1, width),
                height: pct(CELL_H, height),
              }}
              /* The picked cell lifts out of the field. Two cells can carry the
                 cream ring at once — the word in play and the one just picked —
                 and scale is what tells them apart without spending a colour. */
              className={`p-[1.5px] transition-transform duration-200 ease-[var(--ease-out-quart)] ${
                chosen ? "z-10 scale-[1.35]" : ""
              }`}
            >
              {/* The ring marking the word in play has to be a hexagon itself:
                  an outline on a clip-path element gets clipped away with
                  everything else outside the shape. */}
              <span
                className={`hex block h-full w-full ${
                  inPlay || chosen ? "bg-cream p-[2px]" : ""
                }`}
              >
                <span
                  className={`hex block h-full w-full transition-colors ${STATUS[cellStatus].tone}`}
                />
              </span>
            </button>
          );
        })}
      </div>

      {/* One slot, always the same height, so naming a cell never moves the key
          underneath it. */}
      <p className="mt-4 flex min-h-[28px] flex-wrap items-center justify-center gap-x-2.5 text-center text-[15px]">
        {word ? (
          <>
            <span className="font-medium text-cream">{word}</span>
            <span aria-hidden="true" className="text-dim">
              ·
            </span>
            <span className={status.text}>{status.label}</span>
            {word === current && (
              <>
                <span aria-hidden="true" className="text-dim">
                  ·
                </span>
                <span className="text-sage">in play</span>
              </>
            )}
          </>
        ) : (
          <span className="text-sage">Tap a cell to see its word.</span>
        )}
      </p>

      <dl className="mt-4 grid gap-x-5 gap-y-2 border-t border-line pt-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {KEY_ORDER.map((key) => (
          <div key={key} className="flex items-center gap-2 text-[13px]">
            <dt className="flex shrink-0 items-center gap-2 text-cream">
              <i className={`hex h-3 w-[10.4px] shrink-0 ${STATUS[key].tone}`} aria-hidden="true" />
              {STATUS[key].label}
            </dt>
            <dd className="text-sage">{STATUS[key].note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
