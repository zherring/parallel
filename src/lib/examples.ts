import { buildPeopleSlug } from "@/lib/slug";

/** The genres of the landing page's "Try a pairing" tabs, in display order (after Featured). */
export const GENRES = [
  { id: "classic", label: "Classic" },
  { id: "horror", label: "Horror" },
  { id: "sci-fi", label: "Sci-Fi" },
  { id: "crime-thriller", label: "Crime & Thriller" },
  { id: "comedy", label: "Comedy" },
  { id: "drama", label: "Drama" },
  { id: "action-western", label: "Action & Western" },
  { id: "world-cinema", label: "World Cinema" },
  { id: "animation", label: "Animation" },
] as const;

export type Genre = (typeof GENRES)[number];
export type GenreId = Genre["id"];

/**
 * The first tab, and the one the page opens on. Not a stored genre: it shows a random sample of
 * all pairings (see featured.ts), so every pairing belongs to exactly one real genre above.
 */
export const FEATURED_TAB = { id: "featured", label: "Featured" } as const;

export type TabId = typeof FEATURED_TAB.id | GenreId;

/** How many pairings the Featured tab shows. */
export const FEATURED_COUNT = 6;

export interface ExamplePairing {
  genre: GenreId;
  /** Names must match TMDB exactly so the slug is already canonical (no redirect on click). */
  people: { id: number; name: string }[];
  /**
   * One line. Name only films that are in the pair's shared list on its /p/ page, and only
   * roles that page shows for them.
   */
  blurb: string;
}

/**
 * Hand-curated source of truth for the landing page. `npm run examples:refresh` checks every
 * entry against TMDB and writes the names, photos and film counts to examples.generated.json,
 * which is what the page actually renders from.
 */
