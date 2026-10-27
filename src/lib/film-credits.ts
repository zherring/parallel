import { MINOR_CHARACTER_PATTERN, ROLE_ORDER, roleLabel } from "@/lib/roles";
import type { Credit, Film, PersonSummary, RoleKey } from "@/lib/types";

/** One role of a person on a film: "Actor" with the detail "as Jesse", or "Director" with none. */
export interface RoleDetail {
  label: string;
  /** "as Jesse", "as Waiter, uncredited", "minor"; null when there is nothing to add. */
  detail: string | null;
}

/** What one person on the timeline did on a film, for one row of the hover card. */
export interface CreditsRow {
  personId: number;
  name: string;
  profilePath: string | null;
  roles: RoleDetail[];
  /** The roles on one line: "Director, Writer" or "Actor (as Jesse)". */
  text: string;
}

export interface FilmCardContent {
  filmId: number;
  title: string;
  year: number;
  posterPath: string | null;
  /** Everyone on the timeline with a visible credit on the film; the hovered lane's person first. */
  rows: CreditsRow[];
}

/** A parenthesised bit of a character name that marks a walk-on: "(uncredited)", "(archive footage)". */
const MARKER = /\b(uncredited|archive|cameo|voice)\b/i;

/** "Waiter (uncredited)" is the character "Waiter" with the tag "uncredited". */
function splitCharacter(character: string): { name: string; tags: string[] } {
  const tags: string[] = [];
  const name = character
    .replace(/\(([^)]*)\)/g, (whole, inner: string) => {
      if (!MARKER.test(inner)) return whole;
      tags.push(inner.trim());
      return "";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { name, tags };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function roleDetail(role: RoleKey, credits: Credit[]): RoleDetail {
  if (role === "other") {
    // "Other" says nothing; the job ("Executive Producer") does. These are always minor.
    const jobs = unique(credits.map((c) => c.job.trim()).filter(Boolean));
    return { label: jobs.join(", ") || roleLabel(role), detail: null };
  }

  const parts = credits.map((c) => splitCharacter(c.character ?? ""));
  const names = unique(parts.map((p) => p.name).filter(Boolean));
  const tags = unique(parts.flatMap((p) => p.tags));
  const allMinor = credits.every((c) => c.minor);
  // Only mark a minor credit as such when the character does not already say why ("Himself").
  if (allMinor && tags.length === 0 && !MINOR_CHARACTER_PATTERN.test(names.join(" "))) tags.push("minor");

  const detail = [names.length > 0 ? `as ${names.join(" / ")}` : "", ...tags].filter(Boolean).join(", ");
  return { label: roleLabel(role), detail: detail || null };
}

/** One person's credits on a film as roles in `ROLE_ORDER`, with the character for actors. */
export function creditsRoles(credits: readonly Credit[]): RoleDetail[] {
  return ROLE_ORDER.flatMap((role) => {
    const forRole = credits.filter((c) => c.role === role);
    return forRole.length > 0 ? [roleDetail(role, forRole)] : [];
  });
}

export function rolesText(roles: readonly RoleDetail[]): string {
  return roles.map((r) => (r.detail ? `${r.label} (${r.detail})` : r.label)).join(", ");
}

/** "Richard Linklater: Director, Writer". */
export function creditsLine(row: Pick<CreditsRow, "name" | "text">): string {
  return `${row.name}: ${row.text}`;
}

/**
 * Content of the hover card for a film: title, year, poster and one row per person on the
 * timeline who has a credit on it, in lane order except that `firstPersonId` (the lane being
 * hovered) leads. Credits are the ones the timeline shows: minor ones only with `includeMinor`.
 * Null when no lane has the film.
 */
export function filmCardContent(
  filmId: number,
  lanes: readonly { person: Pick<PersonSummary, "id" | "name" | "profilePath">; films: readonly Film[] }[],
  { includeMinor, firstPersonId = null }: { includeMinor: boolean; firstPersonId?: number | null },
): FilmCardContent | null {
  let film: Film | undefined;
  const rows: CreditsRow[] = [];

  for (const { person, films } of lanes) {
    const found = films.find((f) => f.id === filmId);
    if (!found) continue;
    film ??= found;
    const roles = creditsRoles(found.credits.filter((c) => includeMinor || !c.minor));
    if (roles.length === 0) continue;
    rows.push({ personId: person.id, name: person.name, profilePath: person.profilePath, roles, text: rolesText(roles) });
  }

  if (!film) return null;
  rows.sort((a, b) => Number(b.personId === firstPersonId) - Number(a.personId === firstPersonId));
  return { filmId, title: film.title, year: film.year, posterPath: film.posterPath, rows };
}
