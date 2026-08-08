import { Check, CircleAlert, X } from "lucide-react";

function spaced(word) {
  return word.toUpperCase().split("").join("-");
}

export default function Feedback({ feedback }) {
  if (!feedback) return null;

  const base = "mt-4 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed";

  if (feedback.kind === "correct") {
    return (
      <div className={`${base} border-ok bg-okdim text-ok`}>
        <Check size={17} className="mt-0.5 shrink-0" />
        <p>
          {feedback.mastered
            ? "Correct — mastered."
            : `Correct — streak ${feedback.streak} of 3.`}
        </p>
      </div>
    );
  }

  if (feedback.kind === "wrong") {
    return (
      <div className={`${base} border-miss bg-missdim text-miss`}>
        <X size={17} className="mt-0.5 shrink-0" />
        <p>
          Not quite. It's <b className="font-mono font-medium tracking-widest">{spaced(feedback.word)}</b>
        </p>
      </div>
    );
  }

  if (feedback.kind === "truncated") {
    return (
      <div className={`${base} border-honeydim bg-[#3a2f1c] text-honey`}>
        <CircleAlert size={17} className="mt-0.5 shrink-0" />
        <p>
          Only caught{" "}
          <b className="font-mono font-medium tracking-widest">{spaced(feedback.heard)}</b> — the
          last letters were cut off. Not scored. Spell it again, and hold the final letter a beat
          longer.
        </p>
      </div>
    );
  }

  return (
    <div className={`${base} border-honeydim bg-[#3a2f1c] text-honey`}>
      <CircleAlert size={17} className="mt-0.5 shrink-0" />
      <p>
        Audio unclear — heard{" "}
        <b className="font-mono font-medium tracking-widest">{spaced(feedback.heard)}</b>. Not scored.
        Spell it again, or say the letter word ("papa" for P, "bravo" for B).
      </p>
    </div>
  );
}
