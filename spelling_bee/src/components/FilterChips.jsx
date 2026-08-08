const FILTERS = [
  { key: "all", label: "All" },
  { key: "hard", label: "Hard" },
  { key: "new", label: "Untested" },
  { key: "mastered", label: "Mastered" },
];

export default function FilterChips({ active, counts, onChange }) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {FILTERS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-full border px-3 py-1.5 font-mono text-[11.5px] transition-colors ${
              isActive
                ? "border-honey bg-raised text-honey"
                : "border-line bg-surface text-muted hover:border-honeydim"
            }`}
          >
            {label} ({counts[key] ?? 0})
          </button>
        );
      })}
    </div>
  );
}
