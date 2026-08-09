import { useEffect, useState } from "react";

/**
 * Speech synthesis fails silently in most of the ways that matter, so this
 * panel exists to make a failure legible from a screenshot. Off unless the
 * URL carries ?debug=tts.
 */
export default function TtsDebug({ snapshot, log, error }) {
  const [state, setState] = useState(() => snapshot());

  useEffect(() => {
    const id = setInterval(() => setState(snapshot()), 400);
    return () => clearInterval(id);
  }, [snapshot]);

  const rows = [
    ["supported", String(state.supported)],
    ["user activation", String(state.activated)],
    ["voices loaded", String(state.voices)],
    ["chosen voice", state.voice],
    ["speaking", String(state.speaking)],
    ["pending", String(state.pending)],
    ["paused", String(state.paused)],
    ["last error", error ?? "none"],
  ];

  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-5 font-mono text-[11px]">
      <h2 className="mb-3 font-display text-sm font-semibold text-ember">
        TTS diagnostics
      </h2>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="break-all text-chalk">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 mb-1 text-muted">event log</p>
      <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-all text-chalk">
        {log.length ? log.join("\n") : "(nothing yet — press the speaker)"}
      </pre>
    </div>
  );
}
