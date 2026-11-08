"use client";

import { useEffect, useState, type ReactNode } from "react";
import { newsreader } from "@/components/newsreader";
import type { Clipping, ClippingsPerson, ClippingsVoice, VoicedClippings } from "@/lib/clippings";
import {
  clippingById,
  clippingYear,
  clippingsCountMessage,
  filterClippings,
  filterCritics,
  filterOptions,
  pagePersonFor,
  parseQuoteId,
  speakerIndex,
  type ClippingsFilter,
} from "@/lib/clippings-view";
import type { Critic, PairCritics } from "@/lib/critics";
import {
  criticAvatarName,
  criticBackground,
  criticById,
  criticName,
  criticYear,
  interleaveQuotes,
} from "@/lib/critics-view";
import { personColor } from "@/lib/person-colors";
import { headingNames } from "@/lib/short-name";
import { cn } from "./cn";
import { MoreReading } from "./more-reading";
import { PersonBio, type BioPerson, type OpenPerson } from "./person-bio";
import { PullQuote, quoteElementId } from "./pull-quote";
import { scrollBehavior } from "./scroll-behavior";

/** How long a quote that a link opened on stays highlighted. */
const HIGHLIGHT_MS = 2800;

/**
 * The colour of anyone who is not one of the pair: a quote whose speaker is neither of them, and every critic (their
 * marks, dot and avatar ring are quiet, so that the artists' voices keep the colours they have on the Timeline).
 */
const MUTED = "var(--text-muted)";

/** No critics: one array for every render, so that an effect keyed on it does not run again for nothing. */
const NO_CRITICS: readonly Critic[] = [];

interface ClippingsPanelProps {
  /** The pair's quotes about each other; null for a pair that has none (the panel is then the critics alone). */
  pair: VoicedClippings | null;
  /** What the critics have written about the pair: their quotes and the reading list; null for a pair with neither. */
  critics: PairCritics | null;
  /** Whether the Clippings tab is the one showing: the panel is always in the page, hidden when it is not. */
  active: boolean;
  /** The page's people (matched to the names in the quotes by TMDB id): a name of one of them opens their details. Without it, names are plain text. */
  bioPeople?: readonly BioPerson[];
  /** Opens a person's details in the slide-out panel; with `bioPeople`, what turns a name into a button. */
  onOpenPerson?: OpenPerson;
}

/** No one to open a biography of: one array for every render. */
const NO_BIO_PEOPLE: readonly BioPerson[] = [];

/**
 * The Clippings tab: the pair's quotes about each other and what the critics have written about the collaboration, both
 * as pull quotes in one list (`Quotes`), then "More reading" (`MoreReading`): pieces that are only linked. A pair may
 * have any of the three alone, and the tab then shows only that. The serif is loaded here.
 */
export function ClippingsPanel({ pair, critics, active, bioPeople = NO_BIO_PEOPLE, onOpenPerson }: ClippingsPanelProps) {
  const quotes = critics?.critics ?? NO_CRITICS;
  const reading = critics?.reading ?? [];
  const hasQuotes = (pair?.clippings.length ?? 0) > 0 || quotes.length > 0;
  return (
    <div className={newsreader.variable}>
      {hasQuotes && <Quotes pair={pair} critics={critics} active={active} bioPeople={bioPeople} onOpenPerson={onOpenPerson} />}
      {reading.length > 0 && <MoreReading reading={reading} afterQuotes={hasQuotes} />}
    </div>
  );
}

/**
 * What one of the pair has said about the other, and what the critics have written about the two of them, set as
 * pull quotes (big serif quote between marks, a round picture in the gutter beside it, small speaker and source
 * under it, space and a hairline between) in ONE list, oldest first (see `interleaveQuotes`). An artist's quote has
 * the speaker's colour and headshot; a critic's the same marks and layout in a neutral grey, with the initials of the
 * writer for a picture. A small filter ("All", "A on B", "B on A", "Critics") shows one group when there is more than
 * one. The quotes are hand-curated (`clippings.json`, `essays.json`), see `clippings.ts` and `critics.ts`.
 *
 * A link to one quote (`?view=clippings&quote=<id>`) opens the tab on it: it is scrolled to the middle
 * of the screen and highlighted for a moment. An id that is not one of the pair's is ignored.
 */
