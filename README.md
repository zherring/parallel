# Parallel

Search any actor, director, writer, cinematographer (or anyone else in film) and get a horizontal timeline of their films, poster by poster, year by year. Add more people as parallel lanes: the films they share line up vertically and light up. Export the shared list to Letterboxd as a CSV.

Free and open source. Film data comes from [TMDB](https://www.themoviedb.org/).

Pages are server-rendered and shareable: `/p/7467-david-fincher+1234-jeff-cronenweth`.

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
| `npm run people:refresh` | Rebuild the local people search index from TMDB (see "People search index") |
| `npm run people:eval` | Measure how well the search finds people for ~50 realistic queries |

## Layout

- `src/lib`: pure data modules (roles, normalizing TMDB credits, shared films, URL slugs, CSV) and the server-only TMDB client.
- `src/app/api`: `/api/search` and `/api/movie/[id]`, rate limited per IP.
- `src/app/p/[people]`: the shareable timeline page.
- `scripts/`: `refresh-examples.ts` and the small Node loader it runs under (see below).
- Design tokens live in `src/app/globals.css` (dark theme, Tailwind names such as `bg-surface`, `text-muted`, `text-accent-green`).

## Landing page pairings

The "Try a pairing" cards on `/` are curated by hand in `src/lib/examples.ts` (genre, people, a one-line blurb). The page itself never calls TMDB: it renders from `src/lib/examples.generated.json`, which holds each person's canonical TMDB name and photo plus the "N films together" count, so `/` is statically prerendered. Every pairing belongs to exactly one genre tab; the first tab, Featured, is not stored but shows 6 pairings picked at random (one per genre) in the browser after load, with a fixed default sample in the server HTML for crawlers and visitors without JavaScript.

After adding or changing a pairing, run:

```
npm run examples:refresh
```

It needs `TMDB_READ_ACCESS_TOKEN` (from `.env` or the environment) and Node 22.9 or newer, and uses Node's built-in TypeScript support, so there is nothing extra to install. It checks every pairing against live TMDB and writes the JSON only if all of them pass. It fails when a person id does not resolve, a name differs from TMDB's (the link would redirect), a pairing shares fewer than 3 films by the pair page's default rules, someone has no profile photo, fewer than 3 of the shared films have a poster, or a pairing is listed twice. The counts use the same code as the `/p/` page, so a card always matches its page. Commit the regenerated JSON; `npm test` fails if it is out of date. Counts can drift as TMDB adds films (including announced ones), so refresh now and then.

The hero above the headline (`src/components/landing/hero-collage.tsx`) is a collage of one pairing at a time: two portraits and the posters of the 3 most-voted films they share (also recorded in the JSON), as one link to their page. Every few seconds it changes to another pairing, sometimes both people and sometimes only one, which is why several people appear in more than one pairing in `examples.ts`. It rotates only through pairings that share a person with another one (`heroPool` in `src/lib/hero-scenes.ts`, where the scene rules are), opens on Harrison Ford and George Lucas, and pauses on hover, focus, press, typing in the search field, off-screen, a hidden tab and its pause button; with reduced motion it does not autoplay.

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

It needs `TMDB_READ_ACCESS_TOKEN` and Node 22.9 or newer, like `examples:refresh`, makes about 2,000 TMDB requests (8 at a time, with retries and backoff) in a minute or two, and caches every response under `node_modules/.cache/parallel-people-index` (set `PEOPLE_INDEX_CACHE_DIR` to move it, pass `--no-cache` for a fresh crawl) so a rerun costs nothing. It writes the JSON only when every person in `examples.ts` is in it, so run it after adding people there; `npm test` fails if one is missing.

**Regenerate the index at least every six months.** TMDB's terms limit how long cached TMDB data may be kept, and the file carries a `generatedAt` timestamp so its age is visible. Run `npm run people:refresh`, check `npm test` and `npm run people:eval` (hit rates) still look right, and commit the result. `npm run people:eval -- --tmdb` also runs the same queries through TMDB's raw search for comparison (one live call per query).

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

[MIT](LICENSE). Film data and images come from TMDB and remain subject to [TMDB's terms](https://www.themoviedb.org/api-terms-of-use).
