/**
 * The one definition of "released": a film is out when its release date is on or before today
 * (both `yyyy-mm-dd`, today in UTC). Only released films count as shared films and as
 * connections between lanes; an announced film stays on each person's lane as an "upcoming"
 * poster but is never lit, connected or counted.
 *
 * Both dates are compared as text, which orders ISO dates correctly. A date that is missing or
 * is not `yyyy-mm-dd` is never released, so it can never be counted by accident.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as `yyyy-mm-dd`, in UTC. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Whether a film with this release date is out on `today` (`yyyy-mm-dd`): released today counts. */
export function isReleased(releaseDate: string | null | undefined, today: string): boolean {
  return typeof releaseDate === "string" && ISO_DATE.test(releaseDate) && releaseDate <= today;
}
