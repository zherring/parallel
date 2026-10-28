"use client";

import { memo, useMemo } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { filmMetricsDisplay } from "@/lib/film-metrics";
import {
  SORT_KEYS,
  SORT_LABELS,
  ariaSort,
  defaultDirection,
  directionWords,
  flipDirection,
  isMetricSortKey,
  type SortKey,
  type SortState,
} from "@/lib/films-table";
import type { CreditLine, TableRow } from "@/lib/film-rows";
import { isReleased } from "@/lib/released";
import { cn } from "./cn";
import { AwardsCell, BoxOfficeCell, CellSkeleton, Dash, RatingCell } from "./film-metric-cells";
import { FilmMetricsRows } from "./film-metrics-rows";
import { FilmThumb } from "./film-thumb";
import { detailsButtonClass, linkClass, tmdbMovieUrl } from "./film-links";
import type { FilmsTableModel } from "./use-films-table";
import type { FilmMetricsState } from "./use-film-metrics";

interface FilmsTableProps {
  /** The table's description for screen readers, e.g. "Films Harrison Ford made". */
  caption: string;
  table: FilmsTableModel;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

interface RowProps {
  film: TableRow;
  state: FilmMetricsState;
  today: string;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

const UNAVAILABLE_HINT = "Not available right now";

/** One line per person: "Name: Director, Writer", or just the roles when the list is one person's own. */
function Credits({ credits }: { credits: CreditLine[] }) {
  return (
    <ul className="space-y-0.5 text-sm text-muted">
      {credits.map((line) => (
        <li key={line.personId}>
          {line.name !== null && (
            <>
              <span className="text-body">{line.name}</span>:{" "}
            </>
          )}
          {line.roles}
        </li>
      ))}
    </ul>
  );
}

/** Marks a film that is not out yet (a filmography lists them; the films-together list never does). */
function UpcomingTag() {
  return (
    <span className="ml-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-accent-orange">
      Upcoming
    </span>
  );
}

/** A table row: poster, title and details button, year, credits and the three metrics. */
const FilmRow = memo(function FilmRow({ film, state, today, onSelect }: RowProps) {
  const display = useMemo(
    () => (state.status === "ready" ? filmMetricsDisplay(state.metrics, today) : null),
    [state, today],
  );
  const pending = state.status === "pending";
  const upcoming = !isReleased(film.releaseDate, today);
  const openDetails = (event: React.MouseEvent<HTMLButtonElement>) => onSelect(film.id, event.currentTarget);

  return (
    <tr className="motion-safe:transition-colors hover:bg-border/40">
      <th scope="row" className="px-2 py-2 lg:px-3 text-left align-middle font-normal">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`Open details for ${film.title} (${film.year})`}
            onClick={openDetails}
            className="shrink-0 cursor-pointer rounded-[4px]"
          >
            <FilmThumb film={film} width={40} height={60} />
          </button>
          <div className="min-w-0">
            <a href={tmdbMovieUrl(film.id)} className={linkClass}>
              {film.title}
            </a>
            {upcoming && <UpcomingTag />}
            {/* Below lg there is no room for a Credits column: the credits sit under the title instead. */}
            <div className="mt-0.5 lg:hidden">
              <Credits credits={film.credits} />
            </div>
            <div>
              <button
                type="button"
                className={`${detailsButtonClass} cursor-pointer whitespace-nowrap`}
                onClick={openDetails}
              >
                View details
              </button>
            </div>
          </div>
        </div>
      </th>
      <td className="px-2 py-2 lg:px-3 align-middle tabular-nums text-muted">
        <time dateTime={film.releaseDate}>{film.year}</time>
      </td>
      <td className="hidden px-2 py-2 lg:px-3 align-middle lg:table-cell">
        <Credits credits={film.credits} />
      </td>
      <td className="px-2 py-2 lg:px-3 align-middle">
        {pending ? (
          <CellSkeleton widths={["w-24", "w-14"]} />
        ) : display?.rating ? (
          <RatingCell rating={display.rating} />
        ) : (
          <Dash />
        )}
      </td>
      <td className="px-2 py-2 lg:px-3 align-middle">
        {pending ? (
          <CellSkeleton widths={["w-14", "w-16"]} />
        ) : display?.revenue ? (
          <BoxOfficeCell revenue={display.revenue} />
        ) : (
          <Dash />
        )}
      </td>
      <td className="px-2 py-2 lg:px-3 align-middle">
        {pending ? (
          <CellSkeleton widths={["w-20", "w-16"]} />
        ) : display?.awards ? (
          <AwardsCell awards={display.awards} />
        ) : (
          <Dash />
        )}
      </td>
    </tr>
  );
});

/** The small-screen layout of one film: a card with poster, title, credits and the metric lines. */
const FilmCard = memo(function FilmCard({ film, state, today, onSelect }: RowProps) {
  const upcoming = !isReleased(film.releaseDate, today);
  const openDetails = (event: React.MouseEvent<HTMLButtonElement>) => onSelect(film.id, event.currentTarget);

  return (
    <li className="flex gap-3 rounded-lg border border-border bg-surface p-3">
      <button
        type="button"
        aria-label={`Open details for ${film.title} (${film.year})`}
        onClick={openDetails}
        className="shrink-0 cursor-pointer self-start rounded-[4px]"
      >
        <FilmThumb film={film} width={48} height={72} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="break-words">
          <a href={tmdbMovieUrl(film.id)} className={linkClass}>
            {film.title}
          </a>{" "}
          <time dateTime={film.releaseDate} className="tabular-nums text-muted">
            {film.year}
          </time>
          {upcoming && <UpcomingTag />}
        </p>
        <div className="mt-1">
          <Credits credits={film.credits} />
        </div>
        <div className="mt-2 empty:hidden">
          <FilmMetricsRows state={state} today={today} />
        </div>
        <button type="button" className={`${detailsButtonClass} mt-1.5 cursor-pointer`} onClick={openDetails}>
          View details
        </button>
      </div>
    </li>
  );
});

/**
 * Preferred column widths (the table still gives way to the content). Below lg the Credits column is
 * left out (the credits move under the title), so the other five share its width.
 */
const COLUMN_WIDTH = {
  film: "min-w-40 lg:w-[26%]",
  year: "w-16 lg:w-[6%]",
  credits: "w-[20%]",
  rating: "min-w-[6.5rem] lg:w-[19%]",
  "box-office": "min-w-[5.5rem] lg:w-[12%]",
  awards: "min-w-[6.5rem] lg:w-[17%]",
} as const;

const HEADER_TEXT = "text-xs font-semibold uppercase tracking-wide";

interface SortHeaderProps {
  column: SortKey;
  sort: SortState;
  /** The metric columns have nothing to sort by. */
  unavailable: boolean;
  onSort: (key: SortKey) => void;
}

/** A column header that sorts: a real button in a `th` that carries aria-sort, with an arrow for the direction. */
function SortHeader({ column, sort, unavailable, onSort }: SortHeaderProps) {
  const active = sort.key === column;
  const blocked = unavailable && isMetricSortKey(column);
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <th scope="col" aria-sort={ariaSort(sort, column)} className={`px-2 py-2.5 lg:px-3 text-left ${COLUMN_WIDTH[column]}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-disabled={blocked || undefined}
        title={blocked ? UNAVAILABLE_HINT : undefined}
        className={cn(
          `group -mx-1 inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 ${HEADER_TEXT}`,
          active ? "text-strong" : "text-muted hover:text-strong",
          blocked && "cursor-not-allowed opacity-50 hover:text-muted",
        )}
      >
        {SORT_LABELS[column]}
        <Icon
          aria-hidden
          className={cn("size-3.5 shrink-0", !active && "opacity-60 group-hover:opacity-100")}
        />
      </button>
    </th>
  );
}

/** The small-screen replacement for the header buttons: a labelled select and a direction toggle. */
function SortControls({ table }: { table: FilmsTableModel }) {
  const { sort, setSort, metricsUnavailable } = table;
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  const words = directionWords(sort);

  return (
    <div className="flex items-end gap-2">
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-xs font-medium text-muted">Sort by</span>
        <select
          value={sort.key}
          onChange={(event) => {
            const key = SORT_KEYS.find((candidate) => candidate === event.target.value);
            if (key) setSort({ key, dir: defaultDirection(key) });
          }}
          className="w-full cursor-pointer rounded-md border border-border bg-surface px-3 py-2 text-sm text-strong hover:border-muted"
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key} disabled={metricsUnavailable && isMetricSortKey(key) && key !== sort.key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => setSort({ key: sort.key, dir: flipDirection(sort.dir) })}
        aria-label={`Order: ${words}. Activate to reverse.`}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-strong hover:border-muted"
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        <span aria-hidden className="first-letter:uppercase">
          {words}
        </span>
      </button>
    </div>
  );
}

/**
 * A list of films as a sortable table (a card list under 640px, with a select in place of the
 * header buttons): the films some people made together, or one person's films. The server renders
 * every film with its poster, title, year and credits; the three metric columns fill in on the
 * client once the table nears the screen.
 */
export function FilmsTable({ caption, table, onSelect }: FilmsTableProps) {
  const { rows, sort, sortBy, metrics, metricsUnavailable, today, announcement, anchorRef } = table;

  return (
    <div ref={anchorRef} className="mt-4">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface sm:block">
        <table aria-busy={metrics.status === "loading" || undefined} className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            {caption}, with credits, rating, box office and awards. The column headers are buttons that sort the table.
          </caption>
          <thead className="border-b border-border bg-canvas/40">
            <tr>
              <SortHeader column="film" sort={sort} unavailable={metricsUnavailable} onSort={sortBy} />
              <SortHeader column="year" sort={sort} unavailable={metricsUnavailable} onSort={sortBy} />
              <th
                scope="col"
                className={`hidden px-2 py-2.5 lg:px-3 text-left text-muted lg:table-cell ${HEADER_TEXT} ${COLUMN_WIDTH.credits}`}
              >
                Credits
              </th>
              <SortHeader column="rating" sort={sort} unavailable={metricsUnavailable} onSort={sortBy} />
              <SortHeader column="box-office" sort={sort} unavailable={metricsUnavailable} onSort={sortBy} />
              <SortHeader column="awards" sort={sort} unavailable={metricsUnavailable} onSort={sortBy} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((film) => (
              <FilmRow
                key={film.id}
                film={film}
                state={metrics.stateFor(film.id)}
                today={today}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden">
        <SortControls table={table} />
        <ol className="mt-3 grid gap-3">
          {rows.map((film) => (
            <FilmCard
              key={film.id}
              film={film}
              state={metrics.stateFor(film.id)}
              today={today}
              onSelect={onSelect}
            />
          ))}
        </ol>
      </div>

      <p className="mt-3 text-xs text-muted">
        Rating and box office from TMDB: the audience score, and the worldwide gross with how many times it covered the
        budget. Awards are Oscars and major festival prizes.
      </p>
    </div>
  );
}
