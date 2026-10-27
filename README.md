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

## Layout

- `src/lib`: pure data modules (roles, normalizing TMDB credits, shared films, URL slugs, CSV) and the server-only TMDB client.
- `src/app/api`: `/api/search` and `/api/movie/[id]`, rate limited per IP.
- `src/app/p/[people]`: the shareable timeline page.
- Design tokens live in `src/app/globals.css` (dark theme, Tailwind names such as `bg-surface`, `text-muted`, `text-accent-green`).

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

To be decided.
