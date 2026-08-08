export default function StatRow({ counts }) {
  const stats = [
    { label: "Total", value: counts.all, tone: "text-honey" },
    { label: "Mastered", value: counts.mastered, tone: "text-ok" },
    { label: "Hard", value: counts.hard, tone: "text-miss" },
  ];

  return (
    <div className="mt-6 flex gap-3">
      {stats.map(({ label, value, tone }) => (
        <div
          key={label}
          className="flex-1 rounded-lg border border-line bg-ink px-2 py-2.5 text-center"
        >
          <div className={`font-mono text-xl font-medium ${tone}`}>{value}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}
