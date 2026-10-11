import { useRef } from "react";
import { useFit } from "../hooks/useFit.js";

/** Archivo's width axis and the advance per letter it buys, by word length:
    a fourteen-letter word condenses rather than shrinking to a whisper. */
function fit(n) {
  if (n <= 7) return { wdth: 100, adv: 0.72 };
  if (n <= 10) return { wdth: 84, adv: 0.64 };
  return { wdth: 66, adv: 0.6 };
}

/**
 * A word set as separate, huge letters. Spellings are always shown letter by
 * letter, never as a solid word, and each letter keeps its own gap.
 *
 * `minCols` sizes the row as if it held at least that many letters, so a word
 * being spelled doesn't shrink under the speller with every letter that lands.
 * `marks` and `inserts` come from targetMarks: a letter got wrong or left out,
 * and a letter that was added in front of this one.
 */
export default function Letters({ text, minCols = 9, marks, inserts, live, small }) {
  const ref = useRef(null);
  useFit(ref);
  const n = Math.max(minCols, text.length);
  const { wdth, adv } = fit(n);
  return (
    <span
      ref={ref}
      className={`pl-letters ${small ? "pl-letters--small" : ""}`}
      style={{ "--n": n, "--adv": adv, "--wdth": `${wdth}%` }}
      aria-hidden="true"
    >
      {[...text].map((ch, i) => (
        <span
          key={i}
          className={`pl-l ${marks?.[i] ? "pl-l--mark" : ""} ${inserts?.[i] ? "pl-l--ins" : ""}`}
        >
          {ch}
        </span>
      ))}
      {live && <span className="pl-caret" />}
    </span>
  );
}
