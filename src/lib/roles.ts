import type { Credit, RoleKey } from "@/lib/types";

export const ROLE_ORDER: readonly RoleKey[] = [
  "actor",
  "director",
  "writer",
  "cinematographer",
  "editor",
  "composer",
  "producer",
  "production-designer",
  "costume-designer",
  "other",
];

const ROLE_LABELS: Record<RoleKey, string> = {
  actor: "Actor",
  director: "Director",
  writer: "Writer",
  cinematographer: "Cinematographer",
  editor: "Editor",
  composer: "Composer",
  producer: "Producer",
  "production-designer": "Production designer",
  "costume-designer": "Costume designer",
  other: "Other",
};

export function roleLabel(role: RoleKey): string {
  return ROLE_LABELS[role];
}

// Exact TMDB job names (lowercased). "Executive Producer", "Co-Producer" etc. are
// deliberately absent so they fall through to "other" (minor).
const JOB_ROLES: Record<string, RoleKey> = {
  director: "director",
  writer: "writer",
  screenplay: "writer",
  story: "writer",
  novel: "writer",
  characters: "writer",
  teleplay: "writer",
  author: "writer",
  "original story": "writer",
  "director of photography": "cinematographer",
  editor: "editor",
  "original music composer": "composer",
  composer: "composer",
  producer: "producer",
  "production design": "production-designer",
  "costume design": "costume-designer",
};

export function roleForJob(job: string): RoleKey {
  return JOB_ROLES[job.trim().toLowerCase()] ?? "other";
}

/**
 * What "minor" covers, in the words the UI uses for the toggle: short films, music
 * videos and featurettes (anything under 40 minutes or flagged as a video), cameos,
 * uncredited and archive appearances, and non-key crew jobs.
 */
export const MINOR_TOGGLE_LABEL = "Include shorts, music videos, cameos & uncredited";

/** Cast credits whose character text marks a walk-on, archive clip or self appearance. */
export const MINOR_CHARACTER_PATTERN =
  /(uncredited|archive|\bself\b|himself|herself|themselves|voice \(|cameo)/i;

/** Cast billed this far down (0-based) or beyond are treated as minor. */
export const MINOR_CAST_ORDER = 15;

export function isMinorCast(order: number | undefined, character: string | undefined): boolean {
  return (
    (order !== undefined && order >= MINOR_CAST_ORDER) ||
    MINOR_CHARACTER_PATTERN.test(character ?? "")
  );
}

export function isMinorCrewRole(role: RoleKey): boolean {
  return role === "other";
}

/** "Director, Writer": each role's label once, in ROLE_ORDER. */
export function roleSummary(credits: Credit[]): string {
  const roles = new Set(credits.map((c) => c.role));
  return ROLE_ORDER.filter((role) => roles.has(role)).map(roleLabel).join(", ");
}
