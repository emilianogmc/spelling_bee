import { alignLetters } from "../lib/scoring.js";

/**
 * What was said, lined up over what the word is, one column per letter. The
 * big word above it is the spelling to remember; this is the reason it was
 * wrong, readable at a glance: a swapped letter, one left out, one added.
 * Columns that differ carry the vermilion; everything that matched stays ink.
 */
export default function MissComparison({ attempt, word }) {
  const steps = alignLetters(attempt, word);
  const describe = (s) =>
    s.op === "sub"
      ? `${s.heard.toUpperCase()} instead of ${s.target.toUpperCase()}`
      : s.op === "missing"
        ? `${s.target.toUpperCase()} left out`
        : `added ${s.heard.toUpperCase()}`;
  const differences = steps.filter((s) => s.op !== "match").map(describe);

  return (
    <figure className="pl-compare">
      <div className="pl-compare-grid" style={{ "--cols": steps.length }} aria-hidden="true">
        <span className="pl-compare-label">You</span>
        {steps.map((s, i) => (
          <span key={`a${i}`} className={`pl-cell pl-cell--you pl-cell--${s.op}`}>
            {s.heard ?? "–"}
          </span>
        ))}
        <span className="pl-compare-label">Word</span>
        {steps.map((s, i) => (
          <span key={`t${i}`} className={`pl-cell pl-cell--word pl-cell--${s.op}`}>
            {s.target ?? "·"}
          </span>
        ))}
      </div>
      <figcaption className="pl-sr">
        You said {attempt.toUpperCase().split("").join("-")}. {differences.join(", ")}.
      </figcaption>
    </figure>
  );
}
