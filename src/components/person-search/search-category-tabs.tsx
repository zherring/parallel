import { useRef } from "react";
import { SEARCH_CATEGORIES, type SearchCategory } from "@/lib/search-sections";

const LABELS: Record<SearchCategory, string> = { all: "All", artists: "Artists", pairings: "Pairings" };

interface Props {
  value: SearchCategory;
  baseId: string;
  onChange: (category: SearchCategory) => void;
  onResults: () => void;
  onDismiss: () => void;
}

/** Every category is a Tab stop and activates on focus; Left/Right also change category. */
export function SearchCategoryTabs({ value, baseId, onChange, onResults, onDismiss }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label="Search categories" className="sticky top-0 z-10 flex gap-1 border-b border-border bg-surface px-2">
      {SEARCH_CATEGORIES.map((category, index) => (
        <button
          key={category}
          ref={(button) => { refs.current[index] = button; }}
          type="button"
          id={`${baseId}-tab-${category}`}
          role="tab"
          aria-selected={value === category}
          aria-controls={`${baseId}-results`}
          tabIndex={0}
          onFocus={() => onChange(category)}
          onClick={() => onChange(category)}
          onKeyDown={(event) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            let next: number;
            switch (event.key) {
              case "ArrowRight": next = (index + 1) % SEARCH_CATEGORIES.length; break;
              case "ArrowLeft": next = (index + SEARCH_CATEGORIES.length - 1) % SEARCH_CATEGORIES.length; break;
              case "Home": next = 0; break;
              case "End": next = SEARCH_CATEGORIES.length - 1; break;
              case "ArrowDown": event.preventDefault(); onResults(); return;
              case "Escape": event.preventDefault(); onDismiss(); return;
              default: return;
            }
            event.preventDefault();
            refs.current[next]?.focus();
          }}
          className={`min-h-10 cursor-pointer border-b-2 px-3 text-sm font-medium outline-offset-[-3px] pointer-coarse:min-h-11 ${value === category ? "border-focus text-strong" : "border-transparent text-muted hover:text-strong"}`}
        >
          {LABELS[category]}
        </button>
      ))}
    </div>
  );
}
