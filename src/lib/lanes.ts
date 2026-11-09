import { roleSummary } from "@/lib/roles";
import { buildPeopleSlug } from "@/lib/slug";
import type { Film, PersonSummary } from "@/lib/types";

/** The most people a timeline can show; mirrors the cap in slug.ts. */
export const MAX_LANES = 4;

export interface PersonRef {
  id: number;
  name: string;
}

/** `/p/<slug>` for the given people, or `/` when there are none. */
export function peopleHref(people: PersonRef[]): string {
  return people.length === 0 ? "/" : `/p/${buildPeopleSlug(people)}`;
}

/** The URL after removing one person; the last person's removal goes home. */
export function removePersonHref(people: PersonRef[], idToRemove: number): string {
  return peopleHref(people.filter((p) => p.id !== idToRemove));
}

export function canAddPerson(count: number): boolean {
  return count < MAX_LANES;
}

function yearOf(date: string | null): number | null {
  const match = date ? /^(\d{4})/.exec(date) : null;
  return match ? Number(match[1]) : null;
}

/**
 * "Born 1962 · first film 1992 · latest 2026", with "died 2021" when relevant.
 * Missing pieces are left out; the latest year is dropped when it equals the first.
 */
export function laneFacts(person: Pick<PersonSummary, "birthday" | "deathday">, filmYears: number[]): string {
  const born = yearOf(person.birthday);
  const died = yearOf(person.deathday);
  const first = filmYears.length > 0 ? Math.min(...filmYears) : null;
  const latest = filmYears.length > 0 ? Math.max(...filmYears) : null;

  const parts: string[] = [];
  if (born !== null) parts.push(`Born ${born}`);
  if (died !== null) parts.push(`died ${died}`);
  if (first !== null) parts.push(`first film ${first}`);
  if (latest !== null && latest !== first) parts.push(`latest ${latest}`);
  return parts.join(" · ");
}

/** "1992–2026", or just the year when there is one. Empty with no films. */
export function yearSpan(filmYears: number[]): string {
  if (filmYears.length === 0) return "";
  const first = Math.min(...filmYears);
  const latest = Math.max(...filmYears);
  return first === latest ? String(first) : `${first}–${latest}`;
}

/** What a lane's header or People-panel row says of a person over the films shown. */
export function laneSummary(
  films: readonly Film[],
  person: Pick<PersonSummary, "birthday" | "deathday">,
  includeMinor: boolean,
): { roles: string; facts: string; span: string; rolesByFilm: Map<number, string> } {
  const creditsOf = (film: Film) => film.credits.filter((credit) => includeMinor || !credit.minor);
  const years = films.map((film) => film.year);
  return {
    roles: roleSummary(films.flatMap(creditsOf)),
    facts: laneFacts(person, years),
    span: yearSpan(years),
    rolesByFilm: new Map(films.map((film) => [film.id, roleSummary(creditsOf(film))])),
  };
}
