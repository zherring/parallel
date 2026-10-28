"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { csvFilename, filmsToCsv, type CsvFilm } from "@/lib/csv";
import type { ShareInput } from "@/lib/share";
import { ShareMenu } from "./share-menu";

interface ShareActionsProps {
  /** The films to export, in the order the table shows them right now. */
  films: readonly CsvFilm[];
  /** Names in lane order, used for the CSV file name. */
  names: string[];
  /** What the Share menu posts about: the people and their film count as the page shows it by default. */
  share: ShareInput;
  /** The section heading: it shares a row with the buttons (heading left, buttons right). */
  heading: ReactNode;
}

// Share (the green primary button) lives in share-menu.tsx; Export is the secondary one.
const secondaryClass =
  "inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-strong hover:border-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border";

/**
 * The header row of a films section: the heading on the left, Export and Share on the right,
 * with the CSV helper text and a status line (what Export and the Share menu report) underneath.
 */
export function ShareActions({ films, names, share, heading }: ShareActionsProps) {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const announce = (message: string) => {
    clearTimeout(timer.current);
    setStatus(message);
    timer.current = setTimeout(() => setStatus(""), 4000);
  };

  const exportCsv = () => {
    if (films.length === 0) return;
    const blob = new Blob([filmsToCsv(films)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFilename(names);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(`Downloaded ${link.download} with ${films.length} ${films.length === 1 ? "film" : "films"}.`);
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
            disabled={films.length === 0}
            aria-label="Export CSV for Letterboxd"
            title="Export a CSV for Letterboxd"
          >
            Export
          </button>
          <ShareMenu input={share} onStatus={announce} className="max-sm:grow" />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="max-w-2xl flex-1 basis-64 text-sm text-muted">
          Export downloads a CSV of the films below, ready to import into Letterboxd as a list or into your watched
          films.{" "}
          <a
            href="https://letterboxd.com/about/importing-data/"
            className="text-accent-blue underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            How Letterboxd imports work
          </a>
          .
        </p>
        <p role="status" aria-live="polite" className="min-h-5 max-w-full text-sm text-body">
          {status}
        </p>
      </div>
    </div>
  );
}
