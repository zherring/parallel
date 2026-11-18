"use client";

import { Pin } from "lucide-react";
import { usePersonPalette } from "@/components/person-palette";
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
  onTogglePin: (key: string, label: string) => void;
}

const NUMBER_WORDS = ["", "one", "two", "three", "four", "five"];

/** What a chip says when it is not a pair: "All three", or "Three of four" for the subsets of three lanes. */
function wordsOf(entry: LegendEntry, laneCount: number): string {
  const total = NUMBER_WORDS[laneCount] ?? String(laneCount);
  return entry.slot === null ? `All ${total}` : `Three of ${total}`;
}

/** What a chip is called in the live region when it is pinned: "Fincher and Pitt, 3 films". */
function spokenOf(entry: LegendEntry, names: string[], laneCount: number): string {
  const count = `${entry.count} ${entry.count === 1 ? "film" : "films"}`;
  if (entry.lanes) return pairChipName(names, entry.lanes, entry.count);
  if (entry.groups?.length) {
    const groups = entry.groups.map((lanes) => lanes.map((lane) => names[lane]).join(", ")).join("; ");
    return `Three of ${NUMBER_WORDS[laneCount] ?? laneCount} (${groups}), ${count}`;
  }
  return `${wordsOf(entry, laneCount)}, ${count}`;
}

/**
 * The key to the colours of the lines when three or more people are on screen: green for the
 * films everyone shares, one colour per pair for the rest. Each chip names its pair in text, so
 * the colour is never the only way to tell. Hovering or focusing a chip previews that kind of
 * connection with a border; pressing it keeps the highlight with a tinted fill and a pin, so a
 * pinned chip never looks like one that is merely under the pointer.
 */
export function ConnectionLegend({ entries, names, laneCount, activeKey, pinnedKey, onPreview, onTogglePin }: ConnectionLegendProps) {
  // On a pair's page (its palette) the films everyone shares are white, with no glow, where the app's are green.
  const palette = usePersonPalette() !== null;
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
          const label = spokenOf(entry, names, laneCount);
          return (
            <li key={entry.key}>
              <button
                type="button"
                aria-pressed={pinned}
                aria-label={label}
                title={pinned ? `${label}. Pinned; press to unpin.` : `${label}. Press to pin.`}
                onClick={() => onTogglePin(entry.key, label)}
                onPointerEnter={(event) => event.pointerType !== "touch" && onPreview(entry.key)}
                onPointerLeave={() => onPreview(null)}
                onFocus={() => onPreview(entry.key)}
                onBlur={() => onPreview(null)}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-xs leading-none hover:text-strong",
                  pinned
                    ? "border-strong bg-strong/15 text-strong"
                    : active
                      ? "border-strong/70 bg-surface text-strong"
                      : "border-border bg-surface text-body hover:border-muted",
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: entry.slot === null ? (palette ? "#fff" : "var(--lit)") : slotColor(entry.slot),
                    boxShadow: entry.slot === null && !palette ? "0 0 6px var(--lit-glow)" : undefined,
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
                {pinned && <Pin aria-hidden className="size-3 shrink-0 text-strong" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * What a pair chip is called by assistive tech: "Fincher and Cronenweth, 3 films". Set as the button's
 * aria-label so the name is the same for every reader and never carries the "×" along with the word "and".
 */
export function pairChipName(names: string[], lanes: [number, number], count: number): string {
  return `${names[lanes[0]]} and ${names[lanes[1]]}, ${count} ${count === 1 ? "film" : "films"}`;
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
