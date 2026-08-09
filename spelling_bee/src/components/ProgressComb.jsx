import { statusOf } from "../lib/progress.js";

const PER_ROW = 9;

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

export default function ProgressComb({ words, progress, current }) {
  const rows = [];
  for (let i = 0; i < words.length; i += PER_ROW) {
    rows.push(words.slice(i, i + PER_ROW));
  }

  return (
    <div>
      <div className="flex flex-col items-center">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`flex ${rowIndex % 2 === 1 ? "ml-2.5" : ""}`}
          >
            {row.map((word) => (
              <div
                key={word}
                title={word}
                className={`hex m-[1.5px] h-[19px] w-[17px] ${TONE[statusOf(word, progress)]} ${
                  word === current ? "outline outline-2 outline-offset-1 outline-chalk" : ""
                }`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3.5">
        {LEGEND.map(({ key, label }) => (
          <span key={key} className="flex items-center gap-2 text-[11px] text-muted">
            <i className={`inline-block h-2.5 w-2.5 rounded-[2px] ${TONE[key]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
