"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { csvFilename, filmsToCsv } from "@/lib/csv";
import type { TableRow } from "@/lib/film-rows";
import { loadFilmMetricsBatch } from "@/lib/film-metrics-store";
import type { ShareInput } from "@/lib/share";
import type { FilmMetrics } from "@/lib/types";
import { ShareMenu } from "./share-menu";

interface ShareActionsProps {
  /** The films to export, in the order the table shows them right now. */
  films: readonly TableRow[];
  /** "yyyy-mm-dd", the page's date: the CSV hides a box office the same way the table does. */
  today: string;
  /** Names in lane order, used for the CSV file name. */
  names: string[];
  /** What the Share menu posts about: the people and their film count as the page shows it by default. */
  share: ShareInput;
  /** The section heading: it shares a row with the buttons (heading left, buttons right). */
  heading: ReactNode;
}

// Share (the white primary button) lives in share-menu.tsx; Export is the secondary one.
const secondaryClass =
  "inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-strong hover:border-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border";

/**
 * The header row of a films section: the heading on the left, Export and Share on the right,
 * with the CSV helper text and a status line (what Export and the Share menu report) underneath.
 */
export function ShareActions({ films, today, names, share, heading }: ShareActionsProps) {
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<AbortController | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      pending.current?.abort();
    },
    [],
  );

  const announce = (message: string) => {
    clearTimeout(timer.current);
    setStatus(message);
    timer.current = setTimeout(() => setStatus(""), 4000);
  };

  /**
   * Writes the table as a CSV file. Ratings, box office and awards are in it: they are the
   * table's own metrics (already loaded when the table has been on screen, otherwise fetched now
   * with one batch request). If they cannot be loaded the file still downloads, without them.
   */
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
    link.download = csvFilename(names);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const withoutMetrics = !metrics || [...metrics.values()].every((entry) => entry === null);
    announce(
      `Downloaded ${link.download} with ${films.length} ${films.length === 1 ? "film" : "films"}` +
        (withoutMetrics ? ", without ratings, box office and awards (they could not be loaded)." : "."),
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {heading}
        <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
          <button
            type="button"
            className={`${secondaryClass} max-sm:grow`}
            onClick={exportCsv}
            disabled={films.length === 0 || exporting}
            aria-busy={exporting || undefined}
            aria-label="Export List as CSV"
            title="Export List as CSV"
          >
            Export
          </button>
          <ShareMenu input={share} onStatus={announce} className="max-sm:grow" />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p role="status" aria-live="polite" className="min-h-5 max-w-full text-sm text-body">
          {status}
        </p>
      </div>
    </div>
  );
}
