/**
 * The on-disk shape of collaborators.generated.json, written by `npm run people:refresh` (together
 * with the people index, from the same crawl) and read by collaborators-index.ts. One line, ids
 * and counts only: names and photos come from TMDB when a suggestion is shown.
 */
export interface CollaboratorsFile {
  /** ISO timestamp of the refresh. TMDB's terms limit how long cached data may be kept. */
  generatedAt: string;
  /** One row per person, by ascending id. */
  people: CollaboratorRow[];
}

/**
 * [person id, collaborator ids, films shared with each]: the person's most frequent co-credited
 * people from the crawled notable films, most shared films first. A row has at least 3 and at
 * most 16 collaborators, each sharing at least 2 films with the person.
 */
export type CollaboratorRow = [id: number, collaborators: number[], counts: number[]];

export function encodeCollaborators(people: readonly CollaboratorRow[], generatedAt: string): CollaboratorsFile {
  return { generatedAt, people: [...people].sort((a, b) => a[0] - b[0]) };
}

/** What a graph lookup returns: candidates best first, with the films each shares per the crawl. */
export interface GraphEntry {
  ids: number[];
  counts: number[];
}

export function indexCollaborators(file: CollaboratorsFile): Map<number, GraphEntry> {
  return new Map(file.people.map(([id, ids, counts]) => [id, { ids, counts }]));
}
