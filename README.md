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

## Layout

- `src/lib`: pure data modules (roles, normalizing TMDB credits, shared films, URL slugs, CSV) and the server-only TMDB client.
- `src/app/api`: `/api/search` and `/api/movie/[id]`, rate limited per IP.
- `src/app/p/[people]`: the shareable timeline page.
- `scripts/`: `refresh-examples.ts` and the small Node loader it runs under (see below).
- Design tokens live in `src/app/globals.css` (dark theme, Tailwind names such as `bg-surface`, `text-muted`, `text-accent-green`).

## Landing page pairings

The "Try a pairing" cards on `/` are curated by hand in `src/lib/examples.ts` (genre, people, a one-line blurb). The page itself never calls TMDB: it renders from `src/lib/examples.generated.json`, which holds each person's canonical TMDB name and photo plus the "N films together" count, so `/` is statically prerendered.

After adding or changing a pairing, run:

```
npm run examples:refresh
```

It needs `TMDB_READ_ACCESS_TOKEN` (from `.env` or the environment) and Node 22.9 or newer, and uses Node's built-in TypeScript support, so there is nothing extra to install. It checks every pairing against live TMDB and writes the JSON only if all of them pass. It fails when a person id does not resolve, a name differs from TMDB's (the link would redirect), a pairing shares fewer than 3 films by the pair page's default rules, someone has no profile photo, or a pairing is listed twice. The counts use the same code as the `/p/` page, so a card always matches its page. Commit the regenerated JSON; `npm test` fails if it is out of date. Counts can drift as TMDB adds films (including announced ones), so refresh now and then.

Blurbs are plain text: name only films that are in the pair's shared list on its `/p/` page, and only roles that page shows for them.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

To be decided.
