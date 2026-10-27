// TMDB's known_for_department values mapped to something a visitor would say out loud.
const DEPARTMENT_LABELS: Record<string, string> = {
  Acting: "Actor",
  Directing: "Director",
  Writing: "Writer",
  Camera: "Cinematographer",
  Editing: "Editor",
  Sound: "Music & sound",
  Production: "Producer",
  Art: "Production design",
  "Costume & Make-Up": "Costume & make-up",
  "Visual Effects": "Visual effects",
  Lighting: "Lighting",
  Creator: "Creator",
  Crew: "Crew",
};

/** Readable label for TMDB's known_for_department; unknown departments pass through, empty is null. */
export function departmentLabel(knownFor: string | null | undefined): string | null {
  const text = knownFor?.trim();
  if (!text) return null;
  return DEPARTMENT_LABELS[text] ?? text;
}

/** Up to two capital letters for an avatar fallback: first and last word of the name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toLocaleUpperCase();
}
