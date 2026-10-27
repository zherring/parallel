const MAX_PEOPLE = 4;
// "7467" or "7467-anything"; ids are positive integers of at most 10 digits.
const SEGMENT = /^([1-9]\d{0,9})(?:-[^+]*)?$/;

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildPeopleSlug(people: { id: number; name: string }[]): string {
  return people
    .map(({ id, name }) => {
      const text = slugify(name);
      return text ? `${id}-${text}` : String(id);
    })
    .join("+");
}

/**
 * Parses `id` or `id-anything` segments joined by `+` (or an encoded `%2B`).
 * `canonical` is set when the input needed cleaning (decoded separator or
 * duplicate ids) and holds the cleaned slug text.
 */
export function parsePeopleSlug(slug: string): { ids: number[]; canonical?: string } | null {
  const decoded = slug.replace(/%2b/gi, "+");
  const kept = new Map<number, string>();

  for (const segment of decoded.split("+")) {
    const match = SEGMENT.exec(segment);
    if (!match) return null;
    const id = Number(match[1]);
    if (!kept.has(id)) kept.set(id, segment);
  }
  if (kept.size > MAX_PEOPLE) return null;

  const cleaned = [...kept.values()].join("+");
  return {
    ids: [...kept.keys()],
    ...(cleaned !== slug ? { canonical: cleaned } : {}),
  };
}
