import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";

export default function WordListEditor({ words, onSave, onReset }) {
  const [draft, setDraft] = useState(words.join("\n"));

  useEffect(() => {
    setDraft(words.join("\n"));
  }, [words]);

  const handleSave = () => {
    const list = draft
      .split("\n")
      .map((word) => word.trim())
      .filter(Boolean);
    if (list.length) onSave(list);
  };

  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-5">
      <h2 className="mb-3.5 font-display text-base font-semibold">Word list</h2>

      <textarea
        value={draft}
        spellCheck="false"
        onChange={(event) => setDraft(event.target.value)}
        className="min-h-[120px] w-full resize-y rounded-lg border border-line bg-ink p-3 font-mono text-[12.5px] leading-relaxed text-cream outline-none focus:border-honey"
      />

      <div className="mt-3 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-lg border border-honey bg-honey px-4 py-2.5 text-sm font-semibold text-[#241a08] transition-colors hover:bg-[#f0b64f]"
        >
          <Save size={16} /> Save list
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-4 py-2.5 text-sm text-cream transition-colors hover:border-honeydim"
        >
          <RotateCcw size={16} /> Reset progress
        </button>
      </div>
    </div>
  );
}
