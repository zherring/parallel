"use client";

import { slotColor, type LegendEntry } from "@/lib/connections";
import { cn } from "./cn";

interface ConnectionLegendProps {
  entries: LegendEntry[];
  /** Family name of each lane's person, by lane index. */
  names: string[];
  laneCount: number;
  /** Key of the kind of connection the lines emphasise right now (previewed or pinned), if any. */
  activeKey: string | null;
  pinnedKey: string | null;
  onPreview: (key: string | null) => void;
  onTogglePin: (key: string) => void;
}

const NUMBER_WORDS = ["", "one", "two", "three", "four", "five"];

/** What a chip says when it is not a pair: "All three", or "Three of four" for the subsets of three lanes. */
function wordsOf(entry: LegendEntry, laneCount: number): string {
  const total = NUMBER_WORDS[laneCount] ?? String(laneCount);
  return entry.slot === null ? `All ${total}` : `Three of ${total}`;
}

/**
 * The key to the colours of the lines when three or more people are on screen: green for the
 * films everyone shares, one colour per pair for the rest. Each chip names its pair in text, so
 * the colour is never the only way to tell. Hovering or focusing a chip lights that kind of
 * connection and dims the others; pressing it keeps the highlight (for touch and keyboard).
 */
export function ConnectionLegend({ entries, names, laneCount, activeKey, pinnedKey, onPreview, onTogglePin }: ConnectionLegendProps) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2">
      <p id="connection-legend" className="text-xs font-medium uppercase tracking-wide text-muted">
        Connections
      </p>
      <ul aria-labelledby="connection-legend" className="m-0 flex list-none flex-wrap gap-2 p-0">
        {entries.map((entry) => {
          const pinned = pinnedKey === entry.key;
          const active = activeKey === entry.key;
          return (
            <li key={entry.key}>
              <button
                type="button"
                aria-pressed={pinned}
                onClick={() => onTogglePin(entry.key)}
                onPointerEnter={(event) => event.pointerType !== "touch" && onPreview(entry.key)}
                onPointerLeave={() => onPreview(null)}
                onFocus={() => onPreview(entry.key)}
                onBlur={() => onPreview(null)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-xs leading-none text-body hover:text-strong",
                  active || pinned ? "border-strong/60 text-strong" : "border-border hover:border-muted",
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: entry.slot === null ? "var(--lit)" : slotColor(entry.slot),
                    boxShadow: entry.slot === null ? "0 0 6px var(--lit-glow)" : undefined,
                  }}
                />
                <span className="text-strong">
                  {entry.lanes ? <PairLabel names={names} lanes={entry.lanes} /> : wordsOf(entry, laneCount)}
                </span>
                <span className="tabular-nums text-muted">
                  <span className="sr-only">, </span>
                  {entry.count}
                  <span className="sr-only"> {entry.count === 1 ? "film" : "films"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** "Fincher × Cronenweth" to the eye, "Fincher and Cronenweth" to a screen reader. */
function PairLabel({ names, lanes }: { names: string[]; lanes: [number, number] }) {
  return (
    <>
      {names[lanes[0]]}
      <span aria-hidden> &times; </span>
      <span className="sr-only"> and </span>
      {names[lanes[1]]}
    </>
  );
}
