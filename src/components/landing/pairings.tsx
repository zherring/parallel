import type { ReactNode } from "react";
import { GenreDeepLink, GenrePanels, type GenrePanel } from "@/components/landing/genre-tabs";
import { PairingCard } from "@/components/landing/pairing-card";
import { withBaconMode } from "@/lib/bacon-mode";
import type { GenreSection } from "@/lib/example-cards";
import { BACON_GENRE, FEATURED_TAB } from "@/lib/examples";

interface Props {
  sections: GenreSection[];
  /** The splash (the hero): all that the Featured tab's panel holds. */
  hero: ReactNode;
}

const pairingsText = (count: number) => `${count} ${count === 1 ? "pairing" : "pairings"}`;

/**
 * The page's views, a panel per tab, chosen by the pills of the top bar (`GenreTablist`, sharing the state of `GenreTabsProvider`): Featured, the default, is
 * the splash alone; a genre is its grid of pairings under a small heading, directly under the bar, in place of the splash. The
 * script and the style before the panels (`GenreDeepLink`) are what a link to a genre (`/#horror`) needs to open on its grid without the splash painted first
 * (see genre-deep-link.ts).
 *
 * The Kevin Bacon tab (`BACON_GENRE`) is a grid like the others, whose cards open their pair in Kevin Bacon mode.
 *
 * Headings: the splash has the page's one h1 (hero.tsx); a genre's view has its own h2, so on a genre's tab (where the splash and its h1 are hidden) the page
 * still has a heading to start from.
 */
export function Pairings({ sections, hero }: Props) {
  const featuredPanel: GenrePanel = { id: FEATURED_TAB.id, panel: hero };

  const genrePanels: GenrePanel[] = sections.map(({ genre, cards }) => ({
    id: genre.id,
    panel: (
      <section aria-labelledby={`genre-${genre.id}-heading`} className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8">
        <h2 id={`genre-${genre.id}-heading`} className="flex flex-wrap items-baseline gap-x-3 text-2xl font-semibold tracking-tight text-strong">
          {genre.label}
          <span className="text-sm font-medium tracking-normal text-muted">{pairingsText(cards.length)}</span>
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.href}>
              {/* The Kevin Bacon tab's cards open the pair in the mode (`?mode=bacon`); `card.href`, which the sitemap and the search list, is the page's own. */}
              <PairingCard card={genre.id === BACON_GENRE ? { ...card, href: withBaconMode(card.href) } : card} />
            </li>
          ))}
        </ul>
      </section>
    ),
  }));

  const ids = [featuredPanel.id, ...genrePanels.map((panel) => panel.id)];
  return (
    <>
      <GenreDeepLink ids={ids} />
      <GenrePanels panels={[featuredPanel, ...genrePanels]} />
    </>
  );
}
