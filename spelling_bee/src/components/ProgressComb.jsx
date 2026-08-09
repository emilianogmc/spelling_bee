import { hexRows, layout, sideFor } from "../lib/comb.js";
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

/** A cell is 30px across at most, so a short list makes a small comb rather
    than a few enormous tiles. */
const MAX_CELL = 30;

/**
 * The comb is a hexagon built out of hexagons, sized to the smallest one the
 * word list fits inside and filled from the middle out.
 *
 * Every row is centred, which is the whole trick: consecutive rows differ in
 * length by exactly one, so a row of k lands in the notches of the row of k+1
 * with no explicit half-cell offset. Cells are sized as a share of the
 * container so the shape holds at any width.
 */
export default function ProgressComb({ words, progress, current }) {
  if (!words.length) return null;

  const side = sideFor(words.length);
  const rows = hexRows(side);
  const placed = layout(words, side);

  const widest = 2 * side - 1;
  const pitch = 100 / widest;
  // A pointy-top hexagon is √3/2 as wide as it is tall, and a honeycomb stacks
  // its rows three-quarters of a height apart, so each row climbs a quarter of
  // a height into the one above: 0.2887 of a cell width. Percentage margins
  // resolve against the container's width, the unit `pitch` is already in.
  const rise = (pitch * 0.2887).toFixed(3);

  return (
    <div>
      <div
        role="img"
        aria-label={`Honeycomb of ${words.length} words, one cell each, coloured by status.`}
        style={{ maxWidth: `${widest * MAX_CELL}px` }}
        className="mx-auto"
      >
        {rows.map((length, row) => (
          <div
            key={row}
            className="flex justify-center"
            style={row ? { marginTop: `-${rise}%` } : undefined}
          >
            {Array.from({ length }, (_, col) => {
              // Spare cells still hold their place in the lattice; without
              // them the rows either side would close the gap and the cells
              // would stop lining up.
              const word = placed.get(`${row},${col}`);
              return (
                <div
                  key={col}
                  title={word}
                  style={{ width: `${pitch}%`, aspectRatio: "0.866" }}
                  className="p-[1.5px]"
                >
                  {/* The ring marking the word in play has to be a hexagon
                      itself: an outline on a clip-path element gets clipped
                      away with everything else outside the shape. */}
                  <div
                    className={`hex h-full w-full ${
                      word && word === current ? "bg-chalk p-[2px]" : ""
                    }`}
                  >
                    <div
                      className={`hex h-full w-full transition-colors ${
                        word ? TONE[statusOf(word, progress)] : ""
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
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
