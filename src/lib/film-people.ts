import type { FilmDetails, FilmPerson, RoleKey } from "@/lib/types";

/** One person in one group of the film panel: credits for the same TMDB person are merged. */
export interface PersonRow {
  id: number;
  name: string;
  profilePath: string | null;
  /** Jobs (crew) or character (cast), already joined for display. May be empty. */
  detail: string;
}

export interface CrewGroup {
  role: RoleKey;
  label: string;
  people: PersonRow[];
}

export interface FilmCredits {
  /** People from the timeline who worked on this film, in timeline order. */
  inTimeline: PersonRow[];
  crew: CrewGroup[];
  /** By billing, one row per person. */
  cast: PersonRow[];
}

// Panel order. Differs from ROLE_ORDER on purpose: producers (often many) come after the craft roles.
export const CREW_GROUP_ORDER: readonly RoleKey[] = [
  "director",
  "writer",
  "cinematographer",
  "editor",
  "composer",
  "production-designer",
  "costume-designer",
  "producer",
  "other",
];

const CREW_GROUP_LABELS: Record<RoleKey, string> = {
  actor: "Cast",
  director: "Directors",
  writer: "Writers",
  cinematographer: "Cinematography",
  editor: "Editing",
  composer: "Music",
  "production-designer": "Production design",
  "costume-designer": "Costume design",
  producer: "Producers",
  other: "Other crew",
};

export function crewGroupLabel(role: RoleKey): string {
  return CREW_GROUP_LABELS[role];
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

/**
 * One row per TMDB person id, in first-appearance order. `detail` of each credit is joined with
 * `separator` (jobs are "Director, Writer"; a person playing two parts is "A / B").
 */
export function mergePeople(
  people: readonly FilmPerson[],
  detailOf: (person: FilmPerson) => string,
  separator = ", ",
): PersonRow[] {
  const rows = new Map<number, { row: PersonRow; details: string[] }>();
  for (const person of people) {
    let entry = rows.get(person.id);
    if (!entry) {
      entry = {
        row: { id: person.id, name: person.name, profilePath: person.profilePath, detail: "" },
        details: [],
      };
      rows.set(person.id, entry);
    }
    if (!entry.row.profilePath && person.profilePath) entry.row.profilePath = person.profilePath;
    entry.details.push(detailOf(person));
  }
  return [...rows.values()].map(({ row, details }) => ({
    ...row,
    detail: unique(details).join(separator),
  }));
}

/** "Actor as Tyler Durden" / "Actor" for a cast credit, the job otherwise. */
function timelineDetail(person: FilmPerson): string {
  if (person.role !== "actor") return person.job;
  return person.character ? `Actor as ${person.character}` : "Actor";
}

export function groupFilmCredits(
  film: Pick<FilmDetails, "cast" | "crew">,
  peopleInView: readonly { id: number }[],
): FilmCredits {
  const crewByRole = new Map<RoleKey, FilmPerson[]>();
  for (const person of film.crew) {
    // Cast never appears in crew, but a stray "actor" role would have no group to live in.
    const role: RoleKey = CREW_GROUP_ORDER.includes(person.role) ? person.role : "other";
    crewByRole.set(role, [...(crewByRole.get(role) ?? []), person]);
  }

  const crew = CREW_GROUP_ORDER.flatMap((role) => {
    const members = crewByRole.get(role);
    if (!members?.length) return [];
    return [
      {
        role,
        label: crewGroupLabel(role),
        people: mergePeople(members, (p) => p.job),
      },
    ];
  });

  const cast = mergePeople(film.cast, (p) => p.character ?? "", " / ");

  const inViewIds = [...new Set(peopleInView.map((p) => p.id))];
  const involved = [...film.crew, ...film.cast];
  const inTimeline = inViewIds.flatMap((id) => {
    const credits = involved.filter((p) => p.id === id);
    return credits.length > 0 ? mergePeople(credits, timelineDetail) : [];
  });

  return { inTimeline, crew, cast };
}

/** 139 -> "2h 19m", 120 -> "2h", 45 -> "45m"; null for missing or non-positive runtimes. */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** "1999 · 2h 19m · Drama, Thriller", skipping whatever is missing. */
export function filmMetaLine(
  film: Pick<FilmDetails, "year" | "runtime" | "genres">,
): string {
  return [
    film.year ? String(film.year) : null,
    formatRuntime(film.runtime),
    film.genres.length > 0 ? film.genres.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export const tmdbMovieUrl = (id: number) => `https://www.themoviedb.org/movie/${id}`;
