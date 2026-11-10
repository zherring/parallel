/**
 * Pair descriptions: a few sentences about a pair's collaboration, written by hand from sources that can be cited, for the pair hero at the
 * top of every view of a `/p/` page (see `pair-hero.ts`). They live in `PAIR_DESCRIPTIONS` below, keyed by the pair (`pairingKey`: the two TMDB
 * ids, sorted, joined with "+"), and only a page of exactly those two people shows one.
 *
 * Nothing here is generated or guessed, and the wording is fact-checked: it is not edited in passing. A pair without an entry has none, and the hero
 * falls back to the pair's quote or its one-line blurb, or shows nothing (see `pickHeroNote`); the pairs researched so far are the ones below.
 *
 * An entry's `sources` are the pages the text rests on, each a title and a link. The text cites them as Wikipedia does: an inline marker `[n]` points at
 * `sources[n - 1]`, and the hero sets each as a small superscript link to it (see `splitCitations` in `citations.ts`). Only `http` and `https` links are kept
 * (`getPairDescription` drops any other, so that a mistyped entry can never become a `javascript:` link).
 */

import { pairingKey } from "@/lib/examples";

/** One page a description rests on. */
export interface PairDescriptionSource {
  title: string;
  url: string;
}

/** A pair's description and where it comes from. */
export interface PairDescription {
  /** The sentences themselves: plain text, one paragraph. */
  text: string;
  sources: PairDescriptionSource[];
}

export type PairDescriptions = Record<string, PairDescription>;

