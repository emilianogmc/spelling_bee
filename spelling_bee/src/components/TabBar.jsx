import { Hexagon, ListChecks, Mic } from "lucide-react";

export const TABS = [
  { id: "practice", label: "Practice", Icon: Mic },
  { id: "progress", label: "Progress", Icon: Hexagon },
  { id: "words", label: "Words", Icon: ListChecks },
];

/**
 * Fixed to the bottom, under the drill's own bar, and always ink: the field
 * above it changes colour with every state, and the frame around it doesn't.
 */
export default function TabBar({ active, onChange }) {
  return (
    <nav aria-label="Sections" className="pl-tabs">
      <ul>
        {TABS.map(({ id, label, Icon }) => {
          const current = id === active;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={current ? "page" : undefined}
                className={current ? "is-current" : undefined}
              >
                <Icon size={20} strokeWidth={current ? 2.5 : 2} aria-hidden="true" />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
