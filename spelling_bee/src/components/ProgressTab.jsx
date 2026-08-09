import ProgressComb from "./ProgressComb.jsx";

const POOLS = [
  { id: "all", label: "All words", hint: "Every word in the list" },
  { id: "hard", label: "Hard", hint: "Missed last time" },
  { id: "learning", label: "Learning", hint: "Right at least once" },
  { id: "new", label: "Untested", hint: "Not tried yet" },
  { id: "mastered", label: "Mastered", hint: "Three in a row" },
];

/** Matches the comb exactly, so the two read as one system. */
const DOT = {
  all: "bg-cream",
  hard: "bg-ember",
  learning: "bg-honey",
  new: "bg-hover",
  mastered: "bg-honeypale",
};

export default function ProgressTab({ words, progress, current, counts, filter, onPick }) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">What to drill</h2>
        <p className="mb-4 text-[14px] text-sage">
          Pick a set and practice starts on it.
        </p>

        <ul className="flex flex-col gap-2">
          {POOLS.map(({ id, label, hint }) => {
            const count = counts[id] ?? 0;
            const active = id === filter;
            const empty = count === 0;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onPick(id)}
                  disabled={empty}
                  aria-current={active ? "true" : undefined}
                  /* Selection is carried by the border, not by a darker fill:
                     on `raised` the 13px hint drops to 3.6:1. Same ground for
                     both states keeps every row's text at 5.8:1 or better. */
                  className={`flex min-h-[60px] w-full items-center gap-3.5 rounded-xl border-2 bg-surface px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
                    active ? "border-honey" : "border-dim hover:border-cream"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-3 w-3 shrink-0 rounded-full ${DOT[id]}`}
                  />
                  <span className="flex-1">
                    <span className="block text-[15px] font-medium text-cream">{label}</span>
                    <span className="block text-[13px] text-sage">{hint}</span>
                  </span>
                  <span
                    className={`font-mono text-lg ${active ? "text-cream" : "text-sage"}`}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">The comb</h2>
        <p className="mb-4 text-[14px] text-sage">
          One cell per word. The outlined cell is the word in play.
        </p>
        <ProgressComb words={words} progress={progress} current={current} />
      </section>
    </div>
  );
}