export const EXAMPLE_PAIRINGS: readonly ExamplePairing[] = [
  // Classic
  {
    genre: "classic",
    people: [
      { id: 1032, name: "Martin Scorsese" },
      { id: 3661, name: "Thelma Schoonmaker" },
    ],
    blurb: "A director and an editor: Raging Bull, GoodFellas, Casino.",
  },
  {
    genre: "classic",
    people: [
      { id: 2636, name: "Alfred Hitchcock" },
      { id: 1045, name: "Bernard Herrmann" },
    ],
    blurb: "Director and composer: The Man Who Knew Too Much, Vertigo, Psycho, Marnie.",
  },
  {
    genre: "classic",
    people: [
      { id: 12147, name: "Spencer Tracy" },
      { id: 6598, name: "Katharine Hepburn" },
    ],
    blurb: "Two actors on screen together: Woman of the Year, Adam's Rib, Desk Set, Guess Who's Coming to Dinner.",
  },
  {
    genre: "classic",
    people: [
      { id: 3146, name: "Billy Wilder" },
      { id: 3147, name: "I. A. L. Diamond" },
    ],
    blurb: "A director and a co-writer: Some Like It Hot, The Apartment, Irma la Douce, The Fortune Cookie.",
  },
  {
    genre: "classic",
    people: [
      { id: 2746, name: "Elia Kazan" },
      { id: 3084, name: "Marlon Brando" },
    ],
    blurb: "Director and actor: A Streetcar Named Desire, Viva Zapata!, On the Waterfront.",
  },
  {
    genre: "classic",
    people: [
      { id: 1776, name: "Francis Ford Coppola" },
      { id: 1158, name: "Al Pacino" },
    ],
    blurb: "Director and actor: The Godfather, The Godfather Part II, The Godfather Part III.",
  },
  {
    genre: "classic",
    people: [
      { id: 1032, name: "Martin Scorsese" },
      { id: 380, name: "Robert De Niro" },
    ],
    blurb: "Director and actor: Mean Streets, Taxi Driver, Raging Bull, GoodFellas, Casino.",
  },
  {
    genre: "classic",
    people: [
      { id: 380, name: "Robert De Niro" },
      { id: 1158, name: "Al Pacino" },
    ],
    blurb: "Two actors on screen together: The Godfather Part II, Heat, Righteous Kill, The Irishman.",
  },

  // Horror
  {
    genre: "horror",
    people: [
      { id: 11770, name: "John Carpenter" },
      { id: 1060, name: "Dean Cundey" },
    ],
    blurb: "Director and cinematographer: Halloween, The Fog, The Thing, Big Trouble in Little China.",
  },
  {
    genre: "horror",
    people: [
      { id: 224, name: "David Cronenberg" },
      { id: 117, name: "Howard Shore" },
    ],
    blurb: "Director and composer: Videodrome, The Fly, Dead Ringers, A History of Violence.",
  },
  {
    genre: "horror",
    people: [
      { id: 138781, name: "Robert Eggers" },
      { id: 1135102, name: "Jarin Blaschke" },
    ],
    blurb: "Director and cinematographer: The Witch, The Lighthouse, The Northman, Nosferatu.",
  },
  {
    genre: "horror",
    people: [
      { id: 291263, name: "Jordan Peele" },
      { id: 1761126, name: "Michael Abels" },
    ],
    blurb: "Director and composer: Get Out, Us, Nope.",
  },
  {
    genre: "horror",
    people: [
      { id: 10828, name: "Guillermo del Toro" },
      { id: 17005, name: "Doug Jones" },
    ],
    blurb: "Director and actor: Hellboy, Pan's Labyrinth, Crimson Peak, The Shape of Water.",
  },
  {
    genre: "horror",
    people: [
      { id: 1145520, name: "Ari Aster" },
      { id: 1650351, name: "Pawel Pogorzelski" },
    ],
    blurb: "Director and cinematographer: Hereditary, Midsommar, Beau Is Afraid.",
  },

  // Sci-Fi
  {
    genre: "sci-fi",
    people: [
      { id: 488, name: "Steven Spielberg" },
      { id: 491, name: "John Williams" },
    ],
    blurb: "Director and composer: Close Encounters of the Third Kind, E.T. the Extra-Terrestrial, Minority Report.",
  },
  {
    genre: "sci-fi",
    people: [
      { id: 525, name: "Christopher Nolan" },
      { id: 74401, name: "Hoyte van Hoytema" },
    ],
    blurb: "Director and cinematographer: Interstellar, Dunkirk, Tenet, Oppenheimer.",
  },
  {
    genre: "sci-fi",
    people: [
      { id: 2710, name: "James Cameron" },
      { id: 10205, name: "Sigourney Weaver" },
    ],
    blurb: "Director and actor: Aliens, Avatar, Avatar: The Way of Water.",
  },
  {
    genre: "sci-fi",
    people: [
      { id: 9340, name: "Lana Wachowski" },
      { id: 6384, name: "Keanu Reeves" },
    ],
    blurb: "Director and actor: The Matrix, The Matrix Reloaded, The Matrix Revolutions, The Matrix Resurrections.",
  },
  {
    genre: "sci-fi",
    people: [
      { id: 137427, name: "Denis Villeneuve" },
      { id: 947, name: "Hans Zimmer" },
    ],
    blurb: "Director and composer: Blade Runner 2049, Dune, Dune: Part Two.",
  },
  {
    genre: "sci-fi",
    people: [
      { id: 2036, name: "Alex Garland" },
      { id: 1162217, name: "Rob Hardy" },
    ],
    blurb: "A writer-director and a cinematographer: Ex Machina, Annihilation, Men, Civil War.",
  },
  {
    genre: "sci-fi",
    people: [
      { id: 3, name: "Harrison Ford" },
      { id: 1, name: "George Lucas" },
    ],
    blurb: "An actor and a writer: Star Wars, The Empire Strikes Back, Return of the Jedi, Raiders of the Lost Ark.",
  },
  {
    genre: "sci-fi",
    people: [
      { id: 525, name: "Christopher Nolan" },
      { id: 947, name: "Hans Zimmer" },
    ],
    blurb: "Director and composer: Batman Begins, Inception, Interstellar, Dunkirk.",
  },

  // Crime & Thriller
  {
    genre: "crime-thriller",
    people: [
      { id: 7467, name: "David Fincher" },
      { id: 287, name: "Brad Pitt" },
    ],
    blurb: "A director and an actor: Se7en, Fight Club, The Curious Case of Benjamin Button.",
  },
  {
    genre: "crime-thriller",
    people: [
      { id: 1223, name: "Joel Coen" },
      { id: 151, name: "Roger Deakins" },
    ],
    blurb: "From Barton Fink to Hail, Caesar!, the eye behind the Coens’ look.",
  },
  {
    genre: "crime-thriller",
    people: [
      { id: 138, name: "Quentin Tarantino" },
      { id: 2231, name: "Samuel L. Jackson" },
    ],
    blurb: "Director and actor: Pulp Fiction, Jackie Brown, Django Unchained, The Hateful Eight.",
  },
  {
    genre: "crime-thriller",
    people: [
      { id: 638, name: "Michael Mann" },
      { id: 11099, name: "Dante Spinotti" },
    ],
    blurb: "Director and cinematographer: Manhunter, Heat, The Insider, Public Enemies.",
  },
  {
    genre: "crime-thriller",
    people: [
      { id: 10099, name: "Park Chan-wook" },
      { id: 10107, name: "Chung Chung-hoon" },
    ],
    blurb: "Director and cinematographer: Oldboy, Thirst, Stoker, The Handmaiden.",
  },
  {
    genre: "crime-thriller",
    people: [
      { id: 1150, name: "Brian De Palma" },
      { id: 14138, name: "Pino Donaggio" },
    ],
    blurb: "Director and composer: Carrie, Dressed to Kill, Blow Out, Body Double.",
  },
  {
    genre: "crime-thriller",
    people: [
      { id: 1884, name: "Steven Soderbergh" },
      { id: 1461, name: "George Clooney" },
    ],
    blurb: "Director and actor: Out of Sight, Ocean's Eleven, Ocean's Twelve, Ocean's Thirteen.",
  },
  {
    genre: "crime-thriller",
    people: [
      { id: 956, name: "Guy Ritchie" },
      { id: 976, name: "Jason Statham" },
    ],
    blurb: "Director and actor: Lock, Stock and Two Smoking Barrels, Snatch, Revolver, Wrath of Man.",
  },
  {
    genre: "crime-thriller",
    people: [
      { id: 1032, name: "Martin Scorsese" },
      { id: 6193, name: "Leonardo DiCaprio" },
    ],
    blurb: "Director and actor: Gangs of New York, The Aviator, Shutter Island, The Wolf of Wall Street.",
  },
  {
    genre: "crime-thriller",
    people: [
      { id: 138, name: "Quentin Tarantino" },
      { id: 139, name: "Uma Thurman" },
    ],
    blurb: "Director and actor: Pulp Fiction, Kill Bill: Vol. 1, Kill Bill: Vol. 2.",
  },
  {
    genre: "crime-thriller",
    people: [
      { id: 138, name: "Quentin Tarantino" },
      { id: 287, name: "Brad Pitt" },
    ],
    blurb: "A writer-director and an actor: True Romance, Inglourious Basterds, Once Upon a Time... in Hollywood.",
  },

  // Comedy
  {
    genre: "comedy",
    people: [
      { id: 5655, name: "Wes Anderson" },
      { id: 1532, name: "Bill Murray" },
    ],
    blurb: "Director and actor: Rushmore, The Royal Tenenbaums, Moonrise Kingdom, The Grand Budapest Hotel.",
  },
  {
    genre: "comedy",
    people: [
      { id: 11090, name: "Edgar Wright" },
      { id: 11108, name: "Simon Pegg" },
    ],
    blurb: "Director and actor, both credited as writers: Shaun of the Dead, Hot Fuzz, The World's End.",
  },
  {
    genre: "comedy",
    people: [
      { id: 14639, name: "Mel Brooks" },
      { id: 3460, name: "Gene Wilder" },
    ],
    blurb: "Director and actor: The Producers, Blazing Saddles, Young Frankenstein.",
  },
  {
    genre: "comedy",
    people: [
      { id: 13524, name: "Christopher Guest" },
      { id: 26510, name: "Eugene Levy" },
    ],
    blurb: "Director and actor, both credited as writers: Waiting for Guffman, Best in Show, A Mighty Wind.",
  },
  {
    genre: "comedy",
    people: [
      { id: 3151, name: "Jack Lemmon" },
      { id: 6837, name: "Walter Matthau" },
    ],
    blurb: "Two actors on screen together: The Fortune Cookie, The Odd Couple, Grumpy Old Men.",
  },
  {
    genre: "comedy",
    people: [
      { id: 31, name: "Tom Hanks" },
      { id: 5344, name: "Meg Ryan" },
    ],
    blurb: "Two actors on screen together: Joe Versus the Volcano, Sleepless in Seattle, You've Got Mail.",
  },

  // Drama
  {
    genre: "drama",
    people: [
      { id: 7467, name: "David Fincher" },
      { id: 7479, name: "Jeff Cronenweth" },
    ],
    blurb: "A director and a cinematographer: Fight Club, The Social Network, Gone Girl.",
  },
  {
    genre: "drama",
    people: [
      { id: 136495, name: "Damien Chazelle" },
      { id: 1419631, name: "Justin Hurwitz" },
    ],
    blurb: "Whiplash, La La Land, First Man, Babylon: a director and a composer.",
  },
  {
    genre: "drama",
    people: [
      { id: 4762, name: "Paul Thomas Anderson" },
      { id: 74333, name: "Jonny Greenwood" },
    ],
    blurb: "Director and composer: There Will Be Blood, The Master, Phantom Thread, Licorice Pizza.",
  },
  {
    genre: "drama",
    people: [
      { id: 30715, name: "Terrence Malick" },
      { id: 4185, name: "Emmanuel Lubezki" },
    ],
    blurb: "Director and cinematographer: The New World, The Tree of Life, To the Wonder, Knight of Cups.",
  },
  {
    genre: "drama",
    people: [
      { id: 564, name: "Richard Linklater" },
      { id: 569, name: "Ethan Hawke" },
    ],
    blurb: "Director and actor: Before Sunrise, Before Sunset, Before Midnight, Boyhood.",
  },
  {
    genre: "drama",
    people: [
      { id: 15488, name: "Ken Loach" },
      { id: 15490, name: "Paul Laverty" },
    ],
    blurb: "A director and a screenwriter: Sweet Sixteen, The Wind That Shakes the Barley, The Angels' Share, Sorry We Missed You.",
  },
  {
    genre: "drama",
    people: [
      { id: 16863, name: "Todd Haynes" },
      { id: 1231, name: "Julianne Moore" },
    ],
    blurb: "Director and actor: Safe, Far from Heaven, I'm Not There, May December.",
  },
  {
    genre: "drama",
    people: [
      { id: 92784, name: "Barry Jenkins" },
      { id: 960350, name: "James Laxton" },
    ],
    blurb: "Director and cinematographer: Medicine for Melancholy, Moonlight, If Beale Street Could Talk.",
  },
  {
    genre: "drama",
    people: [
      { id: 488, name: "Steven Spielberg" },
      { id: 31, name: "Tom Hanks" },
    ],
    blurb: "Director and actor: Saving Private Ryan, Catch Me If You Can, The Terminal, Bridge of Spies.",
  },
  {
    genre: "drama",
    people: [
      { id: 24, name: "Robert Zemeckis" },
      { id: 31, name: "Tom Hanks" },
    ],
    blurb: "Director and actor: Forrest Gump, Cast Away, The Polar Express, Pinocchio.",
  },
  {
    genre: "drama",
    people: [
      { id: 380, name: "Robert De Niro" },
      { id: 6193, name: "Leonardo DiCaprio" },
    ],
    blurb: "Two actors on screen together: This Boy's Life, Marvin's Room, Killers of the Flower Moon.",
  },

  // Action & Western
  {
    genre: "action-western",
    people: [
      { id: 4385, name: "Sergio Leone" },
      { id: 1259, name: "Ennio Morricone" },
    ],
    blurb: "Director and composer: A Fistful of Dollars, The Good, the Bad and the Ugly, Once Upon a Time in the West.",
  },
  {
    genre: "action-western",
    people: [
      { id: 8500, name: "John Ford" },
      { id: 4165, name: "John Wayne" },
    ],
    blurb: "Director and actor: Stagecoach, The Searchers, The Man Who Shot Liberty Valance.",
  },
  {
    genre: "action-western",
    people: [
      { id: 11401, name: "John Woo" },
      { id: 1619, name: "Chow Yun-Fat" },
    ],
    blurb: "Director and actor: A Better Tomorrow, The Killer, Hard Boiled.",
  },
  {
    genre: "action-western",
    people: [
      { id: 20629, name: "George Miller" },
      { id: 2461, name: "Mel Gibson" },
    ],
    blurb: "Director and actor: Mad Max, Mad Max 2, Mad Max Beyond Thunderdome.",
  },
  {
    genre: "action-western",
    people: [
      { id: 893, name: "Tony Scott" },
      { id: 5292, name: "Denzel Washington" },
    ],
    blurb: "Director and actor: Crimson Tide, Man on Fire, Déjà Vu, Unstoppable.",
  },
  {
    genre: "action-western",
    people: [
      { id: 9033, name: "Christopher McQuarrie" },
      { id: 500, name: "Tom Cruise" },
    ],
    blurb: "A writer-director and an actor: Jack Reacher, Edge of Tomorrow, Mission: Impossible - Fallout, Top Gun: Maverick.",
  },
  {
    genre: "action-western",
    people: [
      { id: 3, name: "Harrison Ford" },
      { id: 488, name: "Steven Spielberg" },
    ],
    blurb: "Actor and director: Raiders of the Lost Ark, Indiana Jones and the Temple of Doom, Indiana Jones and the Last Crusade.",
  },
  {
    genre: "action-western",
    people: [
      { id: 1, name: "George Lucas" },
      { id: 488, name: "Steven Spielberg" },
    ],
    blurb: "A writer and a director: Raiders of the Lost Ark, Indiana Jones and the Temple of Doom, Indiana Jones and the Last Crusade.",
  },
  {
    genre: "action-western",
    people: [
      { id: 525, name: "Christopher Nolan" },
      { id: 3894, name: "Christian Bale" },
    ],
    blurb: "Director and actor: Batman Begins, The Prestige, The Dark Knight, The Dark Knight Rises.",
  },

  // World Cinema
  {
    genre: "world-cinema",
    people: [
      { id: 21684, name: "Bong Joon Ho" },
      { id: 20738, name: "Song Kang-ho" },
    ],
    blurb: "A director and an actor: Memories of Murder, The Host, Snowpiercer, Parasite.",
  },
  {
    genre: "world-cinema",
    people: [
      { id: 5026, name: "Akira Kurosawa" },
      { id: 7450, name: "Toshirō Mifune" },
    ],
    blurb: "Director and actor: Rashomon, Seven Samurai, Throne of Blood, Yojimbo, High and Low.",
  },
  {
    genre: "world-cinema",
    people: [
      { id: 4415, name: "Federico Fellini" },
      { id: 3098, name: "Nino Rota" },
    ],
    blurb: "Director and composer: La Strada, La Dolce Vita, 8½, Amarcord.",
  },
  {
    genre: "world-cinema",
    people: [
      { id: 6648, name: "Ingmar Bergman" },
      { id: 11905, name: "Sven Nykvist" },
    ],
    blurb: "Director and cinematographer: Through a Glass Darkly, Persona, Cries and Whispers, Fanny and Alexander.",
  },
  {
    genre: "world-cinema",
    people: [
      { id: 12453, name: "Wong Kar-wai" },
      { id: 1337, name: "Tony Leung Chiu-wai" },
    ],
    blurb: "Director and actor: Days of Being Wild, Chungking Express, In the Mood for Love, 2046.",
  },
  {
    genre: "world-cinema",
    people: [
      { id: 309, name: "Pedro Almodóvar" },
      { id: 955, name: "Penélope Cruz" },
    ],
    blurb: "Director and actor: All About My Mother, Volver, Broken Embraces, Pain and Glory.",
  },
  {
    genre: "world-cinema",
    people: [
      { id: 607, name: "Zhang Yimou" },
      { id: 643, name: "Gong Li" },
    ],
    blurb: "Director and actor: Red Sorghum, Raise the Red Lantern, The Story of Qiu Ju, To Live.",
  },

  // Animation
  {
    genre: "animation",
    people: [
      { id: 608, name: "Hayao Miyazaki" },
      { id: 636, name: "Joe Hisaishi" },
    ],
    blurb: "Director and composer: My Neighbor Totoro, Princess Mononoke, Spirited Away, The Boy and the Heron.",
  },
  {
    genre: "animation",
    people: [
      { id: 510, name: "Tim Burton" },
      { id: 85, name: "Johnny Depp" },
    ],
    blurb: "Director and actor: Edward Scissorhands, Ed Wood, Sleepy Hollow, Corpse Bride.",
  },
  {
    genre: "animation",
    people: [
      { id: 7879, name: "John Lasseter" },
      { id: 7885, name: "Randy Newman" },
    ],
    blurb: "Director and composer: Toy Story, A Bug's Life, Toy Story 2, Cars.",
  },
  {
    genre: "animation",
    people: [
      { id: 15810, name: "Ron Clements" },
      { id: 15813, name: "Alan Menken" },
    ],
    blurb: "Director and composer: The Little Mermaid, Aladdin, Hercules.",
  },
  {
    genre: "animation",
    people: [
      { id: 69797, name: "Dean DeBlois" },
      { id: 17276, name: "Gerard Butler" },
    ],
    blurb: "Director and actor: How to Train Your Dragon, How to Train Your Dragon 2, How to Train Your Dragon: The Hidden World.",
  },
  {
    genre: "animation",
    people: [
      { id: 107446, name: "Phil Lord" },
      { id: 155267, name: "Christopher Miller" },
    ],
    blurb: "A directing duo: Cloudy with a Chance of Meatballs, 21 Jump Street, The Lego Movie.",
  },
];

