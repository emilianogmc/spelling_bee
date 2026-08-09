import { CELL_H, combLayout } from "../lib/comb.js";
import { statusOf } from "../lib/progress.js";

const TONE = {
  new: "bg-stone",
  learning: "bg-muted",
  hard: "bg-ember",
  mastered: "bg-moss",
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
                className={`hex h-full w-full ${word === current ? "bg-chalk p-[2px]" : ""}`}
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

      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-line/40 pt-4">
        {LEGEND.map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px] text-muted">
            <i className={`hex inline-block h-3 w-[10.4px] ${TONE[key]}`} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
