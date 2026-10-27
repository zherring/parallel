import { joinNames } from "@/lib/format";

/**
 * Family names for the page heading when three or more people are shown
 * ("Spielberg, Harrison, & Williams").
 *
 * TMDB has no family-name field, only one free-text `name`, so this is a heuristic
 * plus a small override table:
 *
 *  1. East-Asian names that TMDB lists family name FIRST ("Bong Joon Ho") are looked up
 *     by TMDB person id in FAMILY_NAME_OVERRIDES. Guessing from the text alone would
 *     get them wrong ("Ho", "Kang-ho"), and a pattern such as "two syllables then a
 *     hyphen" would also catch Western names, so it is deliberately by id.
 *  2. Otherwise the family name is the last word, after dropping generational suffixes
 *     (Jr., Sr., II, III, IV) and a trailing "(I)" disambiguator, and keeping any chain
 *     of lowercase-style particles attached ("van Hoytema", "del Toro", "De Niro",
 *     "de la Rosa"). Hyphenated surnames stay whole ("Day-Lewis").
 *
 * Known limits: compound surnames written as separate capitalised words without a
 * particle ("Helena Bonham Carter" gives "Carter") and family-name-first names that are
 * not in the override table. Add the TMDB id below when one turns up.
 */

/** TMDB person id -> family name, for names TMDB lists family-name-first. */
export const FAMILY_NAME_OVERRIDES: Readonly<Record<number, string>> = {
  21684: "Bong", // Bong Joon Ho
  20738: "Song", // Song Kang-ho
  10099: "Park", // Park Chan-wook
  10107: "Chung", // Chung Chung-hoon
  12453: "Wong", // Wong Kar-wai
  1337: "Leung", // Tony Leung Chiu-wai
  607: "Zhang", // Zhang Yimou
  643: "Gong", // Gong Li
  1619: "Chow", // Chow Yun-Fat
};

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

const PARTICLES = new Set([
  "van",
  "von",
  "de",
  "del",
  "della",
  "di",
  "da",
  "dos",
  "du",
  "la",
  "le",
  "ter",
  "ten",
  "bin",
  "ibn",
  "al",
  "el",
  "der",
  "den",
  "do",
  "das",
  "des",
  "zu",
]);

function bare(token: string): string {
  return token.replace(/[.,]/g, "").toLowerCase();
}

/** Family name for `name`; `id` is the TMDB person id, used for the override table. */
export function shortName(name: string, id?: number): string {
  if (id !== undefined && Object.hasOwn(FAMILY_NAME_OVERRIDES, id)) return FAMILY_NAME_OVERRIDES[id];

  const tokens = name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return name.trim();

  while (tokens.length > 1 && SUFFIXES.has(bare(tokens[tokens.length - 1]))) tokens.pop();
  // "Downey, Jr." leaves a comma on the family name.
  let family = (tokens.pop() as string).replace(/,+$/, "");

  // Keep at least one word as the given name, so "Al Pacino" stays "Pacino".
  while (tokens.length > 1 && PARTICLES.has(bare(tokens[tokens.length - 1]))) {
    family = `${tokens.pop()} ${family}`;
  }
  return family;
}

export interface HeadingPerson {
  id: number;
  name: string;
}

export interface PageHeading {
  /** What the h1 shows. */
  text: string;
  /** Full names, "A, B & C"; set when `text` is abbreviated so it can go in a tooltip. */
  full: string | null;
}

function joinAmpersand(names: string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

/**
 * One or two people: full names ("A", "A & B"). Three or more: family names only, with an
 * Oxford comma before the ampersand ("Spielberg, Harrison, & Williams"). A family name shared
 * by two people on the page ("Coen, Coen") would be ambiguous, so those keep their full name.
 */
export function pageHeading(people: readonly HeadingPerson[]): PageHeading {
  const fullNames = people.map((p) => p.name);
  if (people.length < 3) return { text: joinAmpersand(fullNames), full: null };

  const shorts = people.map((p) => shortName(p.name, p.id));
  const counts = new Map<string, number>();
  for (const short of shorts) counts.set(short, (counts.get(short) ?? 0) + 1);
  const parts = shorts.map((short, i) => ((counts.get(short) ?? 0) > 1 ? fullNames[i] : short));

  return { text: joinAmpersand(parts), full: joinNames(fullNames) };
}
