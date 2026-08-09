import { Check, X } from "lucide-react";
import { spaced } from "../lib/letters.js";

/**
 * The verdict takes the stage the letters were on, rather than sliding in over
 * the controls. The speller is already looking here, the primary button below
 * it never moves, and nothing has to be hidden to keep the two from colliding.
 *
 * Right is olive, wrong is cream. Neither is red: vermilion belongs to the
 * action's colour, a miss is information rather than a penalty, and olive
 * against cream stays distinguishable under every kind of colour blindness,
 * which the usual red/green pair does not. Both are light blocks on a dark
 * page, so the verdict is the loudest thing on screen either way.
 */
export default function Verdict({ feedback }) {
  const correct = feedback.kind === "correct";
  const Icon = correct ? Check : X;

  return (
    <div
      role="alert"
      className={`stage-in flex w-full flex-col items-center gap-4 rounded-2xl px-5 py-8 text-ink ${
        correct ? "bg-olive" : "bg-cream"
      }`}
    >
      <Icon size={40} strokeWidth={2.5} aria-hidden="true" />

      {correct ? (
        <p className="text-center text-xl font-semibold">
          {feedback.mastered ? "Mastered." : `Right. ${feedback.streak} of 3 in a row.`}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-2.5">
          <p className="text-lg">Not quite. It's</p>
          <p className="letters text-center text-[clamp(1.25rem,6vw,1.75rem)] font-medium break-all">
            {spaced(feedback.word)}
          </p>
        </div>
      )}
    </div>
  );
}