/** A pairing needs at least this many shared films (default rules) to be worth showing. */
export const MIN_SHARED_FILMS = 3;

/** How many shared-film posters each pairing records for the landing hero. */
export const HERO_POSTER_COUNT = 3;

/** A shared film's poster, with what its `alt` and `title` need. */
export interface GeneratedPoster {
  /** TMDB `poster_path`, e.g. "/abc.jpg". */
  path: string;
  title: string;
  year: number;
}

/** What `npm run examples:refresh` records per pairing, keyed by `pairingKey`. */
export interface GeneratedPairing {
  /** Films all people share by the pair page's default rules (non-minor credits). */
  sharedCount: number;
  /** In the same order as the pairing's people, with TMDB's canonical names and photos. */
  people: { id: number; name: string; profilePath: string }[];
  /**
   * Posters of the HERO_POSTER_COUNT most-voted shared films that have one, oldest film first
   * (so they read left to right like the timeline).
   */
  posters: GeneratedPoster[];
}

export type GeneratedExamples = Record<string, GeneratedPairing>;

export function pairingHref(pairing: Pick<ExamplePairing, "people">): string {
  return `/p/${buildPeopleSlug(pairing.people)}`;
}

/**
 * Identifies a pairing regardless of the order its people are listed in: the ids, sorted.
 * The key of its entry in examples.generated.json, and what "the same pairing twice" means.
 */
export function pairingKey(pairing: Pick<ExamplePairing, "people">): string {
  return pairing.people
    .map((person) => person.id)
    .sort((a, b) => a - b)
    .join("+");
}
