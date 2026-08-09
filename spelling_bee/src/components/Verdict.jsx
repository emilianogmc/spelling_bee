import { Check, CircleAlert, X } from "lucide-react";

function spaced(word) {
  return word.toUpperCase().split("").join("-");
}

const TONE = {
  correct: { border: "border-ok", bg: "bg-okdim", text: "text-ok", Icon: Check },
  wrong: { border: "border-miss", bg: "bg-missdim", text: "text-miss", Icon: X },
  unclear: { border: "border-honeydim", bg: "bg-raised", text: "text-honey", Icon: CircleAlert },
};

function body(feedback) {
  if (feedback.kind === "correct") {
    return feedback.mastered ? "Mastered." : `Right. ${feedback.streak} of 3 in a row.`;
  }
  if (feedback.kind === "wrong") {
    return (
      <>
        Not quite. It's <b className="letters font-medium">{spaced(feedback.word)}</b>
      </>
    );
  }
  if (feedback.kind === "truncated") {
    return (
      <>
        Only caught <b className="letters font-medium">{spaced(feedback.heard)}</b>. Not scored,
        so spell it again and hold the last letter a beat longer.
      </>
    );
  }
  return (
    <>
      Didn't catch that clearly, heard <b className="letters font-medium">{spaced(feedback.heard)}</b>
      . Not scored. Try "papa" for P, "bravo" for B.
    </>
  );
}

/**
 * The verdict sits where the action button was, so the eye is already there.
 * Sized and coloured to be read across a room without reading the words.
 */
export default function VerdictSheet({ feedback, onContinue }) {
  if (!feedback) return null;

  const tone = TONE[feedback.kind] ?? TONE.unclear;
  const { Icon } = tone;
  const scored = feedback.kind === "correct" || feedback.kind === "wrong";

  return (
    <div
      role="status"
      aria-live="assertive"
      style={{ zIndex: "var(--z-sheet)" }}
      className="sheet-rise fixed inset-x-0 bottom-[56px] border-t-2 border-b border-line px-4 pt-4 pb-5"
    >
      <div
        className={`mx-auto flex max-w-[560px] items-center gap-3.5 rounded-xl border ${tone.border} ${tone.bg} px-4 py-3.5`}
      >
        <Icon size={26} strokeWidth={2.5} className={`shrink-0 ${tone.text}`} aria-hidden="true" />
        <p className={`flex-1 text-[15px] leading-snug ${tone.text}`}>{body(feedback)}</p>
        <button
          type="button"
          onClick={onContinue}
          className="min-h-[44px] shrink-0 rounded-lg border border-honey bg-honey px-4 text-sm font-semibold text-[#241a08] transition-colors hover:bg-[#f0b64f]"
        >
          {scored ? "Next" : "Retry"}
        </button>
      </div>
    </div>
  );
}
