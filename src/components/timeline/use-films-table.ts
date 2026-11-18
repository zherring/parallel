"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_SORT,
  DIR_PARAM,
  SORT_PARAM,
  isMetricSortKey,
  nextSort,
  parseSort,
  sortAnnouncement,
  sortFilms,
  sortParams,
  type SortKey,
  type SortState,
} from "@/lib/films-table";
import type { TableRow } from "@/lib/film-rows";
import { VIEW_PARAM } from "@/lib/films-view";
import { notifyLocationChange } from "@/lib/use-live-search";
import { useFilmMetricsBatch, type FilmMetricsBatch } from "./use-film-metrics-batch";
import { useNearViewport } from "./use-near-viewport";

export interface FilmsTableModel {
  /** The films in the order of `sort`: what the table shows and what the CSV export writes. */
  rows: TableRow[];
  sort: SortState;
  /** A click on a column header: the column's first direction, or the other one for the sorted column. */
  sortBy: (key: SortKey) => void;
  /** Sets a whole sort (the small-screen select and direction button). */
  setSort: (sort: SortState) => void;
  /** Rating, box office and awards of the films, loaded lazily with one request. */
  metrics: FilmMetricsBatch;
  /** The metric columns have nothing to sort by (the request failed). */
  metricsUnavailable: boolean;
  /** "yyyy-mm-dd" of today, the page's date, which decides whether a film is out yet. */
  today: string;
  /** What the live region says about the last sort the visitor chose; empty until they choose one. */
  announcement: string;
  /** Attach to the element whose arrival near the screen starts loading the metrics. */
  anchorRef: (node: Element | null) => void;
}

const noSubscription = () => () => {};
const clientSearch = () => window.location.search;
const serverSearch = () => "";

/** Puts the sort in the address bar (nothing for the default order) without a navigation or a re-render of the route. */
function writeSortToUrl(sort: SortState) {
  const url = new URL(window.location.href);
  const params = sortParams(sort);
  if (params) {
    url.searchParams.set(SORT_PARAM, params.sort);
    url.searchParams.set(DIR_PARAM, params.dir);
    // A sort belongs to the Table. Saying so keeps a legacy sorted link (no `view`) on the Table
    // when the visitor changes the sort, instead of flipping it to the Timeline under the cursor.
    url.searchParams.set(VIEW_PARAM, "table");
  } else {
    const wasTable =
      url.searchParams.get(VIEW_PARAM) === "table" ||
      url.searchParams.has(SORT_PARAM) ||
      url.searchParams.has(DIR_PARAM);
    url.searchParams.delete(SORT_PARAM);
    url.searchParams.delete(DIR_PARAM);
    if (wasTable) url.searchParams.set(VIEW_PARAM, "table");
  }
  window.history.replaceState(null, "", url);
  notifyLocationChange();
}

/**
 * State of the sortable films table (the films together, or one person's films): the chosen
 * sort (starting from `?sort=&dir=` in the address bar when there is one, and written back to
 * it), the lazily loaded metrics and the films in sorted order. The server renders the default
 * order without any of this; the address bar is read only once the page has hydrated, so a link
 * with a sort in it never changes what the server sends. `films` must keep its identity while
 * the list does not change (memoise it), or the metrics and the order are recomputed each time.
 */
export function useFilmsTable(films: TableRow[], today: string): FilmsTableModel {
  const search = useSyncExternalStore(noSubscription, clientSearch, serverSearch);
  const fromUrl = useMemo(() => {
    const params = new URLSearchParams(search);
    return parseSort(params.get(SORT_PARAM), params.get(DIR_PARAM));
  }, [search]);

  const [chosen, setChosen] = useState<SortState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [asked, setAsked] = useState(false);
  const [anchorRef, near] = useNearViewport();

  const sort = chosen ?? fromUrl ?? DEFAULT_SORT;
  const ids = useMemo(() => films.map((film) => film.id), [films]);
  const metrics = useFilmMetricsBatch(ids, near || asked || isMetricSortKey(sort.key));
  const metricsUnavailable = metrics.status === "failed";

  useEffect(() => {
    if (!metricsUnavailable || !isMetricSortKey(sort.key)) return;
    writeSortToUrl(DEFAULT_SORT);
    const frame = requestAnimationFrame(() => {
      setChosen(DEFAULT_SORT);
      setAnnouncement("Ratings, box office and awards could not be loaded. Sorted by year instead.");
    });
    return () => cancelAnimationFrame(frame);
  }, [metricsUnavailable, sort.key]);

  const rows = useMemo(() => sortFilms(films, sort, metrics.metrics, today), [films, sort, metrics.metrics, today]);

  const setSort = useCallback(
    (next: SortState) => {
      if (isMetricSortKey(next.key)) {
        if (metricsUnavailable) return;
        // The click is itself a reason to load the metrics, if the table had not come near the screen yet.
        setAsked(true);
      }
      setChosen(next);
      setAnnouncement(sortAnnouncement(next));
      writeSortToUrl(next);
    },
    [metricsUnavailable],
  );

  const sortBy = useCallback((key: SortKey) => setSort(nextSort(sort, key)), [setSort, sort]);

  return { rows, sort, sortBy, setSort, metrics, metricsUnavailable, today, announcement, anchorRef };
}
