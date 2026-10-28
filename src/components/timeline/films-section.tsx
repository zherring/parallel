"use client";

import type { ReactNode } from "react";
import type { TableRow } from "@/lib/film-rows";
import type { ShareInput } from "@/lib/share";
import { FilmsTable } from "./films-table";
import { ShareActions } from "./share-actions";
import { useFilmsTable } from "./use-films-table";

interface FilmsSectionProps {
  /** The id of the heading, which names the section for assistive technology. */
  headingId: string;
  /** The heading: "3 films together", "1 film", "No films". */
  title: string;
  rows: TableRow[];
  /** Names in lane order, for the CSV file name. */
  names: string[];
  /** What the table is, for screen readers: "Films Harrison Ford made". */
  caption: string;
  /** What the Share menu posts about. */
  share: ShareInput;
  /** yyyy-mm-dd, the page's date (computed once on the server). */
  today: string;
  /** What to say instead of a table when there are no films. */
  empty: ReactNode;
  onSelect: (id: number, trigger: HTMLElement) => void;
  /** More content under the table (the "By pair" lists). */
  children?: ReactNode;
}

/**
 * A films section of the page, the same for one person or several: the heading with Export and
 * Share on its row, the CSV helper text, and the sortable table of `rows`.
 */
export function FilmsSection({
  headingId,
  title,
  rows,
  names,
  caption,
  share,
  today,
  empty,
  onSelect,
  children,
}: FilmsSectionProps) {
  const table = useFilmsTable(rows, today);

  return (
    <section aria-labelledby={headingId} className="mt-10">
      <ShareActions
        // The export follows the table: the films in the order they are sorted in right now.
        films={table.rows}
        today={today}
        names={names}
        share={share}
        heading={
          <h2 id={headingId} className="text-xl font-semibold text-strong">
            {title}
          </h2>
        }
      />

      {rows.length === 0 ? (
        <p className="mt-4 max-w-xl text-body">{empty}</p>
      ) : (
        <FilmsTable caption={caption} table={table} onSelect={onSelect} />
      )}

      {children}
    </section>
  );
}
