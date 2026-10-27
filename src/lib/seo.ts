import type { Metadata } from "next";
import { joinNames } from "@/lib/format";
import type { PersonTimeline, SharedFilm } from "@/lib/types";

const MAX_TITLES = 6;

function titleList(titles: string[]): string {
  const shown = titles.slice(0, MAX_TITLES).join(", ");
  const rest = titles.length - MAX_TITLES;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

export function peopleTitle(names: string[]): string {
  return names.length === 1
    ? `${names[0]}: filmography timeline`
    : `${joinNames(names)}: films made together`;
}

/** `shared` is the all-people shared list (non-minor credits only). */
export function peopleDescription(timelines: PersonTimeline[], shared: SharedFilm[]): string {
  const names = joinNames(timelines.map((t) => t.person.name));

  if (timelines.length > 1) {
    return shared.length > 0
      ? `Films made together by ${names}: ${titleList(shared.map((f) => f.title))}.`
      : `No films made together by ${names} found on TMDB.`;
  }

  const films = timelines[0].films.filter((f) => !f.minor);
  if (films.length === 0) return `${names}: filmography timeline.`;
  // TMDB has no usable "best known" ordering here, and the chronological first films are often shorts or music videos.
  return `${names}: ${films.length} films from ${films[0].year} to ${films[films.length - 1].year} on a timeline.`;
}

/**
 * Open Graph and Twitter card metadata for a /p/ page. It deliberately sets no image: the
 * generated card in `opengraph-image.tsx` next to the page supplies `og:image` and
 * `twitter:image` (absolute, through `metadataBase`). A manual `images` entry here would compete
 * with it. `siteName` is repeated because a page's `openGraph` replaces the layout's wholesale.
 */
export function peopleSocial(title: string, description: string, path: string): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: { title, description, url: path, type: "website", siteName: "Parallel" },
    twitter: { card: "summary_large_image", title, description },
  };
}
