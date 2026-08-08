import { useState } from "react";
import { ClipboardCopy } from "lucide-react";

/**
 * Raw recogniser output, before the letter parser touches it. The dropped-
 * final-letter bug survived four fixes that all reasoned about parsed output;
 * only the untouched transcript distinguishes "the engine never heard it" from
 * "our parser threw it away". Off unless the URL carries ?debug=stt.
 */
export default function SttDebug({ log, target, heard }) {
  const [copied, setCopied] = useState(false);

  const text = [`target: ${target || "(none)"}`, `heard: ${heard || "(nothing)"}`, "", ...log].join(
    "\n"
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the text is selectable below */
    }
  };

  return (
    <div className="rounded-xl border border-honeydim bg-surface px-6 py-5 font-mono text-[11px]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold text-honey">Mic diagnostics</h2>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-[11px] text-cream transition-colors hover:border-honeydim"
        >
          <ClipboardCopy size={13} /> {copied ? "copied" : "copy log"}
        </button>
      </div>

      <p className="mb-3 text-muted">
        target <span className="text-cream">{target || "(none)"}</span> · heard{" "}
        <span className="text-cream">{heard || "(nothing)"}</span>
      </p>

      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-cream">
        {log.length ? log.join("\n") : "(nothing yet — press the mic and spell a word)"}
      </pre>
    </div>
  );
}