function Quotes({
  pair,
  critics,
  active,
  bioPeople,
  onOpenPerson,
}: {
  pair: VoicedClippings | null;
  critics: PairCritics | null;
  active: boolean;
  bioPeople: readonly BioPerson[];
  onOpenPerson: OpenPerson | undefined;
}) {
  const people = pair?.people ?? null;
  // The two names of the page, whichever of the pair's lists has them: what a name in a quote is matched against.
  const named = pair?.people ?? critics?.people ?? null;
  const clippings = pair?.clippings ?? [];
  const criticQuotes = critics?.critics ?? NO_CRITICS;
  const [filter, setFilter] = useState<ClippingsFilter>("all");
  const [changed, setChanged] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const colorOf = (side: 0 | 1 | null) => (side === null || !people ? MUTED : personColor(people[side].slot));

  const options = people ? filterOptions(clippings, people, criticQuotes.length) : [];
  const shown = people ? filterClippings(clippings, people, filter) : [];
  const shownCritics = filterCritics(criticQuotes, filter);
  const entries = interleaveQuotes(shown, shownCritics);
  const bioFor = (name: string) => (named ? pagePersonFor(name, named, bioPeople) : null);
  // "Spielberg & Williams" (see `criticAbout`), each name opening its person's details; the critic's own name stays plain.
  const criticsAbout = critics ? (
    <CriticsAbout people={critics.people} bioPeople={bioPeople} onOpenPerson={onOpenPerson} />
  ) : null;

  // The address bar is read once the tab is showing (the server's HTML and the first client render are the Timeline,
  // see `useViewTab`), so a link that names a quote lands here with the tab already un-hidden and its quote on the page.
  const clippingList = pair?.clippings;
  useEffect(() => {
    if (!active) return;
    const id = parseQuoteId(window.location.search);
    const target = clippingById(clippingList ?? [], id) ?? criticById(criticQuotes, id);
    if (!target) return;

    const reveal = (behavior: ScrollBehavior) =>
      document.getElementById(quoteElementId(target.id))?.scrollIntoView({ block: "center", behavior });
    reveal(scrollBehavior());
    // Newsreader loads on first use, and the quotes above this one reflow when it arrives: centre it again.
    let cancelled = false;
    document.fonts?.load(`28px ${newsreader.style.fontFamily}`).then(
      () => !cancelled && reveal("auto"),
      () => {},
    );
    // Not a render's own work, but the page's reaction to a link it was opened with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlighted(target.id);
    const timer = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Leaving the tab ends the highlight, so that coming back to it does not find a quote still lit.
      setHighlighted(null);
    };
  }, [active, clippingList, criticQuotes]);

  return (
    <>
      {options.length > 0 && (
        <div role="group" aria-label="Show clippings by speaker" className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = option.id === filter;
            // A dot in the colour of the voice the button shows: a person's, a neutral one for the critics, none for "All".
            const dot = option.id === "first" ? colorOf(0) : option.id === "second" ? colorOf(1) : option.id === "critics" ? MUTED : null;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                title={option.title}
                onClick={() => {
                  setFilter(option.id);
                  setChanged(true);
                }}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors motion-reduce:transition-none",
                  selected
                    ? "border-muted/60 bg-border text-strong"
                    : "border-border text-muted hover:border-muted hover:text-strong",
                )}
              >
                {dot !== null && <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: dot }} />}
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {changed ? clippingsCountMessage(shown.length + shownCritics.length) : ""}
      </p>

      {entries.length > 0 && (
        <ul className={cn("divide-y divide-border/70", options.length > 0 && "mt-3")}>
          {entries.map((entry) => {
            if (entry.kind === "critic") {
              const { critic } = entry;
              return (
                <li key={critic.id} id={quoteElementId(critic.id)} className="group/quote">
                  <CriticQuote critic={critic} about={criticsAbout} highlighted={critic.id === highlighted} />
                </li>
              );
            }
            const { clipping } = entry;
            const side = people ? speakerIndex(clipping, people) : null;
            return (
              <li key={clipping.id} id={quoteElementId(clipping.id)} className="group/quote">
                <ClippingQuote
                  clipping={clipping}
                  voice={side === null || !people ? null : people[side]}
                  speakerBio={bioFor(clipping.speaker)}
                  aboutBio={bioFor(clipping.about)}
                  onOpenPerson={onOpenPerson}
                  color={colorOf(side)}
                  highlighted={clipping.id === highlighted}
                />
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs text-muted">Quotes link to their original sources.</p>
    </>
  );
}

/** An artist's quote: their headshot and colour (neither, when they are not one of the pair), where and why they said it. */
function ClippingQuote({
  clipping,
  voice,
  speakerBio,
  aboutBio,
  onOpenPerson,
  color,
  highlighted,
}: {
  clipping: Clipping;
  /** The one of the pair who said it; null when it is neither (no headshot, a muted mark). */
  voice: ClippingsVoice | null;
  /** The speaker and who it is about, as the page has them (their names open the biography); null for someone who is not on the page. */
  speakerBio: BioPerson | null;
  aboutBio: BioPerson | null;
  onOpenPerson: OpenPerson | undefined;
  /** A CSS colour: the speaker's on the Timeline. */
  color: string;
  highlighted: boolean;
}) {
  const { id, speaker, about, quote, film, publication, title, url, via, context, secondhand } = clipping;

  // Where and why it was said; a quote that is reported rather than spoken says so here too, not as a tag on the quote.
  const background = [
    context,
    secondhand ? `Secondhand: ${speaker} is reported by someone else here, not quoted in their own words.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PullQuote
      id={id}
      quote={quote}
      url={url}
      linkTitle={title}
      speaker={speaker}
      speakerLabel={<BioName name={speaker} entry={speakerBio} onOpen={onOpenPerson} />}
      about={<BioName name={about} entry={aboutBio} onOpen={onOpenPerson} />}
      color={color}
      avatar={voice ? { name: voice.name, profilePath: voice.profilePath } : null}
      film={film}
      publication={publication}
      year={clippingYear(clipping)}
      via={via}
      background={background}
      highlighted={highlighted}
    />
  );
}

/**
 * A critic's quote, in the artists' own format: the same marks and layout, but quiet. The writer (or the publication, for
 * an unsigned piece) is the speaker and "on Spielberg & Williams" is what it is about; the picture is their initials in
 * a neutral ring, since there is no photo; the ⓘ names the piece it is from; and no film, no kind tag.
 */
function CriticQuote({ critic, about, highlighted }: { critic: Critic; about: ReactNode; highlighted: boolean }) {
  return (
    <PullQuote
      id={critic.id}
      quote={critic.quote}
      url={critic.url}
      linkTitle={critic.title}
      speaker={criticName(critic)}
      about={about}
      color={MUTED}
      avatar={{ name: criticAvatarName(critic), profilePath: null }}
      publication={critic.publication}
      year={criticYear(critic)}
      via={critic.via}
      background={criticBackground(critic)}
      highlighted={highlighted}
    />
  );
}

/**
 * A name in a quote's attribution: the button that opens that person's details in the slide-out panel (the people
 * column's `PersonBio`), or just the name when the person is not one the page has. Openers are white regardless of
 * the surrounding text.
 */
function BioName({ name, entry, onOpen }: { name: string; entry: BioPerson | null; onOpen: OpenPerson | undefined }) {
  if (!entry || !onOpen) return <>{name}</>;
  return <PersonBio person={entry.person} onOpen={onOpen} nameTrigger label={name} />;
}

/** Who the critics' quotes are about, in the short names `criticAbout` uses ("Spielberg & Williams"), each as a `BioName`. */
function CriticsAbout({
  people,
  bioPeople,
  onOpenPerson,
}: {
  people: readonly [ClippingsPerson, ClippingsPerson];
  bioPeople: readonly BioPerson[];
  onOpenPerson: OpenPerson | undefined;
}) {
  const names = headingNames(people, true);
  return (
    <>
      <BioName
        name={names[0]}
        entry={bioPeople.find((entry) => entry.person.id === people[0].id) ?? null}
        onOpen={onOpenPerson}
      />
      {" & "}
      <BioName
        name={names[1]}
        entry={bioPeople.find((entry) => entry.person.id === people[1].id) ?? null}
        onOpen={onOpenPerson}
      />
    </>
  );
}
