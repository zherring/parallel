import type { MatchablePerson } from "@/lib/people-match";

/**
 * The on-disk shape of people-index.generated.json, written by `npm run people:refresh` and read
 * by people-index.ts. It is compact on purpose (one line, no keys per person): department and
 * film names repeat across thousands of people, so each is stored once and referenced by number.
 */
export interface PeopleIndexFile {
  /** ISO timestamp of the refresh. TMDB's terms limit how long cached data may be kept. */
  generatedAt: string;
  /** TMDB known_for_department values, referenced by position. */
  departments: string[];
  /** Film (or show) titles used as "known for" labels, referenced by position. */
  titles: string[];
  /** Most notable first. */
  people: PeopleIndexRow[];
}

/**
 * [id, name, profilePath ("" for none), department (-1 for none), popularity, credits, title positions]
 */
export type PeopleIndexRow = [
  id: number,
  name: string,
  profilePath: string,
  department: number,
  popularity: number,
  credits: number,
  titles: number[],
];

export function encodePeopleIndex(
  people: readonly MatchablePerson[],
  generatedAt: string,
): PeopleIndexFile {
  const departments: string[] = [];
  const titles: string[] = [];
  const positions = (table: string[], lookup: Map<string, number>, value: string): number => {
    let at = lookup.get(value);
    if (at === undefined) {
      at = table.length;
      table.push(value);
      lookup.set(value, at);
    }
    return at;
  };
  const departmentAt = new Map<string, number>();
  const titleAt = new Map<string, number>();

  const rows = people.map((p): PeopleIndexRow => [
    p.id,
    p.name,
    p.profilePath ?? "",
    p.knownFor ? positions(departments, departmentAt, p.knownFor) : -1,
    Math.round(p.popularity * 100) / 100,
    p.credits,
    p.knownForTitles.map((title) => positions(titles, titleAt, title)),
  ]);
  return { generatedAt, departments, titles, people: rows };
}

export function decodePeopleIndex(file: PeopleIndexFile): MatchablePerson[] {
  return file.people.map(([id, name, profilePath, department, popularity, credits, titles]) => ({
    id,
    name,
    profilePath: profilePath || null,
    knownFor: department >= 0 ? file.departments[department] : null,
    knownForTitles: titles.map((at) => file.titles[at]),
    popularity,
    credits,
  }));
}
