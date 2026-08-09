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
 * the states stay apart by lightness alone and survive colour blindness. The
 * pool list above gives every count in words besides.
 */
const TONE = {
  new: "bg-hover",
  learning: "bg-honey",
  hard: "bg-ember",
  mastered: "bg-honeypale",
};

const LEGEND = [
  { key: "new", label: "untested" },
  { key: "learning", label: "learning" },
  { key: "hard", label: "hard" },
  { key: "mastered", label: "mastered" },
];

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
 */
export default function ProgressComb({ words, progress, current }) {
  if (!words.length) return null;

  const { cells, width, height } = combLayout(words.length);
  const pct = (value, span) => `${(value / span) * 100}%`;

  return (
    <div>
      <div
        role="img"
        aria-label={`Honeycomb of ${words.length} words, one cell each, coloured by status.`}
        style={{ aspectRatio: `${width} / ${height}`, maxWidth: `${width * MAX_CELL}px` }}
        className="relative mx-auto w-full"
      >
        {cells.map(({ index, x, y }) => {
          const word = words[index];
          return (
            <div
              key={index}
              title={word}
              style={{
                position: "absolute",
                left: pct(x - 0.5, width),
                top: pct(y - CELL_H / 2, height),
                width: pct(1, width),
                height: pct(CELL_H, height),
              }}
              className="p-[1.5px]"
            >
              {/* The ring marking the word in play has to be a hexagon itself:
                  an outline on a clip-path element gets clipped away with
                  everything else outside the shape. */}
              <div
                className={`hex h-full w-full ${word === current ? "bg-cream p-[2px]" : ""}`}
              >
                <div
                  className={`hex h-full w-full transition-colors ${
                    TONE[statusOf(word, progress)]
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-line pt-4">
        {LEGEND.map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px] text-sage">
            <i className={`hex inline-block h-3 w-[10.4px] ${TONE[key]}`} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
