/**
 * A period is a stretch of years of a /p/ page's timeline, shared as `?from=1978&to=1993`: the
 * link opens on those years and its preview card shows only the films of them. Everything about
 * it that must not drift between the server (metadata, the preview route) and the browser (the
 * Share menu, the timeline) lives here, pure.
 *
 * Years are four-digit integers from MIN_YEAR to MAX_YEAR. Anything else in a parameter is
 * dropped, as if it were not there. Either end may be left out: that side is then open. Once
 * the page's films are known (`resolvePeriod`) the ends are clamped to the years the films
 * span, so a period has one canonical spelling and the preview cards have a small key space.
 */

export const FROM_PARAM = "from";
export const TO_PARAM = "to";

export const MIN_YEAR = 1880;
export const MAX_YEAR = 2100;

/** What a URL says: either end may be missing. */
export interface RawPeriod {
  from: number | null;
  to: number | null;
}

/** A period resolved against the films of a page: both ends are years the films span, and it is not all of them. */
export interface Period {
  from: number;
  to: number;
}

/** First and last year of a page's films. */
export interface YearSpan {
  first: number;
  last: number;
}

type ParamValue = string | string[] | undefined | null;

/** One parameter as a year; null unless it is exactly four digits within MIN_YEAR..MAX_YEAR. Repeated parameters use the first. */
export function parseYear(value: ParamValue): number | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (typeof text !== "string" || !/^\d{4}$/.test(text)) return null;
  const year = Number(text);
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : null;
}

/**
 * The period a query names: a `searchParams` object (the page), `URLSearchParams` or a query string
 * (the browser and the preview route). Ends given the wrong way round are swapped.
 */
export function parsePeriodParams(
  source: string | URLSearchParams | Record<string, ParamValue>,
): RawPeriod {
  let from: number | null;
  let to: number | null;
  if (typeof source === "string" || source instanceof URLSearchParams) {
    const params = typeof source === "string" ? new URLSearchParams(source) : source;
    from = parseYear(params.get(FROM_PARAM));
    to = parseYear(params.get(TO_PARAM));
  } else {
    from = parseYear(source[FROM_PARAM]);
    to = parseYear(source[TO_PARAM]);
  }
  return from !== null && to !== null && from > to ? { from: to, to: from } : { from, to };
}

/** First and last of `years`; null without any. */
export function spanOfYears(years: readonly number[]): YearSpan | null {
  const finite = years.filter(Number.isFinite);
  if (finite.length === 0) return null;
  return { first: Math.min(...finite), last: Math.max(...finite) };
}

/**
 * The period to apply to films spanning `span`: the open ends closed at the span, the ends
 * clamped into it, and null ("no period") when nothing was asked, when what was asked lies
 * entirely outside the span, or when it covers all of it.
 */
export function resolvePeriod(raw: RawPeriod, span: YearSpan | null): Period | null {
  if (!span || (raw.from === null && raw.to === null)) return null;
  if ((raw.from !== null && raw.from > span.last) || (raw.to !== null && raw.to < span.first)) return null;

  const from = Math.max(span.first, raw.from ?? span.first);
  const to = Math.min(span.last, raw.to ?? span.last);
  return from <= span.first && to >= span.last ? null : { from, to };
}

/** "1978–1993", or "1978" for a single year. */
export function periodLabel(period: Period): string {
  return period.from === period.to ? String(period.from) : `${period.from}–${period.to}`;
}

/** Whether a year falls inside the period (ends included); everything does without one. */
export function inPeriod(year: number, period: Period | null | undefined): boolean {
  return !period || (year >= period.from && year <= period.to);
}

/**
 * The ids of the films that fall outside the period (a film is inside from the start of `from` to the end of
 * `to`); none without a period. The timeline fades these, whether the film is shared or not. A film that is on
 * several lanes (a shared one) is listed once per lane in `films` and counted once here.
 */
export function outsidePeriodIds(films: readonly { id: number; year: number }[], period: Period | null | undefined): Set<number> {
  const outside = new Set<number>();
  if (!period) return outside;
  for (const film of films) {
    if (!inPeriod(film.year, period)) outside.add(film.id);
  }
  return outside;
}

/**
 * `search` (with or without its "?") with the period's two parameters set, or removed for
 * null; every other parameter is kept. Returns "" or a query string with its "?".
 */
export function searchWithPeriod(search: string, period: Period | null): string {
  const params = new URLSearchParams(search);
  params.delete(FROM_PARAM);
  params.delete(TO_PARAM);
  if (period) {
    params.set(FROM_PARAM, String(period.from));
    params.set(TO_PARAM, String(period.to));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** "?from=1978&to=1993" for what a URL named, ends that were left out left out; "" for none. For carrying a link's period through a redirect. */
export function rawPeriodSearch(raw: RawPeriod): string {
  const params = new URLSearchParams();
  if (raw.from !== null) params.set(FROM_PARAM, String(raw.from));
  if (raw.to !== null) params.set(TO_PARAM, String(raw.to));
  const text = params.toString();
  return text ? `?${text}` : "";
}
