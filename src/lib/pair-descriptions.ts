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
  },
  "854+2636": {
    "text": "Stewart reportedly vowed after Rope never to work with Hitchcock again,[1] yet he took their next picture on a treatment alone[2] and by Vertigo was playing a protector turned obsessive.[3] Hitchcock's trick was to spend Stewart's trusted goodness, not replace it.",
    "sources": [
      {
        "title": "Rope Was a Cruel, Prickly Turning Point in Jimmy Stewart's Career (Chloe Walker, Paste Magazine, Aug 25, 2023)",
        "url": "https://www.pastemagazine.com/movies/alfred-hitchcock/rope-alfred-hitchcock-jimmy-stewart"
      },
      {
        "title": "Hitchcock's Techniques Tell Rear Window Story (David Atkinson, American Cinematographer, Jan 1990; posted on theasc.com)",
        "url": "https://theasc.com/article/hitchcocks-techniques-tell-rear-window-story/"
      },
      {
        "title": "Alfred Hitchcock brought out the glorious weaknesses in Jimmy Stewart (Jesse Hassenger, The A.V. Club, Aug 22, 2016)",
        "url": "https://www.avclub.com/alfred-hitchcock-brought-out-the-glorious-weaknesses-in-1798250887"
      }
    ]
  },
  "2636+2638": {
    "text": "Hitchcock's project with Grant was turning likability into unease: he meant Suspicion to end with Grant poisoning his wife, but the studio judged the star too glamorous to play a killer.[1] Notorious, with Grant seducing Ingrid Bergman into spying, is that idea carried through.[2]",
    "sources": [
      {
        "title": "Suspicion (TCM article)",
        "url": "https://www.tcm.com/articles/64049/suspicion"
      },
      {
        "title": "Cary Grant (TCM article)",
        "url": "https://www.tcm.com/articles/021636/cary-grant"
      }
    ]
  },
  "4110+6593": {
    "text": "Huston's debut, The Maltese Falcon,[2] gave Bogart the guarded cynic who trusts no one,[1] a type he replayed for years.[2] Later, The Treasure of the Sierra Madre found him with that guard worn away, all animal paranoia,[1] as if Huston were testing his invention.",
    "sources": [
      {
        "title": "Humphrey Bogart: 10 essential films (BFI)",
        "url": "https://www.bfi.org.uk/lists/humphrey-bogart-10-essential-films"
      },
      {
        "title": "Humphrey Bogart (TCM article, 8/20)",
        "url": "https://www.tcm.com/articles/1233684/humphrey-bogart-8-20"
      }
    ]
  },
  "4110+7570": {
    "text": "Their romance began on the To Have and Have Not set, where scenes were rewritten to spotlight Bacall.[1] Once they married, The Big Sleep was reshot for innuendo between them,[2] while later films hid his face behind point-of-view shots or shrank their romance to suggestion.[3]",
    "sources": [
      {
        "title": "Behind the Camera: To Have and Have Not (Turner Classic Movies)",
        "url": "https://www.tcm.com/articles/89315/behind-the-camera-to-have-and-have-not"
      },
      {
        "title": "Behind the Classics: The Big Sleep (1946) (Turner Classic Movies)",
        "url": "https://www.tcm.com/articles/behind-the-classics/89384/behind-the-classics-the-big-sleep-1946"
      },
      {
        "title": "Every Bogart and Bacall Movie, Ranked (Paste Magazine)",
        "url": "https://www.pastemagazine.com/movies/film-noir/bogart-and-bacall-movies-ranked"
      }
    ]
  },
  "1776+3084": {
    "text": "Coppola got Brando for The Godfather by dressing a screen test as play, and Brando built Vito himself, shoe polish and shot-in-the-throat voice included.[1] On Apocalypse Now that same self-authorship meant a heavy, unprepared actor rewriting his lines, and Coppola hid the bulk in shadow.[2]",
    "sources": [
      {
        "title": "To make 'The Godfather' his way, Francis Ford Coppola waged a studio battle (NPR Fresh Air, Terry Gross, republished by Ideastream)",
        "url": "https://www.ideastream.org/2024-12-20/to-make-the-godfather-his-way-francis-ford-coppola-waged-a-studio-battle"
      },
      {
        "title": "Apocalypse Now (1979) (TCM / AFI Top 100)",
        "url": "https://www.tcm.com/articles/afi-top-100/188688/apocalypse-now-1979"
      }
    ]
  },
  "2372+10828": {
    "text": "Del Toro would sooner skip Hellboy than cast anyone else,[1] and after seven years he spent Blade II's leverage to win it.[2] Perlman says they share a belief that monstrous exteriors long to be accepted,[3] which made Hellboy a conviction, not a casting.",
    "sources": [
      {
        "title": "Ron Perlman's Hellboy Casting Was A Years-Long Battle Behind The Scenes (SlashFilm, Mar 31, 2022)",
        "url": "https://www.slashfilm.com/817741/ron-perlmans-hellboy-casting-was-a-years-long-battle-behind-the-scenes"
      },
      {
        "title": "Guillermo del Toro Fought For Years To Get Ron Perlman Cast As Hellboy (Gizmodo/io9, Dec 2, 2018)",
        "url": "https://gizmodo.com/guillermo-del-toro-fought-for-years-to-get-ron-perlman-1830806679"
      },
      {
        "title": "The Inverse Interview: Ron Perlman (Inverse)",
        "url": "https://www.inverse.com/entertainment/ron-perlman-interview-nightmare-alley-hellboy-3"
      }
    ]
  },
  "5140+9206": {
    "text": "Craven, gentle in person but twisted in imagination, steered Campbell through Scream's finale by whispering an image of bullets ricocheting through her.[1] Prized for grace, strength and vulnerability,[1] she gave him a heroine who has sex and survives, breaking a horror rule.[2]",
    "sources": [
      {
        "title": "Scream oral history (The Ringer, Dec 2021)",
        "url": "https://www.theringer.com/platform/amp/movies/2021/12/20/22840882/scream-oral-history-wes-craven-neve-campbell-drew-barrymore"
      },
      {
        "title": "Director Wes Craven Interview SCREAM 4 (Collider)",
        "url": "https://collider.com/director-wes-craven-interview-scream-4/"
      }
    ]
  },
  "5140+26458": {
    "text": "Craven passed on Williamson's script several times, then gave notes that were mostly typos, saving his invention for set, where he hunted alternate takes with more humor.[1] On Scream 2, Williamson's film-within-the-film, Stab, worked so well in Craven's hands it became the sequel's spine.[2]",
    "sources": [
      {
        "title": "Your Favorite Scary Movie: The Oral History of 'Scream' (Alan Siegel, The Ringer, Dec. 20, 2021)",
        "url": "https://theringer.com/2021/12/20/movies/scream-oral-history-wes-craven-neve-campbell-drew-barrymore"
      },
      {
        "title": "Scream 2 at 25: Kevin Williamson remembers his second stab at screenwriting the iconic series (Clark Collis, Entertainment Weekly, Dec. 9, 2022, via Yahoo)",
        "url": "https://ca.news.yahoo.com/scream-2-25-kevin-williamson-150000132.html"
      }
    ]
  },
  "5293+138781": {
    "text": "Eggers feeds Dafoe research, not psychology: on The Lighthouse he pointed him to nearly everything he needed;[2] on Nosferatu he withheld his backstory novella, since Dafoe wanted only what the character knows.[1] Dafoe's trust comes from how Eggers handles hardship, which the actor welcomes.[3]",
    "sources": [
      {
        "title": "Before 'Nosferatu,' Robert Eggers Recalls Almost Getting Willem Dafoe Set on Fire (TheWrap)",
        "url": "https://www.thewrap.com/nosferatu-interview-willem-dafoe-robert-eggers/"
      },
      {
        "title": "Robert Eggers and Willem Dafoe on The Lighthouse (The Skinny)",
        "url": "https://www.theskinny.co.uk/film/interviews/robert-eggers-and-willem-dafoe-on-the-lighthouse"
      },
      {
        "title": "Q&A: Robert Eggers and Willem Dafoe reunite for 'Nosferatu' (Associated Press, via News4Jax)",
        "url": "https://www.news4jax.com/entertainment/2024/12/24/qa-robert-eggers-and-willem-dafoe-reunite-for-nosferatu/"
      }
    ]
  },
  "1+3": {
    "text": "Ford played the skeptic in Lucas's fairy tales, pitching a cockier reply than the scripted one in The Empire Strikes Back.[2] Killing Han in Return of the Jedi was the one point he could not win from Lucas,[1] a case he pressed for thirty years.[3]",
    "sources": [
      {
        "title": "Great Galloping Galaxies! (TIME, 1983)",
        "url": "https://time.com/archive/6699598/great-galloping-galaxies/"
      },
      {
        "title": "Star Wars Week: the Empire Strikes Back carbonite scene and the 'I know' line (Inverse)",
        "url": "https://www.inverse.com/entertainment/star-wars-empire-strikes-back-han-solo-carbonite-scene"
      },
      {
        "title": "Harrison Ford Had Argued For Han Solo's Death For 30 Years (TIME, 2016)",
        "url": "https://time.com/4267665/harrison-ford-han-solo-death/"
      }
    ]
  },
  "578+947": {
    "text": "Their bond began when Scott defended Zimmer from a producer's attack on his score at a preview of their first film.[1] By Gladiator, Zimmer was on set from day one,[3] opening on a single note to show a macho epic could hold tenderness and poetry.[2][3]",
    "sources": [
      {
        "title": "Ray Colcord Interviews Hans Zimmer (The Score, Society of Composers & Lyricists, Oct 28, 2009)",
        "url": "https://thescl.com/articles/hans-zimmer-interview/"
      },
      {
        "title": "Hans Zimmer on 60 Minutes: transcript (CBS News, June 25, 2023)",
        "url": "https://www.cbsnews.com/news/hans-zimmer-60-minutes-transcript-2023-06-25"
      },
      {
        "title": "The music man of 'Gladiator,' 'Pearl Harbor' (Christian Science Monitor, July 6, 2001)",
        "url": "https://csmonitor.com/2001/0706/p19s1.html"
      }
    ]
  },
  "1100+2710": {
    "text": "Cameron spent three films renegotiating what Schwarzenegger's bulk could mean: a Terminator with seventeen lines,[1] then a killer turned protector, over the star's worry that he kills nobody.[2] True Lies sent a Bond type home to his family and onto a tango floor.[3]",
    "sources": [
      {
        "title": "Forty Years Ago: The Terminator Makes a Killing (The Saturday Evening Post)",
        "url": "https://www.saturdayeveningpost.com/2024/10/forty-years-ago-the-terminator-makes-a-killing/"
      },
      {
        "title": "An oral history of Terminator 2: Judgment Day (The Ringer)",
        "url": "https://www.theringer.com/2021/06/30/movies/terminator-2-judgement-day-t2-oral-history"
      },
      {
        "title": "'True Lies' at 25: James Cameron reveals Arnold Schwarzenegger's most dangerous stunt (Yahoo Entertainment)",
        "url": "https://uk.movies.yahoo.com/true-lies-anniversary-james-cameron-arnold-schwarzenegger-the-terminator-avatar-titanic-aliens-abyss-091212886.html"
      }
    ]
  },
  "9339+9340": {
    "text": "On The Matrix the Wachowskis directed mostly in tandem, sharing duties on set in ways a familiar crew made easy.[1] Cloud Atlas split them from Tom Tykwer into separate units, yet constant Skype calls and swapped dailies kept the three working as one.[2]",
    "sources": [
      {
        "title": "Lilly Wachowski interview (Autostraddle, Drew Burnett Gregory, Oct 11, 2024)",
        "url": "https://www.autostraddle.com/lilly-wachowski-interview/"
      },
      {
        "title": "Film Interview: Cloud Atlas Co-Directors and Writers Andy Wachowski, Lana Wachowski and Tom Tykwer (/Film, Oct 31, 2012)",
        "url": "https://www.slashfilm.com/film-interview-cloud-atlas-co-directors-and-writers-andy-wachowski-lana-wachowksi-and-tom-tykwer"
      }
    ]
  },
  "15344+15347": {
    "text": "On Star Trek, Abrams and Giacchino held Alexander Courage's original theme back until the end credits, and kept that discipline for Into Darkness.[1] That fourth film together went further, with Abrams wanting a villain's sound unlike typical Trek and blunt notes flowing both ways.[2]",
    "sources": [
      {
        "title": "Michael Giacchino interview: Ratatouille, Mission: Impossible (Den of Geek)",
        "url": "https://www.denofgeek.com/movies/michael-giacchino-interview-ratatouille-mission-impossible/"
      },
      {
        "title": "Michael Giacchino on Star Trek Into Darkness (HuffPost)",
        "url": "https://www.huffpost.com/entry/michael-giacchino-star-trek_n_3293326"
      }
    ]
  },
  "956+976": {
    "text": "Statham's debut was also Ritchie's, Lock, Stock and Two Smoking Barrels;[1] by Wrath of Man, Ritchie saw an old-fashioned leading man in him and made a drama he tried not to make funny.[2] Ritchie's usual playful roughhousing gives way to a cold, straight-ahead mission.[3]",
    "sources": [
      {
        "title": "Interview: Jason Statham (Revolver) - ioncinema",
        "url": "https://www.ioncinema.com/?p=17615"
      },
      {
        "title": "WRATH OF MAN - Guy Ritchie Interview - Heavy Magazine (Cinema)",
        "url": "https://cinema.heavymag.com.au/?p=8760"
      },
      {
        "title": "Wrath of Man (2021) review - Time Out",
        "url": "https://www.timeout.com/movies/wrath-of-man-2021"
      }
    ]
  },
  "138+139": {
    "text": "Thurman helped dream up the Bride on a night out with Pulp Fiction's cast,[1] then argued with Tarantino almost daily on Kill Bill over how to play her, often winning.[1] Her crash during a driving shot there broke their trust for years, he says.[2]",
    "sources": [
      {
        "title": "The Tao of Uma (Josh Tyrangiel, TIME, Sept. 29, 2003)",
        "url": "https://time.com/archive/6669654/the-tao-of-uma/"
      },
      {
        "title": "Quentin Tarantino 'Regrets' Uma Thurman's Car Crash (Oliver Gettell, Entertainment Weekly, on TIME, Feb. 6, 2018)",
        "url": "https://time.com/5134854/quentin-tarantinoresponds-uma-therman-car-crash/"
      }
    ]
  },
  "138+287": {
    "text": "Tarantino says Pitt barely broke character as Aldo Raine on Inglourious Basterds,[1] a swagger one critic found flat.[2] In Once Upon a Time... in Hollywood, Cliff Booth hides a threat inside easy charm,[3] and the pairing works once Pitt stops performing and starts withholding.",
    "sources": [
      {
        "title": "Inglourious Basterds production notes (official press kit, Cannes Film Festival / Universal / The Weinstein Company), Chapter Two, Casting",
        "url": "https://cdn-media.festival-cannes.com/film_film/0002/37/6800a32cdfeec5b9fce3f42f8ae43848d54b0207.pdf"
      },
      {
        "title": "Jerome Charyn, \"Alternate Universes,\" The American Scholar, Dec. 2, 2019",
        "url": "https://theamericanscholar.org/?p=40511"
      },
      {
        "title": "Stuart Klawans, \"The Hallucinatory Violence of Quentin Tarantino's Alternate Histories,\" The Nation, Aug. 2, 2019",
        "url": "https://www.thenation.com/article/archive/once-upon-a-time-in-hollywood-quentin-tarantino-review/"
      }
    ]
  },
  "1223+1224": {
    "text": "The Coens tended to feel their way through scripts without an outline,[1] and in Fargo and The Big Lebowski the dread and the jokes arrive in the same scenes. Apart, Joel's black-and-white Shakespeare keeps the bleakness and Ethan's raunchy road comedy the farce.[2]",
    "sources": [
      {
        "title": "The Coen brothers: It Goes Where It Goes (Little White Lies, interview by David Jenkins, 1 Jan 2014)",
        "url": "https://lwlies.com/interviews/the-coen-brothers-inside-llweyn-davis/"
      },
      {
        "title": "Coen brother, where art thou: When Joel & Ethan Coen go solo (The A.V. Club)",
        "url": "https://avclub.com/coen-brothers-joel-ethan-solo-movies-1851280205"
      }
    ]
  },
  "134+638": {
    "text": "Mann kept Foxx quiet: a cornerman who slides out of Ali mid-story,[1] then a cabbie Mann asked him to play boring and indifferent, against Foxx's brash comic persona.[2] Foxx had been pushing Miami Vice on Mann since 2002,[3] yet in it he looks adrift.[1]",
    "sources": [
      {
        "title": "Over three films, Jamie Foxx caught Michael Mann in transition (The A.V. Club)",
        "url": "https://www.avclub.com/together-again-jamie-foxx-michael-mann-ali-miami-vice-collateral"
      },
      {
        "title": "Jamie Foxx on Collateral (VOA News, Aug. 13, 2004)",
        "url": "https://www.voanews.com/a/a-13-a-2004-08-13-18-1-66892512/261936.html"
      },
      {
        "title": "Colin Farrell, Jamie Foxx, Naomie Harris, Gong Li, Michael Mann for Miami Vice (Dark Horizons press conference)",
        "url": "https://www.darkhorizons.com/?p=16746"
      }
    ]
  },
  "1884+1892": {
    "text": "Soderbergh never made Damon a star as he did Clooney; he wore down the golden-boy image, with Damon in on it.[1] Ocean's Eleven let him ride inside an ensemble,[2] and Contagion, a backyard movie among friends to Damon,[3] made him an everyman widower.[1]",
    "sources": [
      {
        "title": "Steven Soderbergh tore down Matt Damon to build him back up (Jesse Hassenger, The A.V. Club, Feb 22, 2016)",
        "url": "https://www.avclub.com/steven-soderbergh-tore-down-matt-damon-to-build-him-bac-1798244436"
      },
      {
        "title": "Movieline interview outtakes on Ocean's Eleven (Stephen Rebello, Movieline, Jan 2002; excerpt reposted on stevensoderbergh.net)",
        "url": "https://stevensoderbergh.net/articles/2002/movieline-outtakes.php"
      },
      {
        "title": "Press Conference Highlights: Steven Soderbergh, Matt Damon, Laurence Fishburne, Jennifer Ehle and Scott Burns Talk Contagion (Steve Barton, Dread Central, Sept 8, 2011)",
        "url": "https://www.dreadcentral.com/news/26836/press-conference-highlights-steven-soderbergh-matt-damon-laurence-fishburne-jennifer-ehle-and-scott-burns-talk-contagion/"
      }
    ]
  },
  "62+2231": {
    "text": "Pulp Fiction kept them apart, making their Die Hard: With a Vengeance pairing an in-joke,[1] and on that set Willis urged Jackson to find a character to return to after flops.[2] Shyamalan cast them in his superhero drama to set Willis's quiet against Jackson's flair.[3]",
    "sources": [
      {
        "title": "Bruce Willis, Glass, and the Shyamalan Career Retrospective (The Ringer, Jan. 18, 2019)",
        "url": "https://www.theringer.com/2019/01/18/movies/bruce-willis-glass-shyamalan-career-retrospective"
      },
      {
        "title": "Samuel L. Jackson Shares the Important Career Advice Bruce Willis Gave Him Years Before Marvel (TheWrap, Mar. 20, 2025)",
        "url": "https://thewrap.com/?p=7725304"
      },
      {
        "title": "Oral History of Unbreakable with M. Night Shyamalan and Samuel L. Jackson (Rotten Tomatoes editorial)",
        "url": "https://editorial.rottentomatoes.com/article/oral-history-of-unbreakable-with-m-night-shyamalan-and-samuel-l-jackson"
      }
    ]
  },
  "19274+54734": {
    "text": "Rogen and Goldberg began as Vancouver teenagers writing Superbad and plotting a homemade movie of their own.[1] Decades on, boisterous Rogen fronts while reserved Goldberg stays out of the spotlight, and franchise work helps fund the small films they still want.[2]",
    "sources": [
      {
        "title": "Seth Rogen, Evan Goldberg: Friends Till 'The End' (NPR Fresh Air interview, republished by WAMC)",
        "url": "https://www.wamc.org/2013-12-26/seth-rogen-evan-goldberg-friends-till-the-end"
      },
      {
        "title": "With The Studio, Seth Rogen and Evan Goldberg grow up. Sort of. (Austin Considine, The New York Times, republished by The Nightly)",
        "url": "https://thenightly.com.au/culture/with-the-studio-seth-rogen-and-evan-goldberg-grow-up-sort-of-c-18305933"
      }
    ]
  },
  "3460+9309": {
    "text": "In their first pairing, Pryor played straight man to Wilder's antics, and by Wilder's account the rapport existed for the camera alone.[1] It peaked in Stir Crazy, despite a troubled shoot,[2] and survived the weak script of See No Evil, Hear No Evil.[3]",
    "sources": [
      {
        "title": "Gene Wilder turns 80: Remembering his comedy partnership with Richard Pryor (theGrio, 2013)",
        "url": "https://thegrio.com/2013/06/11/gene-wilder-turns-80-remembering-his-comedy-partnership-with-richard-pryor/"
      },
      {
        "title": "Richard Pryor and Gene Wilder's friendship (Biography.com)",
        "url": "https://www.biography.com/actors/richard-pryor-gene-wilder-friendship"
      },
      {
        "title": "Film review: See No Evil, Hear No Evil (Chris Hicks, Deseret News, June 8, 1989)",
        "url": "https://www.deseret.com/1989/6/8/20088591/film-review-see-no-evil-hear-no-evil/"
      }
    ]
  },
  "887+5655": {
    "text": "Playwriting classmates,[1][2] they co-wrote the small heist comedy of Bottle Rocket[2] and later The Royal Tenenbaums, a saga spanning decades, built like a long novel told in highlights.[1] That Oscar-nominated script proved their last together, just as Wilson was becoming famous in mainstream movies.[2]",
    "sources": [
      {
        "title": "The Royal Tenenbaums (2001), 101 Funniest Screenplays - Writers Guild of America",
        "url": "https://origin.www.wga.org/writers-room/101-best-lists/101-funniest-screenplays/the-royal-tenenbaums"
      },
      {
        "title": "The 1980 movie Owen Wilson introduced to Wes Anderson: \"He'd never seen it\" - Far Out Magazine",
        "url": "https://faroutmagazine.co.uk/1980-movie-owen-wilson-introduced-to-wes-anderson/"
      }
    ]
  },
  "280+383": {
    "text": "On Time Bandits, Gilliam brought the story and a darkly surreal streak, Palin the dialogue and three-dimensional people.[1] By Brazil, Gilliam gave Palin a role Robert De Niro wanted, and Palin played Jack Lint as a sociable family man whose warmth made him scarier.[2]",
    "sources": [
      {
        "title": "It's a Miracle That Terry Gilliam's Time Bandits Even Got Made (Gizmodo, Robert Sellers, 17 Sept 2013)",
        "url": "https://gizmodo.com/its-a-miracle-that-terry-gilliams-time-bandits-even-g-1332560707"
      },
      {
        "title": "The Terry Gilliam Files: Michael Palin on Brazil (interview by David Morgan for Voyager's 1996 Criterion Collection Brazil laserdisc, Wide Angle / Closeup)",
        "url": "https://wideanglecloseup.com/palin.html"
      }
    ]
  },
  "380+6193": {
    "text": "Offscreen, De Niro was DiCaprio's sponsor, flagging him to the producer of This Boy's Life,[1] then urging Scorsese to work with him.[2] Onscreen he is the reverse: the abusive stepfather there, and in Killers of the Flower Moon a Hale who dominates Ernest's mind.[3]",
    "sources": [
      {
        "title": "Robert De Niro Says He Knew Leonardo DiCaprio Had 'Something Special' When They Met 30 Years Ago (People exclusive, Feb 11, 2024; Yahoo News Canada repost)",
        "url": "https://ca.news.yahoo.com/robert-niro-says-knew-leonardo-130000830.html"
      },
      {
        "title": "Leonardo DiCaprio and Martin Scorsese's Collaborations, from 'Gangs of New York' to 'Killers of the Flower Moon' (IndieWire, Oct 25, 2023; Yahoo News UK repost)",
        "url": "https://uk.news.yahoo.com/leonardo-dicaprio-martin-scorsese-collaborations-000052898.html"
      },
      {
        "title": "Leonardo DiCaprio on Reuniting with Robert De Niro for 'Killers' 30 Years After 'This Boy's Life': 'Full Circle' (People, Dec 4, 2023; Yahoo News Malaysia repost)",
        "url": "https://malaysia.news.yahoo.com/leonardo-dicaprio-reuniting-robert-niro-181859288.html"
      }
    ]
  },
  "3+488": {
    "text": "Across Spielberg's swings in tone, Ford was the constant: reviewers condemned Temple of Doom's violence and children in peril yet kept praising his Indy,[1] and Spielberg later framed the next film as an apology.[1] Last Crusade gave Ford's Indy an estranged father in Sean Connery.[2]",
    "sources": [
      {
        "title": "Indiana Jones and the Temple of Doom, AFI Catalog of Feature Films (American Film Institute)",
        "url": "https://catalog.afi.com/Film/67251-INDIANA-JONESANDTHETEMPLEOFDOOM"
      },
      {
        "title": "Richard Corliss, \"What's Old Is Gold: A Triumph for Indy,\" Time, May 29, 1989",
        "url": "https://content.time.com/time/subscriber/article/0,33009,957848,00.html"
      }
    ]
  },
  "1+488": {
    "text": "Raiders began as Lucas's synopsis and took shape in a week of taped talk, with Lucas and Spielberg inventing key scenes beside Kasdan.[1] By Last Crusade, other writers held the pen, Lucas kept a story credit, and the Grail hunt carried a father-son story.[2]",
    "sources": [
      {
        "title": "Raiders of the Lost Ark (1981), AFI Catalog of Feature Films",
        "url": "https://catalog.afi.com/Catalog/MovieDetails/67250"
      },
      {
        "title": "Indiana Jones and the Last Crusade (1989), AFI Catalog of Feature Films",
        "url": "https://catalog.afi.com/Catalog/moviedetails/67198"
      }
    ]
  },
  "525+3894": {
    "text": "Bale reads Bruce Wayne's playboy charm as the fake and Batman as the true self,[1] and Nolan's The Dark Knight tests that self, pulling him closer than ever to killing.[1] The Dark Knight Rises, plotted right after, opens with him in exile as a fugitive.[2]",
    "sources": [
      {
        "title": "Christian Bale: Ledger had 'wonderful time' as Joker (TODAY)",
        "url": "https://www.today.com/popculture/christian-bale-ledger-had-wonderful-time-joker-wbna25673502"
      },
      {
        "title": "Christopher and Jonathan Nolan Explain How A Tale of Two Cities Influenced The Dark Knight Rises (Collider)",
        "url": "https://collider.com/dark-knight-rises-tale-of-two-cities/"
      }
    ]
  },
  "138+2294": {
    "text": "Grindhouse is the partnership at its plainest: a double feature recreating 1970s rundown-theater nights, a film by each friend, with Tarantino as a zombie in Rodriguez's Planet Terror.[1] The shared nostalgia found few takers: about $25 million domestic on a reported $67 million budget.[1]",
    "sources": [
      {
        "title": "Time (2007): Grindhouse DVD coverage (exact headline not captured by the fetch)",
        "url": "https://content.time.com/time/specials/2007/article/0,28804,1665692_1665693_1672123,00.html"
      }
    ]
  },
  "4165+11435": {
    "text": "In Red River, Hawks took Wayne darker than ever as a star, a cattleman turned tyrant on the drive.[1] Rio Bravo, his answer to a sheriff who begs for help,[2][3] made Wayne a lawman who thinks he needs no amateurs yet needs them constantly.[3]",
    "sources": [
      {
        "title": "Red River, by Michael Schlesinger (Library of Congress National Film Registry essay)",
        "url": "https://www.loc.gov/static/programs/national-film-preservation-board/documents/red_river.pdf"
      },
      {
        "title": "Rio Bravo, by Jeff Stafford (Turner Classic Movies, Sept. 25, 2003)",
        "url": "https://www.tcm.com/articles/1069/rio-bravo"
      },
      {
        "title": "Rio Bravo, by Michael Schlesinger (Library of Congress National Film Registry essay)",
        "url": "https://www.loc.gov/static/programs/national-film-preservation-board/documents/rio_bravo.pdf"
      }
    ]
  },
  "2461+7187": {
    "text": "Donner directed Gibson six times, and Gibson credits him as a seasoned hand who invites actors to experiment without pretending to have every answer.[1] In Lethal Weapon and Maverick that looseness is the engine, with Donner holding the frame and Gibson roaming inside it.",
    "sources": [
      {
        "title": "Great Conversations: Mel Gibson (Alex Simon interview), HuffPost",
        "url": "https://www.huffpost.com/alex-simon/great-conversations-mel-g_b_7690210.html"
      }
    ]
  },
  "6384+40644": {
    "text": "Stahelski began as Reeves's stunt double on The Matrix,[1] and by his own estimate Reeves did about 95 percent of his fighting on the sequels.[2] John Wick, co-directed with David Leitch, put the double behind the camera, directing the actor he once coached.[3]",
    "sources": [
      {
        "title": "How The Director Of John Wick Became Keanu Reeves' Stunt Double On The Matrix (BJ Colangelo, /Film, updated March 21, 2023)",
        "url": "https://www.slashfilm.com/938314/how-the-director-of-john-wick-became-keanu-reeves-stunt-double-on-the-matrix-comic-con"
      },
      {
        "title": "Interview with Chad Stahelski, martial arts stunt coordinator and Neo stunt double on The Matrix Reloaded and Revolutions (REDPILL interview, Dec 2001; published on MatrixFans.net)",
        "url": "https://www.matrixfans.net/interview-with-chad-stahelski-martial-arts-stunt-coordinator-neo-stunt-double-from-the-matrix-reloaded-revolutions-2003/"
      },
      {
        "title": "Keanu Reeves' John Wick Hits Box Office Bull's-Eye and Lionsgate's Gamble Pays Off (Todd Cunningham, TheWrap, Oct 26, 2014)",
        "url": "https://www.thewrap.com/keanu-reeves-john-wick-hits-box-office-bulls-eye-and-lionsgates-gamble-pays-off/"
      }
    ]
  },
  "500+11108": {
    "text": "In Fallout, Pegg's value to Cruise lies less in what his character does than in where he stands. Time's critic argued that Pegg and Ving Rhames, back as Ethan Hunt's allies, make Cruise seem more human simply by being near him.[1]",
    "sources": [
      {
        "title": "Mission: Impossible—Fallout May Be the Best Since the Original (Stephanie Zacharek, Time, 26 July 2018)",
        "url": "https://time.com/5349500/mission-impossible-fallout/"
      }
    ]
  },
  "2219+7623": {
    "text": "Raimi kept Peter an ordinary man, skipping even homemade web-shooters, and by 2007 called Maguire his partner.[1] Their weak spots were plot, not character: Spider-Man 3 absorbed Venom at a producer's urging,[1] and a fourth film died when Raimi found the script wanting.[2]",
    "sources": [
      {
        "title": "Sam Raimi Interviewed – SPIDER-MAN 3 (Steven Weintraub, Collider, April 22, 2007)",
        "url": "https://collider.com/sam-raimi-interviewed-spiderman-3/"
      },
      {
        "title": "Sam Raimi on Why 'Spider-Man 4' Fell Apart (Wilson Chapman, Variety, April 30, 2022; syndicated on Yahoo News UK)",
        "url": "https://uk.news.yahoo.com/sam-raimi-why-spider-man-181120042.html"
      }
    ]
  },
  "2201+6648": {
    "text": "Between 1957 and 1971 Bergman moved von Sydow from the knight of The Seventh Seal, chess opponent of Death, to stand-ins for the director, an illusionist and then a tormented artist.[1] By Shame the same face belonged to a musician turned cold-blooded killer.[1]",
    "sources": [
      {
        "title": "Max von Sydow: 10 essential films (BFI)",
        "url": "https://www.bfi.org.uk/lists/max-von-sydow-10-essential-films"
      }
    ]
  },
  "4415+5676": {
    "text": "In La Dolce Vita Fellini made Mastroianni a reporter sliding through Rome's episodes, a descent that reads as the director's own darkening pessimism.[1] In 8½ the role became a mirror: a stalled director whom Fellini called invented, though the crisis was his own.[1]",
    "sources": [
      {
        "title": "Federico Fellini (Great Directors), Senses of Cinema",
        "url": "https://www.sensesofcinema.com/2002/great-directors/fellini/"
      }
    ]
  },
  "5676+16757": {
    "text": "Across a dozen films, Loren and Mastroianni moved from farce, where she held the upper hand, to the restrained two-hander A Special Day.[1] Yet the De Sica comedies, Yesterday, Today and Tomorrow among them, hold the chemistry neither matched elsewhere.[2]",
    "sources": [
      {
        "title": "Sophia Loren: 10 essential films",
        "url": "https://www.bfi.org.uk/lists/sophia-loren-10-essential-films/"
      },
      {
        "title": "Marriage Italian Style",
        "url": "https://www.tcm.com/articles/1076317/marriage-italian-style-marriage-italian-style"
      }
    ]
  },
  "10099+20738": {
    "text": "Park offered Song the lead in his vampire film on the set of Joint Security Area, and Song readily agreed.[1] Two more films together passed before Thirst began shooting in 2008, so the role arrived as the end point of a long-held plan.[1]",
    "sources": [
      {
        "title": "Thirst Production Notes (Focus Features)",
        "url": "https://www.focusfeatures.com/article/thirst_production_notes"
      }
    ]
  },
  "17276+69797": {
    "text": "By the 2014 sequel, Butler's Stoick had come to respect his son Hiccup.[2] DeBlois's live-action remake, with Butler reprising the role, sends father and son back to the start, to the arena scene where Hiccup defies him while trying to change their ways.[1]",
    "sources": [
      {
        "title": "Why 'How to Train Your Dragon' Director Dean DeBlois Returned for the Live-Action Movie (Drew Taylor, TheWrap, Feb 12, 2025)",
        "url": "https://www.thewrap.com/how-to-train-your-dragon-dean-deblois-interview-edit-bay/"
      },
      {
        "title": "Gerard Butler and Craig Ferguson Talk HOW TO TRAIN YOUR DRAGON 2 (Christina Radish, Collider, June 2014)",
        "url": "https://collider.com/gerard-butler-how-to-train-your-dragon-2-interview/"
      }
    ]
  },
  "15810+15811": {
    "text": "They wrote in relay and directed in parallel: Musker drafted each scene many ways, Clements kept what he liked and assembled the draft, then each led his own sequences and animators.[1] On screen the seam vanishes across seven features they co-directed and co-wrote.[2]",
    "sources": [
      {
        "title": "Interview with Film Director and Animation Legend John Musker (Indie Cinema Magazine, Sept. 8, 2024)",
        "url": "https://indie-cinema.com/2024/09/interview-with-film-director-and-animation-legend-john-musker/"
      },
      {
        "title": "John Musker, co-director of Aladdin and Moana, retires from Disney after 40 years (Cartoon Brew, Mar. 19, 2018)",
        "url": "https://www.cartoonbrew.com/animators/john-musker-co-director-aladdin-moana-retires-disney-40-years-157319.html"
      }
    ]
  },
  "66193+69797": {
    "text": "Lilo & Stitch grew from a script they wrote after hours, and the studio made them co-directors.[1] Sanders pulled DeBlois onto How to Train Your Dragon,[2] then returned to his own film while DeBlois directed the sequels, yet both independently chose the same book.[3]",
    "sources": [
      {
        "title": "Creative Screenwriting: article on Dean DeBlois and How to Train Your Dragon (page title not confirmed)",
        "url": "https://www.creativescreenwriting.com/cswcms/?p=22481"
      },
      {
        "title": "DreamWorks Unleashes Dragons (Animation World Network)",
        "url": "https://www.awn.com/animationworld/dreamworks-unleashes-dragons"
      },
      {
        "title": "The Wild Robot Director Chris Sanders Looks Back: From Lilo & Stitch to How to Train Your Dragon (TheWrap)",
        "url": "https://www.thewrap.com/chris-sanders-movies-retrospective-interview-the-wild-robot-lilo-and-stitch/"
      }
    ]
  },
  "19274+41039": {
    "text": "Apatow took a supporting player who helped rethink The 40-Year-Old Virgin's scenes and structure,[2] then steered his sci-fi pitch into a pregnancy comedy, Knocked Up.[1] On set, scripted takes give way to improvisation,[2] which on Knocked Up Apatow pushed from crude jokes toward feeling.[3]",
    "sources": [
      {
        "title": "Get 'Knocked Up' With Judd Apatow (ABC News, 2007)",
        "url": "https://abcnews.com/abcnewsnow/story?id=3230321"
      },
      {
        "title": "Seth Rogen interview by Scott Tobias (The A.V. Club, May 31, 2007)",
        "url": "https://www.avclub.com/seth-rogen-1798211499"
      },
      {
        "title": "Seth Rogen on the best advice he ever received: less semen, more emotion (NME)",
        "url": "https://www.nme.com/news/seth-rogen-best-advice-ever-received-less-semen-more-emotion-3968710"
      }
    ]
  },
  "1524+1532": {
    "text": "Ramis saw Murray as the steady center of their early comedies, rescuing weak scripts by improvising.[1] Groundhog Day kept the deadpan but added gravitas,[2] yet they reportedly fell out over the film, and Ramis later guessed Murray had tired of the party guy.[1]",
    "sources": [
      {
        "title": "Harold Ramis (interview by Steve Hesler), The A.V. Club, October 12, 2009",
        "url": "https://www.avclub.com/harold-ramis-1798216819"
      },
      {
        "title": "90 great films of the 1990s: Groundhog Day entry by Brogan Morris, British Film Institute, December 18, 2019",
        "url": "https://www.bfi.org.uk/lists/90-great-films-1990s"
      }
    ]
  },
  "5344+9248": {
    "text": "Ephron befriended Ryan on the set of When Harry Met Sally..., then insisted on directing Sleepless in Seattle and called Ryan to star.[1] Across their three romances, what binds the lovers moves from long talks to a radio voice to email, with Ryan the constant.[2]",
    "sources": [
      {
        "title": "How 'Sleepless in Seattle' and Nora Ephron changed romantic comedies 25 years ago (ABC News, drawing on Erin Carlson's book on Ephron's films)",
        "url": "https://abcnews.com/culture/story/sleepless-seattle-nora-ephron-changed-romantic-comedies-25-56092785"
      },
      {
        "title": "Nora Ephron and the Unknowable Love Interest (Camille Acker, Keyframe/Fandor, March 14, 2018)",
        "url": "https://keyframe.fandor.com/nora-ephron-and-the-unknowable-love-interest/"
      }
    ]
  },
  "92784+960350": {
    "text": "Laxton prepares the visual world while Jenkins seeks the performance,[1] and both let cast and place shape the look instead of imposing a style.[2] Together they built a camera that listens like another actor, tried in Moonlight, refined in If Beale Street Could Talk.[3]",
    "sources": [
      {
        "title": "The Underground Railroad Director Barry Jenkins Talks with DP James Laxton: \"This Is the Hardest Thing I've Ever Done\" (MovieMaker)",
        "url": "https://www.moviemaker.com/the-underground-railroad-director-barry-jenkins-talks-with-dp-james-laxton-this-is-the-hardest-thing-ive-ever-done"
      },
      {
        "title": "James Laxton on shooting Moonlight (Moveable Fest)",
        "url": "https://moveablefest.com/james-laxton-moonlight/"
      },
      {
        "title": "Cinematographer James Laxton on Capturing the Romance of If Beale Street Could Talk, Close-Ups, and Errol Morris (The Film Stage)",
        "url": "https://thefilmstage.com/cinematographer-james-laxton-on-capturing-the-romance-of-if-beale-street-could-talk-close-ups-and-errol-morris"
      }
    ]
  },
  "24+31": {
    "text": "Cast Away began as Hanks's idea, developed with writer William Broyles Jr.; Zemeckis joined as a consultant and agreed to direct only once Broyles proposed the castaway save himself.[1] Both share producer credit: less a director casting a star than a joint project.[1]",
    "sources": [
      {
        "title": "Cast Away (production notes), AFI Catalog of Feature Films",
        "url": "https://catalog.afi.com/Film/61089-CAST-AWAY"
      }
    ]
  },
  "1233+4762": {
    "text": "Hoffman began as a bit part, needling Philip Baker Hall for under three minutes in Hard Eight.[1] By 2009 Anderson was writing The Master with Hoffman and Joaquin Phoenix attached,[2] and the film watches Phoenix, keeping Hoffman the counterweight even in his largest role.[1]",
    "sources": [
      {
        "title": "Paul Thomas Anderson was ahead of the curve with Philip Seymour Hoffman until the end (Jesse Hassenger, The A.V. Club, Sept. 25, 2025)",
        "url": "https://www.avclub.com/together-again-paul-thomas-anderson-philip-seymour-hoffman-the-master-boogie-nights"
      },
      {
        "title": "Paul Thomas Anderson biography (TCM)",
        "url": "https://www.tcm.com/articles/featured-directors/022052/paul-thomas-anderson-biography"
      }
    ]
  },
  "309+3131": {
    "text": "Almodóvar made Banderas's name with vulnerable, volatile seducers in the 1980s; they reunited on The Skin I Live In after Hollywood and more than two decades.[1] By Pain and Glory he was the director's double,[1] drawing on his own baggage rather than copying Almodóvar's mannerisms.[2]",
    "sources": [
      {
        "title": "Antonio Banderas Comes Into His Own In \"Pain And Glory\" (BuzzFeed News)",
        "url": "https://www.buzzfeednews.com/article/mattheweng/antonio-banderas-pain-glory-pedro-almodovar"
      },
      {
        "title": "How Antonio Banderas' personal baggage helped his Pain and Glory performance (Screen Daily)",
        "url": "https://screendaily.com/features/how-antonio-banderas-personal-baggage-helped-his-pain-and-glory-performance-/5145378.article"
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
