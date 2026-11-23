/**
 * A sorted list of years, stored as its first year followed by the gap to each next one (`[1977, 0, 2, 1]` is 1977, 1977, 1979, 1980). A career is
 * mostly a film or two a year, so the gaps are one digit where the years are four: the landing page ships the lists of every pairing in its
 * payload, and this is under half their size (and under three quarters of it gzipped). No imports, so the refresh script can use it too.
 */

/** The years, sorted ascending (a year repeated once per film), as `[first, ...gaps]`; empty for none. */
export function encodeYears(years: readonly number[]): number[] {
  const sorted = [...years].sort((a, b) => a - b);
  return sorted.map((year, index) => (index === 0 ? year : year - sorted[index - 1]));
}

/** The years `encodeYears` made the list from, oldest first. */
export function decodeYears(encoded: readonly number[]): number[] {
  const years: number[] = [];
  let year = 0;
  for (const step of encoded) {
    year += step;
    years.push(year);
  }
  return years;
}
