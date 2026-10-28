"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { csvFilename, sharedFilmsToCsv } from "@/lib/csv";
import type { ShareInput } from "@/lib/share";
import type { SharedFilm } from "@/lib/types";
import { ShareMenu } from "./share-menu";

interface ShareActionsProps {
  /** Films to export; the export button only shows when `canExport`. */
  shared: SharedFilm[];
  /** Names in lane order, used for the CSV file name. */
  names: string[];
  canExport: boolean;
  /** What the Share menu posts about: the people and their film count as the page shows it by default. */
  share: ShareInput;
  /**
   * When set (the "films together" section), the buttons share a row with it: heading on the
   * left, buttons on the right, with the helper text and status line underneath. Without it
   * the buttons, status and helper text stack as a block (single-person pages).
   */
  heading?: ReactNode;
}

// Share (the green primary button) lives in share-menu.tsx; Export and Copy link are the secondary ones.
const secondaryClass =
  "inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-strong hover:border-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border";

export function ShareActions({ shared, names, canExport, share, heading }: ShareActionsProps) {
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

  const shareMenu = <ShareMenu input={share} onStatus={announce} className={heading ? "max-sm:grow" : ""} />;
  const exportButton = canExport && (
    <button
      type="button"
      className={`${secondaryClass} ${heading ? "max-sm:grow" : ""}`}
      onClick={exportCsv}
      disabled={shared.length === 0}
    >
      Export to Letterboxd (CSV)
    </button>
  );
  const copyButton = (
    <button type="button" className={`${secondaryClass} ${heading ? "max-sm:grow" : ""}`} onClick={copyLink}>
      Copy link
    </button>
  );
  const helper = canExport && (
    <p className={`max-w-2xl text-sm text-muted ${heading ? "flex-1 basis-64" : ""}`}>
      Downloads a CSV of the films below, ready to import into Letterboxd as a list or into your watched films.{" "}
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
  );

  if (heading) {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          {heading}
          <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
            {exportButton}
            {shareMenu}
            {copyButton}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          {helper}
          <p role="status" aria-live="polite" className="min-h-5 max-w-full text-sm text-body">
            {status}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {exportButton}
        {shareMenu}
        {copyButton}
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-body">
          {status}
        </p>
      </div>
      {helper}
    </div>
  );
}
