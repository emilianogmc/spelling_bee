import { Hexagon, ListChecks, Mic } from "lucide-react";

export const TABS = [
  { id: "practice", label: "Practice", Icon: Mic },
  { id: "progress", label: "Progress", Icon: Hexagon },
  { id: "words", label: "Words", Icon: ListChecks },
];

/**
 * Fixed to the bottom because every control used during a drill has to sit in
 * thumb reach on a phone held in one hand.
 */
export default function TabBar({ active, onChange }) {
  return (
    <nav
      aria-label="Sections"
      style={{ zIndex: "var(--z-nav)" }}
      className="fixed inset-x-0 bottom-0 border-t border-line/50 bg-surface/95 backdrop-blur-sm"
    >
      <ul className="mx-auto flex max-w-[560px]">
        {TABS.map(({ id, label, Icon }) => {
          const current = id === active;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-1 pt-2 text-[11px] font-medium transition-colors ${
                  current ? "text-ember" : "text-muted hover:text-chalk"
                }`}
                style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
              >
                <Icon size={21} strokeWidth={current ? 2.4 : 1.9} aria-hidden="true" />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