/** The curated descriptions, by `pairingKey`. */
export const PAIR_DESCRIPTIONS: PairDescriptions = {
  "525+74401": {
    "text": "Van Hoytema took IMAX off the dolly and onto his shoulder.[1] Dunkirk pushed that into reactive, documentary-style coverage,[2] and by Oppenheimer Nolan wanted the heavy camera close on faces, plain and unadorned:[3] a spectacle format turned toward intimacy.",
    "sources": [
      {
        "title": "Interview: Interstellar cinematographer Hoyte van Hoytema (Den of Geek)",
        "url": "https://www.denofgeek.com/movies/interview-interstellar-cinematographer-hoyte-van-hoytema/"
      },
      {
        "title": "Dunkirk discussion with van Hoytema and Sasaki (American Society of Cinematographers)",
        "url": "https://theasc.com/news/dunkirk-discussion-at-asc-clubhouse-with-van-hoytema-and-sasaki"
      },
      {
        "title": "Filmmaker Stories: Oppenheimer (Kodak)",
        "url": "https://www.kodak.com/en/motion/blog-post/oppenheimer/"
      }
    ]
  },
  "3146+3147": {
    "text": "An outgoing director and a withdrawn writer, both émigrés with a dry wit and a taste for tangled deceptions.[1] Their comedies pit cynicism against sentiment until warmth wins, grown-up films for a family-minded Hollywood, though by the 1970s the satire had softened into nostalgia.[2]",
    "sources": [
      {
        "title": "The Big Idea: The Apartment (TCM)",
        "url": "https://www.tcm.com/articles/190950/the-big-idea-the-apartment"
      },
      {
        "title": "Diamond, I. A. L. (International Dictionary of Films and Filmmakers, via Encyclopedia.com)",
        "url": "https://www.encyclopedia.com/movies/dictionaries-thesauruses-pictures-and-press-releases/diamond-i-l"
      }
    ]
  },
  "6598+12147": {
    "text": "Adam's Rib rigs the contest so Tracy wins, yet Hepburn's face keeps contradicting the plot.[1] They play as rough equals, each teaching the other,[2] and by Guess Who's Coming to Dinner, made knowing it was their last, the sparring had become a farewell.[3]",
    "sources": [
      {
        "title": "At the Movies: Adam's Rib (Michael Wood, London Review of Books)",
        "url": "https://www.lrb.co.uk/v37/n05/michael-wood/at-the-movies"
      },
      {
        "title": "Comic Nourishment: Amanda McQueen on Adam's Rib (UW-Madison Cinematheque)",
        "url": "https://cinema.wisc.edu/2015/09/08/comic-nourishment-amanda-mcqueen-adams-rib/"
      },
      {
        "title": "New Movies: Integrated Hearts & Flowers (Time, 1967)",
        "url": "https://time.com/archive/6631483/new-movies-integrated-hearts-flowers"
      }
    ]
  },
  "117+224": {
    "text": "Cronenberg sends Shore each script early, then barely touches the score: by Shore's account he changed four bars of Dead Ringers.[1] On their cheap early films the studio itself was the instrument;[2] once The Fly brought studio money, budget set the scale.[1]",
    "sources": [
      {
        "title": "Howard Shore interview (Philip Brophy, Cinesonic)",
        "url": "https://philipbrophy.com/projects/cinesonic/howardshore.html"
      },
      {
        "title": "Sounds of the future: Howard Shore's scores for the films of David Cronenberg (BFI)",
        "url": "https://www.bfi.org.uk/features/sounds-future-howard-shores-scores-films-david-cronenberg"
      }
    ]
  },
  "638+11099": {
    "text": "Mann owned the frame and Spinotti the light,[1] building Heat's Los Angeles from the city's own sodium and mercury-vapor glow.[2] By Public Enemies they had traded film for HD and a sharper hyper-reality,[3] one some critics found too present for the 1930s.[4]",
    "sources": [
      {
        "title": "Dante Spinotti on Michael Mann's Preparedness (The Film Stage)",
        "url": "https://thefilmstage.com/dante-spinotti-on-michael-manns-preparedness-remastering-classics-and-new-technologies"
      },
      {
        "title": "Hot Set: Shooting Heat (American Cinematographer, 1996)",
        "url": "https://theasc.com/articles/hot-set-shooting-heat"
      },
      {
        "title": "Mann, Spinotti Choose Sony and Zeiss for Public Enemies (ProVideo Coalition)",
        "url": "https://www.provideocoalition.com/mann_spinotti_choose_sony_and_zeiss_for_public_enemies/"
      },
      {
        "title": "Director Defends Capturing 'Public Enemies' in HD (TV Technology)",
        "url": "https://www.tvtechnology.com/news/director-defends-capturing-public-enemies-in-hd"
      }
    ]
  },
  "11090+11108": {
    "text": "Wright and Pegg write as one hand, down to the stage directions,[1] paying off running jokes in threes.[2] Shaun of the Dead and Hot Fuzz raided the genres of their youth;[3] The World's End turned inward, casting Pegg as the arrested adolescent at the centre of the chaos.[2]",
    "sources": [
      {
        "title": "Shaun creators tackle Fuzz (The Georgia Straight)",
        "url": "https://www.straight.com/node/46768"
      },
      {
        "title": "Pegg, Frost and Wright on The World's End (The A.V. Club)",
        "url": "https://www.avclub.com/simon-pegg-nick-frost-and-director-edgar-wright-talk-1798240107"
      },
      {
        "title": "The World's End review (The Dissolve)",
        "url": "https://thedissolve.com/reviews/151-the-worlds-end/"
      }
    ]
  },
  "1337+12453": {
    "text": "Their partnership centers on one man grown over fourteen years.[1] A gambler in Days of Being Wild's last scene, meant to open a sequel that stalled, became In the Mood for Love's Chow Mo-wan,[2] then hardened into 2046's womanizing writer.[1]",
    "sources": [
      {
        "title": "2046 (Senses of Cinema)",
        "url": "https://www.sensesofcinema.com/2005/on-recent-films-35/2046/"
      },
      {
        "title": "Reexamining Wong Kar-wai's Days of Being Wild (The China Project)",
        "url": "https://thechinaproject.com/2020/11/13/wong-kar-wai-breakthrough-film-days-of-being-wild/"
      }
    ]
  },
  "190+4385": {
    "text": "Leone hired a cheap TV actor[1] who brought his own hat and poncho, and set him between panoramas and close-ups.[2] Over three films the scores and budgets swelled toward opera; Eastwood tired of Leone belittling his acting,[1] yet later dedicated a western partly to him.[3]",
    "sources": [
      {
        "title": "Cinema '67 Revisited: A Fistful of Dollars (Mark Harris, Film Comment)",
        "url": "https://www.filmcomment.com/blog/cinema-67-revisited-fistful-dollars/"
      },
      {
        "title": "Out of the Vaults: A Fistful of Dollars (The Film Foundation)",
        "url": "https://www.film-foundation.org/hfpa-fistful"
      },
      {
        "title": "Unforgiven (1992), AFI Catalog",
        "url": "https://catalog.afi.com/Film/67274-UNFORGIVEN"
      }
    ]
  },
  "7087+15347": {
    "text": "Bird hands Giacchino what his images can't finish: the 1960s spy sound John Barry declined to revisit,[1] given to a TV composer with no feature behind him.[2] Then Ratatouille's flavor, made audible,[3] and Tomorrowland's opening, planned together.[4]",
    "sources": [
      {
        "title": "Moriarty interviews Brad Bird (Ain't It Cool News, 2004)",
        "url": "http://legacy.aintitcool.com/node/18753"
      },
      {
        "title": "The Incredibles (2004), AFI Catalog",
        "url": "https://catalog.afi.com/Film/54376-THE-INCREDIBLES"
      },
      {
        "title": "Ratatouille tugs on taste buds, not heartstrings (The A.V. Club)",
        "url": "https://www.avclub.com/ratatouille-tugs-on-taste-buds-not-heartstrings-and-i-1843739260"
      },
      {
        "title": "Michael Giacchino Looks Back on Tomorrowland (D23)",
        "url": "https://d23.com/composer-michael-giacchino-looks-back-on-tomorrowland-10-years-later/"
      }
    ]
  }
};

/** Whether the address is one a link can safely point at: `http` or `https`, nothing else. */
export function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * The description of the pair with these TMDB ids in `data`, or null: when there are not exactly two people, when the pair has no entry, or
 * when its text is blank. Sources without a title or with a link that is not a web address are dropped. Split from `getPairDescription`
 * so that tests can hand it a small fixture.
 */
export function pairDescriptionFrom(data: PairDescriptions, ids: readonly number[]): PairDescription | null {
  if (ids.length !== 2) return null;
  const key = pairingKey({ people: ids.map((id) => ({ id, name: "" })) });
  const entry = Object.hasOwn(data, key) ? data[key] : undefined;
  const text = entry?.text?.trim();
  if (!entry || !text) return null;
  const sources = (Array.isArray(entry.sources) ? entry.sources : []).filter(
    (source) => source.title?.trim() && isWebUrl(source.url),
  );
  return { text, sources: sources.map((source) => ({ title: source.title.trim(), url: source.url })) };
}

/** The curated description of the pair with these TMDB ids (in any order), or null when it has none. */
export function getPairDescription(ids: readonly number[]): PairDescription | null {
  return pairDescriptionFrom(PAIR_DESCRIPTIONS, ids);
}
