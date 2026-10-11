import { Volume2 } from "lucide-react";
import Letters from "./Letters.jsx";
import { spaced } from "../lib/letters.js";
import { MASTERY_STREAK } from "../lib/progress.js";

const DAY = 24 * 60 * 60 * 1000;

/** "today", "yesterday", "3 days ago", or a short date. */
export function whenText(at, now = Date.now()) {
  const start = (t) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((start(now) - start(at)) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusLine(state) {
  if (state.status === "hard") return "Hard. Missed the last time it came up.";
  if (state.status === "learning") return `Learning. ${state.streak} of ${MASTERY_STREAK} in a row.`;
  if (state.status === "mastered")
    return state.streak > MASTERY_STREAK ? `Mastered. ${state.streak} in a row.` : "Mastered. Three in a row.";
  return "Untested. Not tried yet.";
}

/**
 * One word, picked from the comb: where it stands, what has happened to it,
 * and what to do about it. Only what the app actually records is shown: the
 * streak, and the private history kept on this device since history began.
 */
export default function WordInspector({ word, index, state, record, inPlay, cluster, clusterCount, clusterStart, clusterSize, onHear, onDrillWord, onDrillCluster }) {
  return (
    <section className={`pl-inspect pl-inspect--${state.status}`} aria-label={`About ${word}`}>
      <p className="pl-inspect-where">
        No. {index + 1} in your list · cluster {cluster + 1} of {clusterCount}, words {clusterStart + 1}–
        {clusterStart + clusterSize}
        {inPlay ? " · in play now" : ""}
      </p>
      <h3 className="pl-inspect-word">
        <span className="pl-sr">{word}</span>
        <Letters text={word} minCols={Math.max(word.length, 10)} />
      </h3>
      <p className="pl-inspect-status">{statusLine(state)}</p>

      <ul className="pl-inspect-facts">
        {record ? (
          <>
            <li>
              Tried {record.tries} {record.tries === 1 ? "time" : "times"}, missed {record.misses}.
            </li>
            <li>Last practised {whenText(record.last)}.</li>
            {record.lastMiss && (
              <li>
                Last misspelt as <span className="pl-inspect-miss">{spaced(record.lastMiss)}</span>.
              </li>
            )}
          </>
        ) : state.status === "new" ? (
          <li>No attempts yet.</li>
        ) : (
          <li>Practised before history was kept, so only the streak is known.</li>
        )}
      </ul>

      <div className="pl-inspect-actions">
        <button type="button" onClick={() => onHear(word)} className="pl-textbtn pl-textbtn--icon">
          <Volume2 size={18} aria-hidden="true" /> Hear it
        </button>
        <button type="button" onClick={onDrillWord} className="pl-textbtn">
          Drill this word
        </button>
        <button type="button" onClick={onDrillCluster} className="pl-textbtn">
          Drill cluster {cluster + 1} ({clusterSize} words)
        </button>
      </div>
    </section>
  );
}
