"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { csvFilename, filmsToCsv } from "@/lib/csv";
import type { TableRow } from "@/lib/film-rows";
import { loadFilmMetricsBatch } from "@/lib/film-metrics-store";
import type { FilmMetrics } from "@/lib/types";

/** The films a page lists, for the CSV: in the order the table shows them, with what the file is named for. */
export interface ExportList {
  /** The films to export, in the order the table shows them right now. */
  films: readonly TableRow[];
  /** "yyyy-mm-dd", the page's date: the CSV hides a box office the same way the table does. */
  today: string;
  /** Names in lane order, used for the CSV file name. */
  names: readonly string[];
}

interface ExportButtonProps extends ExportList {
  /** Reports what the export did ("Downloaded ... with 24 films."), for the page to say politely. */
  onStatus: (message: string) => void;
  className?: string;
}

// Share (the green primary button, in share-menu.tsx) is the primary one of the pair; Export is the secondary one.
const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-strong hover:border-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border";

/**
 * Export, which writes the list the page shows as a CSV file: in the page bar's settings, beside Share, on every view that lists films (it is the
 * table's films, so not on the Clippings). What it reports goes to `onStatus`, the settings' live region.
 *
 * Ratings, box office and awards are in the file: they are the table's own metrics (already loaded when the table has been on screen, otherwise
 * fetched now with one batch request). If they cannot be loaded the file still downloads, without them.
 */
export function ExportButton({ films, today, names, onStatus, className }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const pending = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => pending.current?.abort(), []);

  const exportCsv = async () => {
    if (films.length === 0 || exporting) return;
    setExporting(true);
    const controller = new AbortController();
    pending.current = controller;

    let metrics: Map<number, FilmMetrics | null> | undefined;
    try {
      const lookups = await loadFilmMetricsBatch(
        films.map((film) => film.id),
        controller.signal,
      );
      metrics = new Map([...lookups].map(([id, lookup]) => [id, lookup.status === "ready" ? lookup.metrics : null]));
    } catch {
      if (controller.signal.aborted) return; // the page went away
    }
    setExporting(false);

    const blob = new Blob([filmsToCsv(films, { metrics, today })], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFilename([...names]);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const withoutMetrics = !metrics || [...metrics.values()].every((entry) => entry === null);
    onStatus(
      `Downloaded ${link.download} with ${films.length} ${films.length === 1 ? "film" : "films"}` +
        (withoutMetrics ? ", without ratings, box office and awards (they could not be loaded)." : "."),
    );
  };

  return (
    <button
      type="button"
      className={`${secondaryClass} ${className ?? ""}`}
      onClick={exportCsv}
      disabled={films.length === 0 || exporting}
      aria-busy={exporting || undefined}
      aria-label="Export List as CSV"
      title="Export List as CSV"
    >
      {exporting ? (
        <LoaderCircle aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
      ) : (
        <Download aria-hidden="true" className="size-4 shrink-0" />
      )}
      Export
    </button>
  );
}
