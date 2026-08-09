import { useMemo, useState } from "react";
import ProgressComb, { STATUS } from "./ProgressComb.jsx";
import { statusOf } from "../lib/progress.js";

/** Hard sits second because it is the set most worth drilling, and the one the
    speller came here to find. */
const POOLS = [
  { id: "all", label: "All words" },
  { id: "hard", label: "Hard" },
  { id: "learning", label: "Learning" },
  { id: "new", label: "Untested" },
  { id: "mastered", label: "Mastered" },
];

/** All words is every state at once, so it gets the one neutral that isn't a
    status. Every other dot comes from the comb, so the two can't drift apart. */
const DOT = { all: "bg-cream" };
const dotFor = (id) => DOT[id] ?? STATUS[id].tone;

/** Enough hard words to plan a session around; the rest are one tap away. */
const HARD_SHOWN = 24;

export default function ProgressTab({ words, progress, current, counts, filter, onPick }) {
  const [showAllHard, setShowAllHard] = useState(false);

  const hard = useMemo(
    () =>
      words
        .filter((word) => statusOf(word, progress) === "hard")
        .sort((a, b) => a.localeCompare(b)),
    [words, progress]
  );

  if (!words.length) {
    return (
      <p className="mx-auto max-w-[46ch] px-2 py-16 text-center text-[15px] leading-relaxed text-sage">
        No words yet. Add them in the Words tab and this fills in as you drill.
      </p>
    );
  }

  const shownHard = showAllHard ? hard : hard.slice(0, HARD_SHOWN);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">What to drill</h2>
        <p className="mb-4 text-[14px] text-sage">Pick a set. Practice starts on it.</p>

        {/* Chips rather than stacked rows: five full-width rows spent the whole
            first screen on a control the speller uses once a session, and what
            they came for started below the fold. The state each label means is
            defined once, in the key under the comb. */}
        <ul className="grid grid-cols-2 gap-2">
          {POOLS.map(({ id, label }) => {
            const count = counts[id] ?? 0;
            const active = id === filter;
            const empty = count === 0;
            return (
              /* All words is the whole list rather than one state of it, so it
                 takes its own row and the four states below make a square. */
              <li key={id} className={id === "all" ? "col-span-2" : undefined}>
                <button
                  type="button"
                  onClick={() => onPick(id)}
                  disabled={empty}
                  aria-current={active ? "true" : undefined}
                  /* Selection is the border, not a fill: the chip keeps one
                     ground in every state, so its label holds 5.8:1 or better
                     whether it is picked, empty or neither. An empty set goes
                     quiet rather than translucent — dimming a whole row put its
                     text under 3:1 to say a thing the 0 already says. */
                  className={`flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border-2 bg-surface px-3.5 transition-colors disabled:cursor-default ${
                    active
                      ? "border-honey"
                      : empty
                        ? "border-line"
                        : "border-dim hover:border-cream"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotFor(id)} ${
                      empty ? "opacity-40" : ""
                    }`}
                  />
                  <span
                    className={`text-[15px] font-medium ${empty ? "text-dim" : "text-cream"}`}
                  >
                    {label}
                  </span>
                  <span
                    className={`ml-auto font-mono text-[15px] ${
                      empty ? "text-dim" : active ? "text-cream" : "text-sage"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The one question this tab exists to answer, answered in words. The comb
          shows how many are hard and roughly where; only a list says which. */}
      {hard.length > 0 && (
        <section>
          <h2 className="mb-1 font-display text-xl font-semibold">Hard words</h2>
          <p className="mb-4 text-[14px] text-sage">Missed the last time they came up.</p>

          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[15px] leading-snug text-cream">
            {shownHard.map((word) => (
              <li key={word}>{word}</li>
            ))}
          </ul>

          {hard.length > HARD_SHOWN && !showAllHard && (
            <button
              type="button"
              onClick={() => setShowAllHard(true)}
              className="mt-2 flex min-h-[44px] items-center text-[14px] text-sage transition-colors hover:text-cream"
            >
              Show all {hard.length}
            </button>
          )}
        </section>
      )}

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
