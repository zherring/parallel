import type { Metadata } from "next";
import type { Clipping } from "@/lib/clippings";
import { clippingYear, quoteCardSearch, truncateQuote } from "@/lib/clippings-view";
import type { Critic } from "@/lib/critics";
import { criticAbout, criticName } from "@/lib/critics-view";
import { joinNames } from "@/lib/format";
import { inPeriod, periodLabel, searchWithPeriod, type Period } from "@/lib/period";
import type { HeadingPerson } from "@/lib/short-name";
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

/**
 * `shared` is the all-people shared list (non-minor credits only). With a `period` (a link to a
 * stretch of years), only the films of those years are named, and the sentence says so.
 */
export function peopleDescription(timelines: PersonTimeline[], shared: SharedFilm[], period: Period | null = null): string {
  const names = joinNames(timelines.map((t) => t.person.name));
  const within = period ? ` in ${periodLabel(period)}` : "";

  if (timelines.length > 1) {
    const films = shared.filter((f) => inPeriod(f.year, period));
    return films.length > 0
      ? `Films made together by ${names}${within}: ${titleList(films.map((f) => f.title))}.`
      : `No films made together by ${names}${within} found on TMDB.`;
  }

  const films = timelines[0].films.filter((f) => !f.minor && inPeriod(f.year, period));
  if (films.length === 0) return period ? `${names}: no films${within} found on TMDB.` : `${names}: filmography timeline.`;
  // TMDB has no usable "best known" ordering here, and the chronological first films are often shorts or music videos.
  const noun = period && films.length === 1 ? "film" : "films";
  return `${names}: ${films.length} ${noun} from ${films[0].year} to ${films[films.length - 1].year} on a timeline.`;
}

/** The page title with the period appended: "A & B: films made together, 1978–1993". */
export function periodTitle(title: string, period: Period): string {
  return `${title}, ${periodLabel(period)}`;
}

/** Where the card of a shared period is drawn: the `/og` route next to the page's own `opengraph-image`. */
export function periodImagePath(canonicalSlug: string, period: Period): string {
  return `/p/${canonicalSlug}/og${searchWithPeriod("", period)}`;
}

/** The longest a quote may be in a link's title before it is cut: the title of an unfurl is a line or two. */
const MAX_QUOTE_TITLE = 90;

/** The title of a link to one quote: the quote, cut if long, and who said it. */
export function quoteTitle(clipping: Pick<Clipping, "quote" | "speaker">): string {
  return `“${truncateQuote(clipping.quote, MAX_QUOTE_TITLE)}” — ${clipping.speaker}`;
}

/** The description of a link to one quote: who said it about whom, and where ("Steven Spielberg on John Williams · Variety, 2023"). */
export function quoteDescription(clipping: Pick<Clipping, "speaker" | "about" | "publication" | "said_year" | "date">): string {
  const year = clippingYear(clipping);
  return `${clipping.speaker} on ${clipping.about} · ${clipping.publication}${year === null ? "" : `, ${year}`}`;
}

/** The title of a link to one critic's quote: the quote, cut if long, and the critic (the publication when the piece is not signed). */
export function criticQuoteTitle(critic: Pick<Critic, "quote" | "critic" | "publication">): string {
  return quoteTitle({ quote: critic.quote, speaker: criticName(critic) });
}

/** The description of a link to one critic's quote: who wrote it about whom, and where ("Rebecca Keegan on Spielberg & Williams · Los Angeles Times, 2012"). */
export function criticQuoteDescription(
  critic: Pick<Critic, "critic" | "publication" | "date">,
  people: readonly HeadingPerson[],
): string {
  return quoteDescription({
    speaker: criticName(critic),
    about: criticAbout(people),
    publication: critic.publication,
    said_year: null,
    date: critic.date,
  });
}

/** Where the card of one quote is drawn: the `/og` route next to the page's own `opengraph-image`, asked for the quote by its id. */
export function quoteImagePath(canonicalSlug: string, id: string): string {
  return `/p/${canonicalSlug}/og${quoteCardSearch(id)}`;
}

/** A card of its own for the page's link: the path of the image, and what it shows (alt text). */
export interface SocialImage {
  path: string;
  alt: string;
}

/**
 * Open Graph and Twitter card metadata for a /p/ page. By default it sets no image: the
 * generated card in `opengraph-image.tsx` next to the page supplies `og:image` and
 * `twitter:image` (absolute, through `metadataBase`), and a manual `images` entry would compete
 * with it. A link to a shared period or to one quote passes `image` (see `periodImagePath` and
 * `quoteImagePath`): that card replaces the default one, because the file convention cannot see the
 * page's search params. `siteName` is
 * repeated because a page's `openGraph` replaces the layout's wholesale.
 */
export function peopleSocial(
  title: string,
  description: string,
  path: string,
  image?: SocialImage,
): Pick<Metadata, "openGraph" | "twitter"> {
  const images = image ? [{ url: image.path, width: 1200, height: 630, alt: image.alt }] : undefined;
  return {
    openGraph: { title, description, url: path, type: "website", siteName: "Parallel", ...(images ? { images } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(images ? { images } : {}) },
  };
}
