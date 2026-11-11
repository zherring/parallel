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
  },
  "138781+1135102": {
    "text": "Eggers, who came up through drama and costume rather than photography, sets Blaschke a dark-interior problem in every film.[1][2] One fix carried forward: the cyan filter from The Lighthouse was reworked into a night-vision filter for The Northman's moonlit scenes.[3]",
    "sources": [
      {
        "title": "Director Robert Eggers on Nosferatu (American Cinematographer / ASC)",
        "url": "https://theasc.com/articles/robert-eggers-nosferatu"
      },
      {
        "title": "Nosferatu interview: Jarin Blaschke (Focus Features)",
        "url": "https://www.focusfeatures.com/article/nosferatu_interview_jarin-blaschke"
      },
      {
        "title": "The Northman (American Cinematographer / ASC)",
        "url": "https://theasc.com/articles/the-northman"
      }
    ]
  },
  "31+488": {
    "text": "Spielberg and Hanks were neighbors who traded history recommendations before working together,[1][2] so Saving Private Ryan began as two friends separately reading one script and agreeing to do it.[3] By Bridge of Spies, Spielberg was making the call, then asking for another take.[2]",
    "sources": [
      {
        "title": "Tom Hanks and Steven Spielberg interview (Daniel D'Addario, TIME, Oct. 6, 2015)",
        "url": "https://time.com/4062764/tom-hanks-steven-spielberg"
      },
      {
        "title": "Spielberg and Hanks collaborate once again in \"Bridge of Spies\" (CBS News, Oct. 15, 2015)",
        "url": "https://www.cbsnews.com/news/steven-spielberg-tom-hanks-talk-bridge-of-spies-collaboration"
      },
      {
        "title": "Saving Private Ryan (1998) (Sean Axmaker, Turner Classic Movies, Mar. 18, 2009)",
        "url": "https://www.tcm.com/articles/afi-top-100/235832/saving-private-ryan-1998"
      }
    ]
  },
  "5026+7450": {
    "text": "Kurosawa recast Mifune in Seven Samurai, swapping a grim master swordsman for a mercurial, comic rogue posing as a samurai,[1] giving his outsider heroes their wit and unpredictability.[2] Red Beard's nearly two-year shoot then kept Mifune from other films and bred friction between them.[1]",
    "sources": [
      {
        "title": "Toshiro Mifune (TCM article)",
        "url": "https://www.tcm.com/articles/021647/toshiro-mifune"
      },
      {
        "title": "Toshiro Mifune: 10 essential films (BFI)",
        "url": "https://www.bfi.org.uk/lists/toshiro-mifune-10-essential-films"
      }
    ]
  },
  "6648+11905": {
    "text": "Nykvist replaced Gunnar Fischer as Bergman's cinematographer from Through a Glass Darkly,[1] then traded stark contrast for soft, shadowless light.[2] By Cries and Whispers they agreed lighting should never announce itself, so Nykvist often used one source and avoided shadows, which draw the eye.[3]",
    "sources": [
      {
        "title": "Sven Nykvist (Ingmar Bergman Foundation)",
        "url": "https://ingmarbergman.se/en/node/805"
      },
      {
        "title": "Life and Legacy of Sven Nykvist, ASC, FSF (American Society of Cinematographers)",
        "url": "https://theasc.com/article/life-and-legacy-of-sven-nykvist-asc-fsf/"
      },
      {
        "title": "Beyond the Frame: Cries and Whispers (American Society of Cinematographers)",
        "url": "https://theasc.com/article/beyond-the-frame-cries-and-whispers/"
      }
    ]
  },
  "6856+11770": {
    "text": "Carpenter remade Russell's Disney image as the laconic Snake Plissken of Escape from New York,[1] and together they turned that toughness into bluster in Big Trouble in Little China, whose John Wayne-style blowhard is really Wang Chi's sidekick.[2] They built a hero, then deflated him.",
    "sources": [
      {
        "title": "Ranking the Carpenter/Russell Collaborations (Collider)",
        "url": "https://collider.com/ranking-the-carpenterrussell-collaborations/"
      },
      {
        "title": "Why Kurt Russell Channeled John Wayne for a Beloved Cult Classic (SlashFilm)",
        "url": "https://slashfilm.com/1800452/why-kurt-russell-channeled-john-wayne-big-trouble-in-little-china"
      }
    ]
  },
  "3098+4415": {
    "text": "Rota scored Fellini's solo features from 1952 to 1978,[1] yet worked from his own instincts, dozing through rough cuts and mostly ignoring the director's ideas.[2] His circus tunes put sadness beneath the comedy, and in 8½ blur whether the music belongs to the story.[2]",
    "sources": [
      {
        "title": "The many faces of Federico Fellini, part four: La famiglia Fellini (Sight and Sound, BFI)",
        "url": "https://www.bfi.org.uk/sight-and-sound/features/many-faces-federico-fellini-part-four-la-famiglia-fellini"
      },
      {
        "title": "Rota, Nino (classical-music.com)",
        "url": "https://www.classical-music.com/composers/rota-nino"
      }
    ]
  },
  "151+1223": {
    "text": "Barton Fink revived Deakins's interest in cinematography,[1] and by Hail, Caesar! the partnership had hardened into shorthand:[1] he joins scouting early, the Coens arrive with firm ideas of the look, and the set grows quieter.[2] Their plan meets his instinct, and little needs saying.[2]",
    "sources": [
      {
        "title": "Interview: Roger Deakins (Film Comment)",
        "url": "https://www.filmcomment.com/interview-roger-deakins/"
      },
      {
        "title": "RT interview: Roger Deakins on No Country for Old Men (Rotten Tomatoes editorial, Joanna Cohen)",
        "url": "https://editorial.rottentomatoes.com/article/rt-interview-roger-deakins-on-no-country-for-old-men"
      }
    ]
  },
  "287+7467": {
    "text": "On Fight Club, Pitt brought ideas, helping rework the script[1] and proposing the dishwashing glove,[2] while Fincher reined in Tyler's flash.[1] By Benjamin Button, restraint had won: the frenzy of Pitt's first two Fincher roles gave way to stillness beneath makeup and effects.[3]",
    "sources": [
      {
        "title": "The Ringer: Fight Club oral/making-of piece (Pitt, Norton, Fincher)",
        "url": "https://www.theringer.com/movies/2019/3/26/18281406/fight-club-davis-fincher-making-of-brad-pitt-edward-norton"
      },
      {
        "title": "7 Things We Learned From David Fincher's Playboy Interview (Yahoo, Sept 2014 recap of Playboy's October 2014 interview)",
        "url": "https://www.yahoo.com/entertainment/7-things-we-learned-from-david-finchers-playboy-97690824277.html"
      },
      {
        "title": "The A.V. Club: David Fincher helped Brad Pitt rehearse for a middle-aged renaissance",
        "url": "https://avclub.com/david-fincher-helped-brad-pitt-rehearse-for-a-middle-ag-1837064833"
      }
    ]
  },
  "947+137427": {
    "text": "On Blade Runner 2049, Zimmer was a reluctant recruit who first declined, then wrote in deference to Vangelis's original.[1] By Dune he was Villeneuve's first call, experimenting for over a year,[2] without ever seeing a script,[3] so the score starts as a place.",
    "sources": [
      {
        "title": "Hans Zimmer and Benjamin Wallfisch on scoring Blade Runner 2049 (FACT Magazine, 20 Oct 2017)",
        "url": "https://factmag.com/2017/10/20/hans-zimmer-wallfisch-blade-runner-2049-interview"
      },
      {
        "title": "Hans Zimmer on 'Dune' Score's Electronic Textures and Made-Up Choral Language... and His Head Start on Part 2 (Variety, Jon Burlingame, 21 Oct 2021; Yahoo syndication)",
        "url": "https://www.yahoo.com/news/hans-zimmer-dune-score-electronic-180325854.html"
      },
      {
        "title": "Dune: Part Two - Hans Zimmer designs the sound of sand (Wallpaper*)",
        "url": "https://wallpaper.com/art/dune-part-two-hans-zimmer-designs-the-sound-of-sand-exclusive-interview"
      }
    ]
  },
  "7879+7885": {
    "text": "Lasseter chose Newman because he never talked down to an audience, and told him to treat the characters' feelings as grown-up ones.[1][2] Newman's sardonic sincerity defined Toy Story's songs, but by A Bug's Life the job had swollen to roughly triple an ordinary score.[2][3]",
    "sources": [
      {
        "title": "uDiscover Music: Randy Newman's Pixar work (Lasseter on choosing Newman for Toy Story and calling him back for A Bug's Life)",
        "url": "https://www.udiscovermusic.com/?p=2748837"
      },
      {
        "title": "The Ringer: Pixar music, Randy Newman and Michael Giacchino (June 15, 2022)",
        "url": "https://www.theringer.com/2022/06/15/movies/pixar-music-soundtracks-randy-newman-michael-giacchino"
      },
      {
        "title": "American Songwriter: Randy Newman on the Oscars (2006 interview on scoring animation)",
        "url": "https://americansongwriter.com/randy-newman-on-the-oscars/"
      }
    ]
  },
  "3186+142391": {
    "text": "Reznor and Ross put music before picture. The Social Network score started from a script with no footage;[1] they send directors up to ninety minutes of music before tying any to scenes;[2] Soul's themes took shape while sequences were still being cut.[3]",
    "sources": [
      {
        "title": "Trent Reznor went the distance for David Fincher in scoring The Social Network, he tells John Hazelton (Screen Daily, 22 Dec 2010)",
        "url": "https://www.screendaily.com/trent-reznor-composer-the-social-network/5021862.article"
      },
      {
        "title": "Trent Reznor and Atticus Ross on scoring Watchmen, David Fincher and their upcoming Pixar film (Awards Daily, 29 May 2020)",
        "url": "https://www.awardsdaily.com/2020/05/29/trent-reznor-and-atticus-ross-on-scoring-watchmen-david-fincher-and-their-upcoming-pixar-film"
      },
      {
        "title": "Soul: How Nine Inch Nails Scored the New Pixar Movie (Den of Geek)",
        "url": "https://www.denofgeek.com/movies/soul-how-nine-inch-nails-scored-pixar-movie/"
      }
    ]
  },
  "4185+30715": {
    "text": "From their first film, Lubezki traded studio control for waiting on natural light,[1] and on The Tree of Life he let go inside a world Malick had built.[2] By Knight of Cups he shot without reading the script, judging scenes by Malick's expression.[3]",
    "sources": [
      {
        "title": "How Emmanuel Lubezki became the world's most… (Little White Lies)",
        "url": "https://lwlies.com/article/emmanuel-lubezki-the-revenant"
      },
      {
        "title": "Influencers: Emmanuel Lubezki, the Breathing Lens (IndieWire Influencers, via Yahoo)",
        "url": "https://www.yahoo.com/entertainment/influencers-emmanuel-lubezki-breathing-lens-161050744.html"
      },
      {
        "title": "Emmanuel Lubezki interview (ScreenCrush)",
        "url": "https://screencrush.com/emmanuel-lubezki-interview/"
      }
    ]
  },
  "4165+8500": {
    "text": "Ford pulled Wayne out of B-westerns with one 1939 picture and made him a star,[1][3] then turned the image he had built on the country's darker side.[1] The Searchers fills the hero with racial hatred; Liberty Valance has him make himself irrelevant.[2]",
    "sources": [
      {
        "title": "John Ford and John Wayne: Pappy and the Duke (American Masters, PBS)",
        "url": "https://www.pbs.org/wnet/americanmasters/john-ford-and-john-wayne-pappy-and-the-duke/594/"
      },
      {
        "title": "John Ford: 10 essential films (BFI)",
        "url": "https://www.bfi.org.uk/lists/john-ford-10-essential-films"
      },
      {
        "title": "Stagecoach (1939), The Essentials (Turner Classic Movies)",
        "url": "https://www.tcm.com/articles/24127/the-essentials-10-12"
      }
    ]
  },
  "569+1146": {
    "text": "By Before Midnight, Hawke and Delpy were writing Jesse and Celine with Linklater, not just playing them, in a Greek hotel room,[1] and the script drew an Oscar nomination.[2] Hawke says each polices the other's self-absorption, the friction that keeps the couple's talk honest.[1]",
    "sources": [
      {
        "title": "Q&A: Ethan Hawke on The Purge, Before Midnight, His Relationship with Richard Linklater, and Picking the Right Genre Movies (Grantland)",
        "url": "https://grantland.com/hollywood-prospectus/qa-ethan-hawke-on-the-purge-before-midnight-his-relationship-with-richard-linklater-and-picking-the-right-genre-movies/"
      },
      {
        "title": "Meet the Oscar Nominees: Before Midnight (Sundance Institute)",
        "url": "https://www.sundance.org/blogs/meet-the-oscar-nominees-before-midnight-3/"
      }
    ]
  },
  "291263+1761126": {
    "text": "Peele's notes to Abels often ask for less: silence as part of the score from their first conversation,[1] a held-back cue so a scare isn't telegraphed,[2] a rhythm too danceable to frighten.[3] Abels's reply is score that blurs into sound design.[1]",
    "sources": [
      {
        "title": "\"Nope\" Composer Michael Abels on Scoring Jordan Peele's Sci-Fi Epic (The Credits, Motion Picture Association)",
        "url": "https://www.motionpictures.org/2022/08/nope-composer-michael-abels-on-scoring-jordan-peeles-sci-fi-epic/"
      },
      {
        "title": "Us composer Michael Abels interview (Collider)",
        "url": "https://collider.com/us-composer-michael-abels-interview/"
      },
      {
        "title": "How composer Michael Abels created a soundtrack of horror for Nope (Academy of Motion Picture Arts and Sciences newsletter)",
        "url": "https://newsletter.oscars.org/news/post/how-composer-michael-abels-created-a-soundtrack-of-horror-for-nope-exclusive"
      }
    ]
  },
  "3460+14639": {
    "text": "Wilder began as an actor in Brooks's Producers script,[1][2] then conceived Young Frankenstein and got first writing credit, something Brooks says he never gives.[1] Their fight over its song-and-dance number inverted the roles: Wilder pushed for it, and Brooks, directing, called it frivolous before conceding.[3]",
    "sources": [
      {
        "title": "Mel Brooks interview, PBS American Masters",
        "url": "https://www.pbs.org/wnet/americanmasters/archive/interviews/312"
      },
      {
        "title": "Mel Brooks, TCM Featured Directors",
        "url": "https://www.tcm.com/articles/featured-directors/022054/mel-brooks"
      },
      {
        "title": "A Fresh Air Halloween treat: Revisiting Young Frankenstein (NPR Fresh Air, via UA Little Rock Public Radio)",
        "url": "https://www.ualrpublicradio.org/2025-10-31/a-fresh-air-halloween-treat-revisiting-young-frankenstein"
      }
    ]
  },
  "2710+10205": {
    "text": "Cameron twice wrote Weaver as a woman the men in power refuse to believe, in Aliens and Avatar.[1] Off camera he listened: she got him to stop yelling at a struggling actress,[2] and decades later he cast her as a 14-year-old.[3]",
    "sources": [
      {
        "title": "Aliens and Avatar link Cameron, Weaver (The Philadelphia Inquirer, Dec 18, 2009)",
        "url": "https://www.inquirer.com/philly/entertainment/20091218__Aliens_____Avatar__link_Cameron___Weaver.html"
      },
      {
        "title": "Sigourney Weaver fought James Cameron over yelling on Aliens (Variety Australia, reporting her New York Times interview)",
        "url": "https://au.variety.com/2025/film/news/sigourney-weaver-fought-james-cameron-yelling-aliens-31440"
      },
      {
        "title": "Sigourney Weaver, James Cameron float on in Way of Water (AP, Jake Coyle, via Spectrum Bay News 9, Dec 13, 2022)",
        "url": "https://baynews9.com/fl/tampa/ap-online/2022/12/13/sigourney-weaver-james-cameron-float-on-in-way-of-water"
      }
    ]
  },
  "2746+3084": {
    "text": "Streetcar gave Brando menace without doubt, a Stanley who never questions himself.[2][3] On the Waterfront, made after Kazan's HUAC testimony frayed their relationship,[2] turned that body toward Terry Malloy's tenderness, self-doubt and inner life;[1][2] their most inward film came when they were most strained.",
    "sources": [
      {
        "title": "Birth of the Method: the revolution in American acting (Sight and Sound, BFI)",
        "url": "https://www.bfi.org.uk/sight-and-sound/features/birth-method-revolution-american-acting"
      },
      {
        "title": "Profile: Kazan and On the Waterfront (DGA Quarterly, Fall 2005)",
        "url": "https://www.dga.org/craft/dgaq/issues/0503-fall-2005/profile-kazan-waterfront"
      },
      {
        "title": "A Streetcar Named Desire Brings Method Acting to the Screen (EBSCO Research Starters)",
        "url": "https://www.ebsco.com/research-starters/film/streetcar-named-desire-brings-method-acting-screen"
      }
    ]
  },
  "607+643": {
    "text": "Zhang first made Gong Li's face the event, her Red Sorghum close-ups unprecedented on the mainland.[1] Later The Story of Qiu Ju cast her as a pregnant, illiterate farm woman chasing an apology through bureaucracy,[2] showing that face could carry grievance, not only desire.[1][2]",
    "sources": [
      {
        "title": "Zhang Yimou (Great Directors), Senses of Cinema, 2002",
        "url": "https://www.sensesofcinema.com/2002/great-directors/zhang/"
      },
      {
        "title": "Jonathan Spence, review of The Story of Qiu Ju (The New York Review of Books, Vol. 40, No. 12, June 24, 1993; copy hosted by the University of Washington)",
        "url": "https://courses.washington.edu/lit312/Spence-Qiu%20Ju.htm"
      }
    ]
  },
  "13524+26510": {
    "text": "Guest brought the premise and direction; Levy brought doubt, unsure how Best in Show would sustain a third act.[2] Their method, an outline with no written dialogue, held from Waiting for Guffman on,[1] and Levy later called the films predictably alike, their run likely over.[3]",
    "sources": [
      {
        "title": "Christopher Guest and Eugene Levy (The A.V. Club, Dec. 14, 2006)",
        "url": "https://www.avclub.com/christopher-guest-and-eugene-levy-1798210497"
      },
      {
        "title": "Best in Show oral history (The Ringer, Sept. 29, 2020)",
        "url": "https://www.theringer.com/2020/9/29/21500/best-in-show-oral-history"
      },
      {
        "title": "Eugene Levy says Christopher Guest collaborations likely finished (Deadline report on a Guardian interview, March 2023, as republished by Yahoo News Canada)",
        "url": "https://ca.news.yahoo.com/eugene-levy-says-christopher-guest-004355895.html"
      }
    ]
  },
  "1619+11401": {
    "text": "Woo saw Cary Grant's elegance in how Chow moves,[1] and kept pointing that grace at killing. Their first film's doomed gangster gave way to The Killer's charming assassin,[2] and Hard Boiled, one critic's candidate for their best, has him crooning a lullaby mid-gunfight.[3]",
    "sources": [
      {
        "title": "\"I use musical theory to shoot an action sequence\": an exclusive online interview with John Woo (BFI)",
        "url": "https://www.bfi.org.uk/interviews/john-woo-i-use-musical-theory-shoot-action-sequence"
      },
      {
        "title": "Heroic Bloodshed: how Hong Kong's style was swiped by Hollywood (BFI)",
        "url": "https://www.bfi.org.uk/features/heroic-bloodshed-hong-kong-hollywood-cycle-influence"
      },
      {
        "title": "The Incomparable Charisma of Chow Yun-fat (Adrian Martin, 1998)",
        "url": "https://adrianmartinfilmcritic.com/essays/chow_yun_fat.html"
      }
    ]
  },
  "1060+11770": {
    "text": "Carpenter let dark areas sit in the frame and valued showing as much as speaking,[3] and Cundey, whose anamorphic pitches other directors resisted, found in him a taker.[1] Their look traveled from Halloween's hazy realism to Big Trouble's soundstage San Francisco, faked under silk.[1][2]",
    "sources": [
      {
        "title": "Photographing The Thing (American Cinematographer flashback)",
        "url": "https://theasc.com/article/flashback-the-thing/"
      },
      {
        "title": "Big Trouble in Little China (American Cinematographer)",
        "url": "https://theasc.com/articles/big-trouble-in-little-china"
      },
      {
        "title": "The Den of Geek interview: Dean Cundey",
        "url": "https://www.denofgeek.com/movies/the-den-of-geek-interview-dean-cundey/"
      }
    ]
  },
  "7467+7479": {
    "text": "Fincher valued Cronenweth as someone who needed no handholding, sending him off alone on second unit before giving him his first feature, Fight Club.[2] There they underexposed faces together;[1] on The Social Network they tested cameras until the end, his first full plunge into digital.[3]",
    "sources": [
      {
        "title": "Fight Club: Anarchy in the U.S.A. (American Cinematographer, November 1999; ASC web reprint)",
        "url": "https://theasc.com/article/flashback-fight-club/"
      },
      {
        "title": "Jeff Cronenweth, ASC: An Adventurous Eye (American Cinematographer, Jon Silberg, 2022)",
        "url": "https://theasc.com/article/cronenweth-adventurous-eye/"
      },
      {
        "title": "Tales From the Loop: Strange Machines (American Cinematographer, Jamie Stuart, April 2020)",
        "url": "https://theasc.com/article/tales-from-the-loop-strange-machines/"
      }
    ]
  },
  "10099+10107": {
    "text": "Park dislikes total darkness, so Chung places small lights that keep eyes legible in his shadows.[1] Other directors ask Chung for Oldboy-style scenes, which he calls hard to achieve,[2] and on Stoker, his American debut,[3] Hollywood's pace thinned Park's usually heavy storyboards.[1]",
    "sources": [
      {
        "title": "Hangul Celluloid group interview with Chung Chung-hoon, London Korean Links (recorded 30 May 2014 at the Korean Cultural Centre UK; posted 3 June 2014)",
        "url": "https://londonkoreanlinks.net/?p=206979"
      },
      {
        "title": "Korean cinematographer infuses 'Oldboy' style into Disney+'s new Star Wars spin-off series, The Korea Times (Yonhap), 14 June 2022",
        "url": "https://www.koreatimes.co.kr/amp/entertainment/shows-dramas/20220614/korean-cinematographer-infuses-oldboy-style-into-disneys-new-star-wars-spin-off-series"
      },
      {
        "title": "ASC Welcomes Chung-hoon Chung as New Member, American Cinematographer / theasc.com, 5 October 2023",
        "url": "https://theasc.com/news/asc-welcomes-chung-hoon-chung-new-member/"
      }
    ]
  },
  "3151+6837": {
    "text": "In The Fortune Cookie, Wilder played Lemmon's jittery everyman off Matthau's simmering, scheming shyster, and the friction was the act.[1] By Grumpy Old Men, one obituarist thought both had hardened into caricatures,[2] yet Matthau put that runaway hit down to the pair's sniping.[3]",
    "sources": [
      {
        "title": "The Fortune Cookie (Rob Nixon, TCM, 2003)",
        "url": "https://www.tcm.com/articles/62599/the-fortune-cookie"
      },
      {
        "title": "Part in The Odd Couple seemed to have been written for him (Matthau obituary, The Irish Times, 8 July 2000)",
        "url": "https://www.irishtimes.com/news/part-in-the-odd-couple-seemed-to-have-been-written-for-him-1.290526"
      },
      {
        "title": "Grumpy Old Men (Eleanor Quin, TCM, 2006)",
        "url": "https://www.tcm.com/articles/138993/grumpy-old-men"
      }
    ]
  },
  "85+510": {
    "text": "Burton and Depp bonded as horror-obsessed childhood outsiders,[1] and Ed Wood gave Depp a director whose devotion to Bela Lugosi mirrored Burton's own to Vincent Price.[2] Once Depp became a star, one critic argues, his persona drove the films more than Burton's sensibility did.[3]",
    "sources": [
      {
        "title": "Snoopy Dances: Johnny Depp interview (Jeffrey M. Anderson, Combustible Celluloid, Nov. 12, 1999)",
        "url": "https://combustiblecelluloid.com/intdepp.shtml"
      },
      {
        "title": "Ed Wood (Lang Thompson, TCM, Feb. 26, 2003)",
        "url": "https://www.tcm.com/articles/21318/ed-wood"
      },
      {
        "title": "Shadows of Greatness: How Tim Burton and Johnny Depp Lost Their Way (Steven Hyden, Grantland, May 2012)",
        "url": "https://grantland.com/hollywood-prospectus/shadows-of-greatness-how-tim-burton-and-johnny-depp-lost-their-way/"
      }
    ]
  },
  "1150+14138": {
    "text": "De Palma hired Donaggio to replace Bernard Herrmann,[1] and one critic argues the Herrmann-style writing muted the lyricism Donaggio arrived with.[3] Yet Carrie's gentle theme[1] and the Blow Out aria De Palma prizes[2] suggest it survived alongside the Psycho-like string stabs.[1]",
    "sources": [
      {
        "title": "Scores On Screen. Telekinetic Tunes: Pino Donaggio's Score for Brian De Palma's \"Carrie\" (Clare Nina Norelli, MUBI Notebook, 25 Sep 2017)",
        "url": "https://mubi.com/notebook/posts/scores-on-screen-telekinetic-tunes-pino-donaggio-s-score-for-brian-de-palma-s-carrie"
      },
      {
        "title": "Pino Donaggio, una sinfonia lunga ottant'anni (Luca Barnabé, Rolling Stone Italia, 24 Nov 2021)",
        "url": "https://www.rollingstone.it/?p=599044"
      },
      {
        "title": "Donaggio, Pino (Richard R. Ness, updated by John McCarty, International Dictionary of Films and Filmmakers, via Encyclopedia.com)",
        "url": "https://encyclopedia.com/movies/dictionaries-thesauruses-pictures-and-press-releases/donaggio-pino"
      }
    ]
  },
  "15488+15490": {
    "text": "A request for scene drafts became near-daily talk between friends, with drafts traded until Laverty has a script.[1][2] Laverty does the fieldwork, approaching delivery drivers in car parks;[1] on The Old Oak, he traced decline to the 1984 strike while Loach asked how people cope.[3]",
    "sources": [
      {
        "title": "INTERVIEW: \"Sorry We Missed You\" Screenwriter Paul Laverty (Script Magazine)",
        "url": "https://scriptmag.com/interviews-features/interview-sorry-we-missed-you-screenwriter-paul-laverty"
      },
      {
        "title": "Ken Loach on Sorry We Missed You: \"I want to be part of the world, not somehow locked away\" (BFI)",
        "url": "https://www.bfi.org.uk/interviews/ken-loach-interview-sorry-we-missed-you"
      },
      {
        "title": "The Old Oak, the third politically engaged installment from Ken Loach and Paul Laverty (Festival de Cannes)",
        "url": "https://www.festival-cannes.com/en/2023/the-old-oak-the-third-politically-engaged-installment-from-ken-loach-and-paul-laverty/"
      }
    ]
  },
  "1158+1776": {
    "text": "Coppola fought Paramount to cast Pacino,[1] then kept trying to punish the magnetic Michael Pacino built: Part II made him seem omnipotent, Part III shrank him into guilty failure.[2] Pacino reads the recut's ending as an idea dying, not a man.[3]",
    "sources": [
      {
        "title": "Al Pacino: 'The Godfather gave me a new identity that was hard to cope with' (Dave Itzkoff interview, The Irish Times, 14 Mar 2022)",
        "url": "https://www.irishtimes.com/culture/film/al-pacino-the-godfather-gave-me-a-new-identity-that-was-hard-to-cope-with-1.4826263"
      },
      {
        "title": "Jonathan Rosenbaum, 'The Family That Preys Together' (Chicago Reader review of The Godfather Part III, 18 Jan 1991; reposted on the author's site)",
        "url": "https://jonathanrosenbaum.net/?p=7367"
      },
      {
        "title": "Bryan Alexander, Al Pacino on major changes to re-edited 'Godfather III,' Michael Corleone's death and guilt over Fredo (USA TODAY, 5 Dec 2020, via Yahoo)",
        "url": "https://www.yahoo.com/entertainment/al-pacino-major-changes-edited-130026716.html"
      }
    ]
  },
  "6384+9340": {
    "text": "For The Matrix, the Wachowskis prepared Reeves like a student, with a reading list and months under a Hong Kong choreographer.[1] Directing Resurrections solo, Lana chose shooting over rehearsing scenes,[2][3] while Reeves drilled on wires to make the rooftop leap himself, trust replacing apprenticeship.[3]",
    "sources": [
      {
        "title": "The Matrix: how the Wachowskis changed sci-fi (BFI)",
        "url": "https://www.bfi.org.uk/features/matrix-wachowskis-keanu-reeves"
      },
      {
        "title": "Keanu Reeves says 'The Matrix: Resurrections' cast and crew 'barely rehearsed, if at all' on set (Insider, relaying an Entertainment Weekly interview; syndicated on Yahoo)",
        "url": "https://www.yahoo.com/news/keanu-reeves-says-matrix-resurrections-162832277.html"
      },
      {
        "title": "Back to the Matrix (American Cinematographer / ASC)",
        "url": "https://theasc.com/articles/back-to-the-matrix"
      }
    ]
  },
  "10828+17005": {
    "text": "Del Toro kept Jones's business card until Hellboy's Abe Sapien designs resembled him,[1] and the two built a shorthand of gestures and sounds.[3] By The Shape of Water, casting by silhouette had become casting by acting, with Jones as the film's romantic lead.[2]",
    "sources": [
      {
        "title": "He Who Awakens Dreams: An Interview with Doug Jones (Matthew Sorrento, Film International, July 2014)",
        "url": "https://filmint.nu/he-who-awakens-dreams-an-interview-with-doug-jones-matthew-sorrento/"
      },
      {
        "title": "Doug Jones on The Shape of Water (Maria Lewis, ACMI, May 2022)",
        "url": "https://www.acmi.net.au/stories-and-ideas/doug-jones-interview-shape-of-water/"
      },
      {
        "title": "Shape of Water creature actor understands the monsters (KQED, republished from NPR, March 2018)",
        "url": "http://www.kqed.org/arts/13826205/shape-of-water-creature-actor-understands-the-monsters"
      }
    ]
  },
  "380+1158": {
    "text": "In Heat they play equals who barely interact across three hours.[1] In The Irishman, Pacino's combative, charming Hoffa trusts De Niro's unreadable Sheeran, his bodyguard, enough to wear pyjamas in front of him, and that closeness makes the eventual betrayal land.[2]",
    "sources": [
      {
        "title": "In Heat, Al Pacino and Robert De Niro face off—though not in the way audiences expected (The A.V. Club)",
        "url": "https://www.avclub.com/in-heat-al-pacino-and-robert-de-niro-face-off-though-n-1798238740"
      },
      {
        "title": "The Irishman review: De Niro and Scorsese say goodbye to the goodfellas (BFI, Sight and Sound)",
        "url": "https://www.bfi.org.uk/sight-and-sound/reviews/irishman-review-de-niro-scorsese-say-goodbye-goodfellas"
      }
    ]
  },
  "2461+20629": {
    "text": "Miller used Gibson as a face for myth, taking Max from Mad Max 2's reluctant outcast to Beyond Thunderdome's messiah.[1] Two bids to reunite on a fourth film died, first on post-9/11 budget losses, then Gibson's troubles; Tom Hardy took Max.[2]",
    "sources": [
      {
        "title": "George Miller (Senses of Cinema, Great Directors, issue 83, by James Robert Douglas, 2017)",
        "url": "https://www.sensesofcinema.com/2017/great-directors/george-miller/"
      },
      {
        "title": "Why a fourth 'Mad Max' film with Mel Gibson failed to get made... twice (Yahoo Entertainment, Kevin Polowy, 18 Feb 2016)",
        "url": "https://uk.finance.yahoo.com/news/why-a-fourth-mad-max-film-with-mel-gibson-failed-223848629.html"
      }
    ]
  },
  "1145520+1650351": {
    "text": "Since meeting at AFI in 2008,[1] they have split the work between plan and gut: Aster arrives with a clear vision and references, Pogorzelski answers with camera and lens tests.[2] First he reads each script as a viewer, bringing emotional notes to Aster.[3]",
    "sources": [
      {
        "title": "Interview: Cinematographer Pawel Pogorzelski on Working with Ari Aster to Create HEREDITARY (Daily Dead)",
        "url": "https://dailydead.com/interview-cinematographer-pawel-pogorzelski-on-working-with-ari-aster-to-create-hereditary/"
      },
      {
        "title": "Journey of Extremes (Panavision, on Beau Is Afraid)",
        "url": "https://www.panavision.com/highlights/highlights-detail/journey-of-extremes"
      },
      {
        "title": "Behind the Look with Pawel Pogorzelski (RED Digital Cinema)",
        "url": "https://www.reddigitalcinema.com/stories/behind-the-look-with-pawel-pogorzelski"
      }
    ]
  },
  "2036+1162217": {
    "text": "On Annihilation, Garland rehearsed with the actors, then asked Hardy how to shoot each scene, deferring when they disagreed.[1] By Civil War the asking had become shorthand: no storyboards or previs, and a shared taste for shooting fast and finding shots on the day.[2]",
    "sources": [
      {
        "title": "Annihilation: Expedition Unknown (American Cinematographer, Mark Dillon, March 12, 2018)",
        "url": "https://theasc.com/article/annihilation-expedition-unknown/"
      },
      {
        "title": "Civil War: Chronicling Chaos (American Cinematographer / ASC)",
        "url": "https://theasc.com/articles/civil-war-chronicling-chaos"
      }
    ]
  },
  "5026+7453": {
    "text": "Kurosawa cast Shimura in his first film and kept casting him, in large roles and small, through 1980: Ikiru's dying bureaucrat,[1] Seven Samurai's shrewd calm against Mifune's bluster.[2] Late on, Kurosawa kept the ailing actor's part small, fearing a bigger one would break him.[3]",
    "sources": [
      {
        "title": "Ikiru (1952), by Scott McGee, Turner Classic Movies",
        "url": "https://www.tcm.com/articles/international/290046/ikiru-1952"
      },
      {
        "title": "Kurosawa in Action, by Gary Giddins, DGA Quarterly (Fall 2006)",
        "url": "https://www.dga.org/craft/dgaq/issues/0603-fall-2006/dvd-classics-akira-kurosawa"
      },
      {
        "title": "Kagemusha, by Scott McGee, Turner Classic Movies",
        "url": "https://www.tcm.com/articles/235854/kagemusha"
      }
    ]
  },
  "15810+15813": {
    "text": "On The Little Mermaid, Menken and Ashman's Broadway instincts reorganized the film around songs, and Clements and Musker helped defend Ariel's ballad.[1] Menken says that partnership ended with Ashman,[2] and by Hercules the directors were steering him, pushing his Candide-style plan toward gospel.[3]",
    "sources": [
      {
        "title": "'The Little Mermaid' Launched Disney Animation Into a New Era By Embracing the Past - and Broadway Musicals (/Film)",
        "url": "https://www.slashfilm.com/566841/the-little-mermaid-revisited/"
      },
      {
        "title": "Composer Alan Menken interview: Aladdin (Moviefone)",
        "url": "https://www.moviefone.com/2019/05/22/composer-alan-menken-interview-aladdin/"
      },
      {
        "title": "'Hercules': The Music Of Disney's Animated Greek Tale (uDiscover Music)",
        "url": "https://www.udiscovermusic.com/stories/hercules-disney-music-animated-film-soundtrack-feature"
      }
    ]
  },
  "1461+1884": {
    "text": "Soderbergh's restraint turned Clooney, fresh off a run of flops, into a star with Cary Grant ease in Out of Sight.[1][3] Ocean's Eleven became one of the few real hits for their company, Section Eight, whose other films were mostly small passion projects that missed.[2]",
    "sources": [
      {
        "title": "Michael Tedder, The Ringer, June 26, 2020, on Out of Sight, Clooney and Soderbergh (headline not captured by the fetch)",
        "url": "https://theringer.com/2020/06/26/movies/out-of-sight-george-clooney-steven-soderbergh"
      },
      {
        "title": "The New York Times, January 18, 2005, on Section Eight (read on the Steven Soderbergh Online fan-site mirror; author not shown)",
        "url": "https://www.stevensoderbergh.net/articles/2005/nytimes.php"
      },
      {
        "title": "Aleksandrs Rozens, Reuters, December 28, 2000, on Soderbergh and Clooney (read on the Steven Soderbergh Online fan-site mirror)",
        "url": "https://stevensoderbergh.net/articles/2000/reuters.php"
      }
    ]
  },
  "1231+16863": {
    "text": "In Safe, Haynes cast Moore for a restraint so complete that wide, empty frames could swallow Carol White.[1] By May December she supplies the pattern itself, her invented lisp and manner the template Natalie Portman's character copies.[2][3]",
    "sources": [
      {
        "title": "Nowhere to hide: Todd Haynes on [Safe] (Sight and Sound, BFI)",
        "url": "https://bfi.org.uk/sight-and-sound/interviews/todd-haynes-safe-1996"
      },
      {
        "title": "How Julianne Moore Made Her May December Character Her Own (W Magazine)",
        "url": "https://wmagazine.com/culture/julianne-moore-may-december-interview"
      },
      {
        "title": "Cannes: Todd Haynes on 'May December' and Re-Teaming With Julianne Moore (The Hollywood Reporter, via Yahoo News UK)",
        "url": "https://uk.news.yahoo.com/cannes-todd-haynes-may-december-061500817.html"
      }
    ]
  },
  "893+5292": {
    "text": "Scott's look drifted from rain-slick gloss to grainy, strobing excess while Washington stayed the steady center.[1] In Man on Fire the smeared image mirrors Creasy's rage,[2] and by Unstoppable that steadiness was physical: Washington learned to drive a train, while Scott sometimes ran a dozen-plus cameras.[3]",
    "sources": [
      {
        "title": "Denzel Washington becomes a popcorn hero for director Tony Scott (Jesse Hassenger, The A.V. Club, Oct. 3, 2016)",
        "url": "https://avclub.com/denzel-washington-becomes-a-popcorn-hero-for-director-t-1798252510"
      },
      {
        "title": "Man on Fire Turned Mexico City Into a War Zone 20 Years Ago (Kenneth Lowe, Paste, Apr. 24, 2024)",
        "url": "https://www.pastemagazine.com/movies/denzel-washington/man-on-fire-denzel-washington-tony-scott-revenge"
      },
      {
        "title": "'Speed' on Speed: The Making of 'Unstoppable,' 10 Years Later (The Ringer, Nov. 12, 2020)",
        "url": "https://www.theringer.com/movies/2020/11/12/21560294/unstoppable-tony-scott-legacy-making-of-10th-anniversary"
      }
    ]
  },
  "31+5344": {
    "text": "Their chemistry is built on distance. In Sleepless in Seattle they share no scene until the final one,[1] Hanks's father-son drama running alongside Ryan's romance,[2] and in You've Got Mail they are business rivals face to face who connect romantically while anonymous online.[3]",
    "sources": [
      {
        "title": "How 'Sleepless in Seattle' and Nora Ephron changed romantic comedies 25 years ago (ABC News)",
        "url": "https://abcnews.com/culture/story/sleepless-seattle-nora-ephron-changed-romantic-comedies-25-56092785"
      },
      {
        "title": "25 years ago, Sleepless In Seattle found the romantic hiding in the cynic (The A.V. Club)",
        "url": "https://www.avclub.com/25-years-ago-sleepless-in-seattle-found-the-romantic-h-1826855118"
      },
      {
        "title": "You've Got Mail (1998) (AFI Movie Club)",
        "url": "https://www.afi.com/news/youve-got-mail-afi-movie-club/"
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
