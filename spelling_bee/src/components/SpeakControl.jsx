import { Volume2 } from "lucide-react";

export default function SpeakControl({ onSpeak, speaking, rate, onRateChange, disabled }) {
  return (
    <div className="pt-3 pb-1 text-center">
      <button
        type="button"
        onClick={onSpeak}
        disabled={disabled}
        aria-label="Hear the word"
        className={`inline-flex h-24 w-24 items-center justify-center rounded-full border-2 transition-transform disabled:opacity-40 ${
          speaking
            ? "border-honey bg-[#3a2f1c] text-honey"
            : "border-honeydim bg-raised text-honey hover:scale-105 hover:border-honey"
        }`}
      >
        <Volume2 size={34} strokeWidth={1.75} />
      </button>

      <div className="mt-4 flex items-center justify-center gap-3">
        <label htmlFor="rate" className="text-xs text-muted">
          Slow
        </label>
        <input
          id="rate"
          type="range"
          min="0.4"
          max="1"
          step="0.05"
          value={rate}
          onChange={(event) => onRateChange(Number(event.target.value))}
          className="w-36"
        />
        <label htmlFor="rate" className="text-xs text-muted">
          Normal
        </label>
      </div>
    </div>
  );
}
