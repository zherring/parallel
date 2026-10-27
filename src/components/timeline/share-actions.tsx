"use client";

import { useEffect, useRef, useState } from "react";
import { csvFilename, sharedFilmsToCsv } from "@/lib/csv";
import type { SharedFilm } from "@/lib/types";

interface ShareActionsProps {
  /** Films to export; the export button only shows when `canExport`. */
  shared: SharedFilm[];
  /** Names in lane order, used for the CSV file name. */
  names: string[];
  canExport: boolean;
}

const primaryClass =
  "inline-flex items-center justify-center rounded-md bg-accent-green px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-green-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent-green";
const secondaryClass =
  "inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-strong hover:border-muted";

export function ShareActions({ shared, names, canExport }: ShareActionsProps) {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const announce = (message: string) => {
    clearTimeout(timer.current);
    setStatus(message);
    timer.current = setTimeout(() => setStatus(""), 4000);
  };

  const exportCsv = () => {
    if (shared.length === 0) return;
    const blob = new Blob([sharedFilmsToCsv(shared)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFilename(names);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(`Downloaded ${link.download} with ${shared.length} ${shared.length === 1 ? "film" : "films"}.`);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      announce("Link copied to clipboard.");
    } catch {
      announce("Could not copy automatically. Copy the address from your browser's address bar.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {canExport && (
          <button type="button" className={primaryClass} onClick={exportCsv} disabled={shared.length === 0}>
            Export to Letterboxd (CSV)
          </button>
        )}
        <button type="button" className={secondaryClass} onClick={copyLink}>
          Copy link
        </button>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-body">
          {status}
        </p>
      </div>
      {canExport && (
        <p className="text-sm text-muted">
          Downloads a CSV of the films above, ready to import into Letterboxd as a list or into your watched films.{" "}
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
      )}
    </div>
  );
}
