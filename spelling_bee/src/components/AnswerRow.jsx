import { Mic, Square } from "lucide-react";

export default function AnswerRow({
  value,
  onChange,
  onSubmit,
  onToggleMic,
  listening,
  micSupported,
  micHint,
  disabled,
}) {
  return (
    <div className="mt-5 flex gap-2.5">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Type the spelling"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-3.5 py-3 font-mono text-base tracking-wide text-cream outline-none placeholder:text-muted focus:border-honey disabled:opacity-40"
      />

      <button
        type="button"
        onClick={onToggleMic}
        disabled={disabled || !micSupported}
        aria-label={listening ? "Stop and check" : "Spell out loud"}
        title={micSupported ? undefined : micHint}
        className={`inline-flex min-w-12 items-center justify-center rounded-lg border px-3.5 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
          listening
            ? "animate-pulse border-miss bg-missdim text-miss"
            : "border-line bg-raised text-cream hover:border-honeydim"
        }`}
      >
        {listening ? <Square size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
      </button>

      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="rounded-lg border border-honey bg-honey px-4 py-2.5 text-sm font-semibold text-[#241a08] transition-colors hover:bg-[#f0b64f] disabled:opacity-40"
      >
        Check
      </button>
    </div>
  );
}
