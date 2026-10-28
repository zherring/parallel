# Parallel

Search any actor, director, writer, cinematographer (or anyone else in film) and get a horizontal timeline of their films, poster by poster, year by year. Add more people as parallel lanes: the films they share line up vertically and light up. Export the shared list to Letterboxd as a CSV.

Free and open source. Film data comes from [TMDB](https://www.themoviedb.org/).

Pages are server-rendered and shareable: `/p/7467-david-fincher+1234-jeff-cronenweth`.

**Only released films count as shared.** TMDB also lists announced films that have not come out yet. A film counts as shared, as a connection between lanes, in the "N films together" heading, table, CSV export, share text, page description and preview card only once its release date is on or before today (UTC). Until then it stays on each person's lane as an ordinary "Upcoming" poster (dashed border), but it is never lit, never joined by a line, never given a pair colour, and does not make the pair "connected" (so it does not quiet the other posters). The rule lives in one place, `src/lib/released.ts` (`isReleased`), and the page computes today once on the server and hands it to the client, so the server and the browser draw the same timeline. This also means the counts change as films are released, which is why the generated landing data needs a refresh now and then (see below).

## Setup

Requires Node 22 or newer and a TMDB API read access token (free, from your TMDB account settings).

1. Create a `.env` file in the project root:

   ```
   TMDB_READ_ACCESS_TOKEN=your_read_access_token
   ```

   Optional: `NEXT_PUBLIC_SITE_URL` (defaults to `https://parallel.zachherring.com`) sets the base for canonical and social URLs.

2. Install and run:

   ```
   npm install
   npm run dev
   ```

The token is only read on the server and is never sent to the browser.

## Scripts

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server                  |
| `npm run build`     | Production build                      |
| `npm start`         | Serve the build on `$PORT` (def 3000) |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | `tsc --noEmit`                        |
| `npm test`          | Vitest unit tests (TMDB is mocked)    |
| `npm run examples:refresh` | Re-check the landing pairings against TMDB (see below) |
| `npm run people:refresh` | Rebuild the local people search index and the collaborator graph from TMDB (see "People search index" and "Frequent collaborators") |
| `npm run people:eval` | Measure how well the search finds people for ~50 realistic queries |
| `npm run awards:refresh` | Rebuild the Oscar / festival awards data from Wikidata (see "Awards data"); `-- --validate` checks the live endpoint |

## Layout

- `src/lib`: pure data modules (roles, normalizing TMDB credits, shared films, URL slugs, CSV) and the server-only TMDB client.
- `src/app/api`: `/api/search`, `/api/movie/[id]`, `/api/film-metrics` and `/api/collaborators/[id]`, rate limited per IP.
- `src/app/p/[people]`: the shareable timeline page.
- `scripts/`: the refresh scripts (`refresh-examples.ts`, `refresh-people-index.ts`, `refresh-awards.ts`) and the small Node loader they run under (see below).
- Design tokens live in `src/app/globals.css` (dark theme, Tailwind names such as `bg-surface`, `text-muted`, `text-accent-green`).

## Landing page pairings

The "Try a pairing" cards on `/` are curated by hand in `src/lib/examples.ts` (genre, people, a one-line blurb). The page itself never calls TMDB: it renders from `src/lib/examples.generated.json`, which holds each person's canonical TMDB name and photo plus the "N films together" count, so `/` is statically prerendered. Every pairing belongs to exactly one genre tab; the first tab, Featured, is not stored but shows 6 pairings picked at random (one per genre) in the browser after load, with a fixed default sample in the server HTML for crawlers and visitors without JavaScript.

After adding or changing a pairing, run:

```
npm run examples:refresh
```

It needs `TMDB_READ_ACCESS_TOKEN` (from `.env` or the environment) and Node 22.9 or newer, and uses Node's built-in TypeScript support, so there is nothing extra to install. It checks every pairing against live TMDB and writes the JSON only if all of them pass. It fails when a person id does not resolve, a name differs from TMDB's (the link would redirect), a pairing shares fewer than 3 released films by the pair page's default rules, someone has no profile photo, fewer than 3 of the shared films have a poster, or a pairing is listed twice. The counts use the same code as the `/p/` page, so a card always matches its page. Commit the regenerated JSON; `npm test` fails if it is out of date. Only released films count (announced films do not, see above), so a count grows when an announced film comes out and also drifts when TMDB adds, removes or re-dates films; refresh now and then, and after a major release.

The hero above the headline (`src/components/landing/hero-collage.tsx`) is a collage of one pairing at a time: two portraits and, hanging on one faded timeline line below them, the posters of the (up to) 5 most-voted films they share (also recorded in the JSON), with a quiet "+N more" at the right end of the row when the pair shares more films than that, all as one link to their page. The posters sit on the timeline line below the people; nothing else (no connector) joins the two. Every few seconds it changes to another pairing, sometimes both people and sometimes only one, which is why several people appear in more than one pairing in `examples.ts`. It rotates only through pairings that share a person with another one (`heroPool` in `src/lib/hero-scenes.ts`, where the scene rules are), opens on Harrison Ford and George Lucas, and pauses on hover, focus, press, typing in the search field, off-screen, a hidden tab and its pause button; with reduced motion it does not autoplay.

Blurbs are plain text: name only films that are in the pair's shared list on its `/p/` page, and only roles that page shows for them.

## People search index

TMDB's `/search/person` matches whole words only (no prefixes, no typo tolerance) and ranks by text relevance, so "speil" never finds Steven Spielberg and "georg" returns people named Georg. For type-ahead, `/api/search` also searches a local index of the people a film lover looks for and merges the two:

- `src/lib/people-index.generated.json` (about 1.5 MB, one line) holds roughly 18,000 people: the 3,000 most popular, the key crew (director, writers, cinematographer, editor, composer, production and costume designers) and top 12 billed cast of the ~1,800 most notable films, and everyone in `src/lib/examples.ts`. Per person: id, name, photo, department, TMDB popularity, how many of those notable films they are credited on, and up to 3 "known for" titles.
- `src/lib/people-match.ts` matches a query against it: the start of the full name, the start of each word in any order (the last word is "still being typed"), and typos within a small edit distance, then ranks by notability (log-scaled popularity and film credits) so famous people beat obscure namesakes. A query takes a few milliseconds.
- `src/app/api/search/route.ts` runs the matcher and TMDB's own search at the same time (TMDB gets 1.5 seconds): strong local matches first, then TMDB's results by popularity, at most 8. If TMDB fails or times out the local results are returned alone; if the index finds nothing, TMDB's results are.

The index is only loaded on the server and never ships to the browser.

```
npm run people:refresh
```

It needs `TMDB_READ_ACCESS_TOKEN` and Node 22.9 or newer, like `examples:refresh`, makes about 2,000 TMDB requests (8 at a time, with retries and backoff; a cold crawl took about 13 minutes when last run, a rerun from the cache under a second) and caches every response under `node_modules/.cache/parallel-people-index` (set `PEOPLE_INDEX_CACHE_DIR` to move it, pass `--no-cache` for a fresh crawl) so a rerun costs nothing. It writes the JSON only when every person in `examples.ts` is in it, so run it after adding people there; `npm test` fails if one is missing. The same run also writes `src/lib/collaborators.generated.json`, the collaborator graph behind the "Frequent collaborators" chips (see that section), from the credits it has already fetched.

**Regenerate the index at least every six months.** TMDB's terms limit how long cached TMDB data may be kept, and both generated files (the index and the collaborator graph, written by the same run with the same `generatedAt`) carry a timestamp so their age is visible. Run `npm run people:refresh`, check `npm test` and `npm run people:eval` (hit rates) still look right, and commit both files. `npm run people:eval -- --tmdb` also runs the same queries through TMDB's raw search for comparison (one live call per query).

## Frequent collaborators

On a single-person page, next to the "Add person" field (below it on narrower screens), a row of chips suggests the people that person has worked with most: their usual director, cinematographer, composer, editor and co-stars. Each chip shows a photo, the name, their roles ("Director") and the number of films together ("4 films"); a click adds them to the timeline, exactly like picking a search result. The chip's count is the one the pair page then shows as "N films together" (released, non-minor films only), and hovering a chip names the best-known films they share. The row loads after the page is on screen (the server HTML never waits on it and does not change), shows a few skeleton chips meanwhile, scrolls sideways when it does not fit, and disappears when there is nothing to suggest or anything fails (no error text). Multi-person pages do not show it.

TMDB has no collaborator endpoint, and counting live means fetching the credits of every film of the person (64 for Harrison Ford, 169 for Brad Pitt), so the suggestions are found in two steps:

1. **Candidates from a precomputed graph, with no TMDB call.** `src/lib/collaborators.generated.json` (about 0.16 MB, one line, ids and counts only, plus `generatedAt`) holds, for each of the roughly 1,900 people the crawl knows well, up to 16 candidates: the people credited next to them on the most of the ~1,800 notable films of the people index crawl, at least 2 shared films each. Who counts is the pair page's definition of a non-minor credit (top 12 billed cast, never uncredited or self appearances; every crew job that is not "other", so directors, writers, cinematographers, editors, composers, producers and designers). The 16 are picked for variety (`pickSuggestions`, `src/lib/role-groups.ts`): the best 2 of each role group (Directing, Camera, Writing, Music, Editing, Acting, other) first, the rest by count, because a star's top collaborators by count are often all co-stars. `src/lib/collaborator-graph.ts` builds it, `src/lib/collaborators-index.ts` loads it lazily on the server (dynamic import, `server-only`), so it is in no client bundle.
2. **Exact counts for what is shown** (`src/lib/collaborators.ts`, `src/lib/collaborator-verify.ts`). The candidates' filmographies are loaded 6 at a time with `getPersonMovieCredits` and the shared films are counted with `sharedFilms([a, b], { includeMinor: false })`, the pair page's own code, so a chip can never disagree with its page. Candidates under 2 shared films drop out, the rest are re-ranked by the exact count (ties by notability) and `pickSuggestions` makes the final list of at most 10 varied again (the best 2 per role group first, then by count; the result is ordered by count). The list is remembered in memory for 3 hours (LRU of 200 people; TMDB's own responses are cached for a day), requests for the same person made at once share one computation, and a list that is missing candidates because TMDB failed for some of them is not remembered.

A person the graph has no row for (not in the crawl, or fewer than 3 candidates) is counted live instead: credits of their 25 best-known released films by vote count (`/movie/{id}/credits`, 6 at a time), counted the same way, then verified as above. The API says which one answered (`source`: `"graph"` or `"live"`).

`GET /api/collaborators/{personId}` returns `{ source, results: [{ id, name, profilePath, sharedCount, roles, titles }] }`: `roles` is what the collaborator did on the shared films, as `roleSummary` words it ("Director, Writer"), and `titles` the up to 3 most-voted shared films. It answers 400 for an id that is not a positive integer, 404 for a person TMDB does not know, and the usual 502 and 500 when TMDB or the server fails. Cache headers are `public, s-maxage=3600, stale-while-revalidate=86400`, and the route sits inside the `/api` rate limit.

A cold graph-path request makes about 55 TMDB requests (17 people at 2 to 3 requests each) that the 24 hour fetch cache then keeps; a repeat is answered from memory in a few milliseconds. The graph only knows the crawled notable films, so its counts are low and its candidate list can miss someone who mostly worked outside them; the exact verification is what makes the shown numbers right, not what makes the list complete.

The graph is regenerated by `npm run people:refresh`, together with the people index, from the same crawl and cache, at no extra TMDB cost; both files carry the same `generatedAt`. The six-month rule for TMDB data applies to it exactly as to the index (see below).

## Awards data

The film hover card can show an awards row: Oscar wins and nominations ("4 Oscars · 6 nominations") and the top prize of Cannes (Palme d'Or), Venice (Golden Lion) or Berlin (Golden Bear). It exists for the **curated films only**: the films in the default (non-minor, released) shared-film list of every pairing in `src/lib/examples.ts`, found with the same code the pair page uses and de-duplicated by TMDB id. For any other film, and for a curated film with no Oscar record and no prize, there is no entry and the row is hidden ("no data" is not "no awards").

- **Source and licence.** [Wikidata](https://www.wikidata.org/) (CC0, credited in the footer), read through the Wikidata Query Service and joined on the TMDB movie id (property P4947). Nothing comes from OMDb or any IMDb-derived data. BAFTA and the Golden Globes are deliberately not shown.
- `src/lib/awards.generated.json` (about 7 KB, one line) holds `{ generatedAt, films: { "<tmdbId>": { w, n, f } } }`: Oscar wins, Oscar nominations (wins included, as the Academy counts them) and the festival prizes won, only for films with at least one of them. `awardsFor(tmdbId)` in `src/lib/awards.ts` returns `AwardsSummary | null` from it, loaded once on the server through a dynamic import (it is not in any client bundle). A festival-only film (a Golden Bear and no Oscar record) has `w` and `n` of 0.
- `src/lib/awards-wikidata.ts` has the SPARQL and the counting rules; `scripts/refresh-awards.ts` (with `awards-corpus.ts` and `awards-wikidata-client.ts`) runs them; `src/lib/awards-truth.ts` holds the films with known tallies.

```
npm run awards:refresh                     # rebuild the file
npm run awards:refresh -- --validate       # regression check of the live endpoint, no TMDB needed
npm run awards:refresh -- --dry-run        # everything except writing the file
npm run awards:refresh -- --explain 238    # how a film's counts add up, category by category
npm run awards:refresh -- --force          # write even if a safety check fails
```

It needs `TMDB_READ_ACCESS_TOKEN` (only to find the films) and Node 22.9 or newer, like the other refresh scripts. TMDB responses are cached on disk (`node_modules/.cache/parallel-awards`; set `AWARDS_CACHE_DIR` to move it, `--no-cache` for a fresh crawl). Wikidata costs one request per 50 films (11 for the 544 films of the 72 pairings: a few seconds once TMDB is cached, about 20 on a cold run), at most 2 at a time, with the user agent `ParallelBot/0.1 (https://github.com/zherring/parallel)` and backoff on HTTP 429 and 5xx; a batch the service times out on is split in halves. The script writes nothing when the result is empty, when films with data drop by more than 30% against the committed file, or when a film of the validation set that is in the corpus differs from the Academy's tally (`--force` overrides).

**Regenerate at least every six months, and whenever pairings change.** The film selection comes from TMDB, whose terms limit how long data derived from it may be kept, and the file carries a `generatedAt` timestamp so its age is visible. Run `npm run awards:refresh`, check `npm test`, and commit the result. After adding a pairing, compare its films with the Academy's database: a film that Wikidata cannot link to a song nomination is short by one (see below).

### How the numbers are counted

Per film, from Wikidata's statements on the film and on people whose "for work" qualifier is the film. A category counts once however many statements, people or ranks mention it, and a win is also a nomination. The Academy's own counting is followed where Wikidata allows it:

- each nominee of an acting category is a nomination of its own (The Godfather has three Supporting Actor nominees: 10 nominations, not 8), and so is each nominated song (Aladdin has two song nominations);
- nominations the Academy withdrew are kept in Wikidata with deprecated rank and are skipped (The Godfather's score);
- honorary, scientific and Special Achievement awards are not competitive categories and are not counted (Star Wars: 6 wins and 10 nominations, plus a Special Achievement Award that is not shown);
- a Best Original Song award is attached to the song, not the film. It is attributed to a film through the song's link to it (several properties, or the film's soundtrack album), and only when the song's ceremony is within two years after the film's release year, so a remake's soundtrack does not inherit the original's songs;
- festival prizes count only from statements on the film item itself, never from a person's statement: Wikidata has Park Chan-wook winning the Golden Lion for Lady Vengeance, but the 2005 Golden Lion went to Brokeback Mountain.

### Validation

`npm run awards:refresh -- --validate` asks the live endpoint about 26 films with the Academy's official tallies (the validation set of the feasibility spike), 14 more that exercise songs, several songs in one film and Special Achievement awards, and 6 festival winners. It prints a table and exits non-zero on any mismatch: **26 of 26, 14 of 14 and 6 of 6** as of 2026-10-27. Run it after any change to the query and against any new endpoint. `src/lib/awards.generated.test.ts` runs the same truth set against the committed JSON (skipping films that are not in the corpus), so a bad regeneration fails `npm test` without the network.

Beyond that set, the file was compared with the Academy-style counts in Wikipedia's "List of Academy Award-winning films" (a check made once, not part of the repository): of the 105 curated films on that list, 103 matched on both wins and nominations.

### Known limitations

- **Only what Wikidata has.** Counts come from volunteer-maintained statements, so a film can be short by a nomination, rarely more. Known causes: a Best Original Song item that Wikidata links to no film (or whose nomination names no film at all); both sound nominations (editing and mixing) filed under one category item, which loses one (First Man and Once Upon a Time... in Hollywood each show one nomination too few); a nomination recorded on a person without a "for work" qualifier, which cannot be attributed (Blazing Saddles' title song is missing).
- **Manual song links.** `SONG_LINK_OVERRIDES` in `src/lib/awards-wikidata.ts` links nine Best Original Song items that Wikidata does not connect to their film (Aladdin, La La Land, Toy Story 2 and 4, The Godfather Part III, Hook, A Mighty Wind and The Man Who Knew Too Much). They were found by listing the unlinked song items and matching them against the curated films; when a pairing adds a song-nominated film, add the song's Wikidata id there if the film comes out one nomination short.
- BAFTA and the Golden Globes are not included. Only the Palme d'Or, Golden Lion and Golden Bear are shown, not other festival prizes or earlier names of these prizes.
- A film with neither an Oscar record nor one of the three prizes has no entry, so "no row" cannot tell "never nominated" from "Wikidata has nothing".

### The query service migration

The Wikidata Query Service is moving from Blazegraph to QLever (new endpoints are expected around 16 November 2026; the old ones may degrade from February 2027). The queries are plain SPARQL 1.1 plus the Wikibase RDF vocabulary, with no label service and no Blazegraph-only syntax, and the endpoint is configurable: set `WDQS_ENDPOINT` (default `https://query.wikidata.org/sparql`). After a switch, run `npm run awards:refresh -- --validate` first: it is the regression test for the migration, and a dry run (`--dry-run`) shows whether the totals changed. The queries have only been run against the Blazegraph backend.

## Ideas and TODOs

Nothing open right now.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

Awards data comes from Wikidata (CC0).

## License

[MIT](LICENSE). Film data and images come from TMDB and remain subject to [TMDB's terms](https://www.themoviedb.org/api-terms-of-use). Awards data comes from [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) (CC0).
