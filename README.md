# Parallel

Search any actor, director, writer, cinematographer (or anyone else in film) and get a horizontal timeline of their films, poster by poster, year by year. Add more people as parallel lanes: the films they share line up vertically and light up. 

Export the film list to CSV: title, year, release date, credits, TMDB rating, box office, budget, gross multiple and awards, in the order the table is sorted.

Free and open source. Film data comes from [TMDB](https://www.themoviedb.org/).

Pages are server-rendered and shareable: `/p/7467-david-fincher+1234-jeff-cronenweth`.

**Only released films count as shared.** TMDB also lists announced films that have not come out yet. A film counts as shared, as a connection between lanes, in the page headline's film count ("Harrison Ford & George Lucas, 11 films"), table, CSV export, share text, page description and preview card only once its release date is on or before today (UTC). Until then it stays on each person's lane as an ordinary "Upcoming" poster (dashed border), but it is never lit, never joined by a line, never given a pair colour, and does not make the pair "connected" (so it does not quiet the other posters). The rule lives in one place, `src/lib/released.ts` (`isReleased`), and the page computes today once on the server and hands it to the client, so the server and the browser draw the same timeline. This also means the counts change as films are released, which is why the generated landing data needs a refresh now and then (see below).

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
| `npm run test:browser` | Playwright scroll regressions in Chromium (TMDB is mocked) |
| `npm run examples:refresh` | Re-check the landing pairings against TMDB (see below) |
| `npm run people:refresh` | Rebuild the local people search index and the collaborator graph from TMDB (see "People search index" and "Frequent collaborators") |
| `npm run people:eval` | Measure how well the search finds people for ~50 realistic queries |
| `npm run awards:refresh` | Rebuild the Oscar / festival awards data from Wikidata (see "Awards data"); `-- --validate` checks the live endpoint |

### Browser regressions

Install Chromium once, then run the browser suite:

```sh
npx playwright install chromium
npm run test:browser
```

The suite starts an isolated Next.js server on `127.0.0.1:3102`, with its own
`.next-playwright` cache, so it can run alongside the normal dev server. Next's
test fetch proxy supplies deterministic TMDB fixtures: no real API token or
external movie data is needed. The proxy is enabled only for this test server.

Tests cover initial Combined baseline placement (including linked periods and
first opening Timeline from Table), vertical scroll preservation during manual
zoom with all films shown, the Timeline filling the screen under the page bar with its
minimap pinned to the bottom, and the first row of posters clear of the bar. A second spec (`depth-view.spec.ts`) smoke-tests
the Depth view: it opens at its start (scrolled to the top, the earliest year under the hero's band), a linked period dims
the posters outside it, a poster opens the film dialog (Escape closes it and returns
focus), the people pill opens on a press and closes on scroll, the view control's Timeline and Table links return to the flat view with the
period and take its settings along, the gear's minor-credits toggle adds posters, a 390px touch
screen gets a thin rail, the back arrow, a collapsed pill with the family names, the gear's sheet with the views, and no sideways
scroll (`page-bar.spec.ts` and `page-bar-phone.spec.ts` check the bar at 390 and 360px, with two and three people), and the plain address still shows the flat Timeline on a desktop.

## Layout

- `src/lib`: pure data modules (roles, normalizing TMDB credits, shared films, URL slugs, CSV) and the server-only TMDB client.
- `src/app/api`: `/api/search`, `/api/movie/[id]`, `/api/film-metrics` and `/api/collaborators/[id]`, rate limited per IP.
- `src/app/p/[people]`: the shareable timeline page. Its layout, top to bottom:
  - **Headline.** The `<h1>` is visually hidden (`sr-only`, on every view: screen readers and search engines only) and carries the names and the film count: "Martin Scorsese & Thelma Schoonmaker, 24 films" (family names for three or more people: "Ford, Lucas, & Spielberg, 4 films"; no count when there are no films). The count is what the table lists (the films they share, or one person's films), so it follows the gear's minor-credits checkbox; the server renders the default. What a sighted visitor sees of it is in the page bar: the pair hero's title and, once the hero has collapsed, the people pill. "Add a person" is the field the pill opens into; the site header has no search field on these pages. See "Frequent collaborators" for what the field offers.
  - **The view control** in the page bar: Films | Timeline | Table as one segmented control of links (a `nav`, the current one `aria-current`, not a tablist), and Quotes as its fourth segment for a pair that has quotes; Export and Share are in the gear's sheet. Only one view is shown at a time, but the Timeline, Table and Quotes panels are always in the server HTML (the inactive ones `hidden`) and stay mounted, so the table's titles and credits are crawlable on the Timeline and the timeline keeps its zoom and scroll position while the table is shown. The server and the first client render show the Timeline; the view is then read from the address bar: `?view=table` is the Table, `?view=timeline` the Timeline (written out, since a plain address opens Films on a phone), `?view=clippings` (or a `?quote=` that names one of the page's quotes) the Quotes, and a sorted-table link (`?sort=...&dir=...`) with no `view` opens the Table. Choosing one of them is written with `history.replaceState`, so it neither navigates nor adds to history; Films is another render of the page, so it is a navigation. Adding or removing a person keeps you on the view you are on (`carryView`), by appending `?view=...` to the new page's address (the sort is not carried: it ordered another film list). The rules are pure and tested in `src/lib/films-view.ts`.
  - **The panels.** Timeline: the whole screen under the bar, with the one combined track (the separate lanes are parked, see `LANES_ENABLED`; one person's page has their lane and its header), the connection legend (three or more people), and the minimap bar pinned to the bottom of the screen (it is part of the Timeline panel, so it is only there on that view). Table: the sortable table and, for three or more people, the "By pair" lists. The table's ratings, box office and awards load when the Table is first shown (or on Export, or on a metric sort).
  - **The gear** (the bar's last control, on every view): the "Show all films" and "Show shorts, music videos, cameos and uncredited" checkboxes (the second filters the track, the table, the film count and the Export alike, and announces "Showing N films together"), Share (with its Period choice) and Export. Under the Table, the note about where ratings, box office and awards come from.
  - **Pair hero and page bar.** Every view of a `/p/` page opens with the pair hero (`src/components/hero`, its pure rules in `src/lib/pair-hero.ts`): the names joined with " × " (each a button that opens the person's details in the slide-out panel), a muted line of each person's main role in their shared films and the count the table lists ("Director × Cinematographer · 5 films"; a role is the one on most of their shared films, with a director, the crafts, then the actor, writer and producer preferred when two are about as common), a larger portrait each (a rounded rectangle in the person's colour, which opens the panel too), a note beside them, and a chip for each film in release order (as many of the first three as fit whole on one line, then "+N more" for every film left out: the last chip on the line may give up the end of its title with an ellipsis but keeps about ten characters of it, the year stays, so a desktop shows three and a phone one or two, always at least one; the count is measured in the browser before it paints, with a server default of three from the `sm` breakpoint up and one below it so that the page is not seen to change when it goes live, and is measured again when the window changes size, `fitChipCount` in `src/lib/pair-hero.ts`; "+N more" opens every film inline, where they wrap). The note is the pair's first artist quote that fits whole (240 characters at most, and not one that ends in an ellipsis in the data: the hero never shows a quote cut short; in italics, with "A on B" linking to that quote in the Quotes), else the curated description in `src/lib/pair-descriptions.ts` (Wikipedia-style `[n]` footnotes linking to its sources, in new tabs), else the one-line blurb of a curated pairing, else nothing. **A page of one person has the same hero as its masthead**, built from the same component with one portrait: the line under the name is their main roles (up to two, by the same rule) and the years they were active, then the count the table lists ("Director, Actor · 1966–2005 · 31 films"); the chips are their best-known films by TMDB vote count, fitted to the line and counted in "+N more" as above; and the note is the start of their TMDB biography, whole sentences up to 240 characters (a first sentence longer than that is cut at a word and ends with "…", the only time; the "Description above from the Wikipedia article…" credit TMDB copies is taken off; nothing, and no space kept for it, for a person with no biography), with a **More** after it that opens their panel, which has all of it (`heroBioText` in `src/lib/pair-hero.ts`; More is set with the last word in a span that does not break, so it is on the biography's last line and never alone under the portrait on a phone). The Timeline's lane header, which says the name, roles and years, leaves the biography to the masthead. **The page bar never covers content.** The lane header's content is pinned under the bar while the track scrolls down (the track opens at its baseline, so the header's top would be above the screen), and on the Table and Quotes the page starts under the bar's title as it wraps on a phone (three or four names): the bar measures itself while its hero is expanded and the page keeps that. A chip takes you to its film in the view you are on: Films scrolls the scene so its poster is centred, the Timeline centres its card, the Table scrolls its row into view and lights it, the Quotes open the film's panel (as does any film the view does not show, such as one whose person's eye is off). The hero collapses into the compact bar (home arrow, people pill, view control, gear) once the view's main scroller has moved 48px or more from its start (every view opens at its start: Films' scene and the Table and Quotes at the top, the Timeline's track at its left end, and at its bottom where it scrolls down), and expands again within 48px of it. The people pill is shown only once the hero has collapsed (until then the title has its place, and the pill is inert); its avatars fly in from the portraits (none for reduced motion). **⌘K** (Command+K on a Mac, Control+K elsewhere) is the way to the people on any view, with the hero expanded or collapsed, and on a page too short to scroll (an empty Table), where the pill never appears: it opens a full-screen people search (`src/components/people-overlay.tsx`, the shortcut's rules in `src/lib/people-shortcut.ts`), the same field to add a person (focused) and the same rows as the pill's card, each with a Remove button. It is a modal dialog ("People"): Tab stays in it, ⌘K again, Escape or its close button closes it and focus goes back to what had it, and it is not taken while a text field elsewhere has focus. **Adding and removing people while a panel is open only stages the change** (the film panel's cast, whose Add becomes "Added ✓" and can be pressed again to take it back; the pill's card and the ⌘K search, where a person added in the field has a row at once, marked new, and a removed person's row says it leaves, with Undo): nothing behind the panel is redrawn, and when the last of them closes, by any means, every staged change is applied in one soft navigation (`router.push`, never a document load) to the page of the final people, with the view kept (`src/components/people-staging.tsx`, the rules in `src/lib/pending-people.ts`); with nothing staged, or changes that cancel out, closing does nothing. On the Timeline and Films the hero is a solid band over the top of the view, which eases away; Films' year rail is always the full height of the screen, from its top, beside the band; on the Table and Quotes the hero is in the page and scrolls away. **Films** is the Depth view (`?view=depth`). A link that names no view opens Films on a phone and the Timeline elsewhere, decided on the server from the user agent (`device.type === "mobile"`, bots excepted: a narrow desktop window still gets the Timeline), so every link to the Timeline names it (`?view=timeline`); the canonical address stays the plain one.
  - **Depth view (spike).** `?view=depth` on the same address draws the same films as a full-screen vertical scene (`src/components/depth`, `src/lib/depth-*.ts`): oldest at the top, in CSS perspective. The films the people made together are in front, larger and green, down the middle; each person's other films sit on a layer behind (the first person in the address nearest), faded until the pointer (on a phone, the middle of the screen) brings them up to full opacity, and a hovered or keyboard-focused one pops forward over everything. The less known a film is, the fainter and further back its poster (every poster is one sharp image; none is blurred): its TMDB vote count, on a log scale against the page's best-known background film (`obscurityOf` in `src/lib/depth-layout.ts`), sets its resting opacity (0.56 down to 0.315) and how far it sits behind its person's layer (up to 320px, so a person's films are a cloud with depth); focus and hover take any of them to full opacity. The films made together and a page of one person's are not touched. Where no film is made together for a stretch, the people's films are drawn in towards the middle of the screen so it is not left empty (`PULL` in `src/lib/depth-layout.ts`: nothing within 40px of a film made together and its label, all the way in about 900px away, smoothly between; each person's films keep their order, a small gap between the clusters, and with nothing made together the whole page is pulled in). A phone's bands are already close, so nothing moves there. A mouse can press and drag anywhere to scroll it; a page of one person has its posters up front and bigger. Only the films made together have a label, `Title, Year`, under their poster (a title that already ends with its year does not say it twice: "Street Scenes, 1970"). Until its image arrives a poster is the dark surface tinted faintly with its person's colour (green for a film made together), so a jump along the rail on a slow connection shows coloured cards, not holes. A thin year rail on the right is the scrollbar, and dust drifts behind. The site header and footer are hidden; people live in a pill at the top left, whose heads fold out into a card with each person and "Add a person" (which stays in the Depth view). The page bar and the pair hero are the same on every view (see the previous bullet): the people pill, the view control (**Films**, which is this view, **Timeline**, **Table** and, for a pair that has quotes, **Quotes**, the people and the period kept) and a **gear** left of the rail. The gear opens the flat page's film settings (Show all films, which Films always does, and "Show shorts, music videos, cameos and uncredited": with it on, a film that is minor for everyone who has it joins as a background poster, faint and far back, never as a film made together) and **Share** (the flat page's menu, with its Period years). The settings are held in the browser's memory for the set of people (`useFilmPrefs`), so they are the same on both pages. On a phone the bar has no view control: once the hero has collapsed it is the back arrow, the people pill (the heads, then the family names, "Tracy & Hepburn", the helper the headline uses for three or more people; they give way with an ellipsis, and the arrow, the heads and the gear never shrink or wrap) and the gear, and the gear's sheet holds the views, the settings, Share and the way home too. `depth` is not one of the flat page's in-place views (Timeline, Table, Quotes): choosing it is a navigation. Tab goes through the posters one layer at a time (the collaborations, then the first person's films, and so on), not by date. Safari's engine was checked (Playwright WebKit): perspective inside the scroller parallaxes there exactly as in Chromium, the posters load and the card, panel and rail work, so there is no JS fallback; `WEBKIT=1 npx playwright test --project=webkit` runs the Depth spec in it (opt-in, after `npx playwright install webkit`). Real Safari's GPU compositing, where a little flicker was seen, is not something a headless run shows.
- `scripts/`: the refresh scripts (`refresh-examples.ts`, `refresh-people-index.ts`, `refresh-awards.ts`) and the small Node loader they run under (see below).
- Design tokens live in `src/app/globals.css` (dark theme, Tailwind names such as `bg-surface`, `text-muted`, `text-accent-green`). The Share button is green with white text, in the deeper `bg-button-green` (white on the bright accent green is only 1.78:1; on the button green it is 4.75:1, 5.53:1 on hover).

## Landing page pairings

The "Try a pairing" cards on `/` are curated by hand in `src/lib/examples.ts` (genre, people, a one-line blurb). The page itself never calls TMDB: it renders from `src/lib/examples.generated.json`, which holds each person's canonical TMDB name and photo plus the "N films together" count, so `/` is statically prerendered. Every pairing belongs to exactly one genre tab; the first tab, Featured, is not stored but shows 6 pairings picked at random (one per genre) in the browser after load, with a fixed default sample in the server HTML for crawlers and visitors without JavaScript.

After adding or changing a pairing, run:

```
npm run examples:refresh
```

It needs `TMDB_READ_ACCESS_TOKEN` (from `.env` or the environment) and Node 22.9 or newer, and uses Node's built-in TypeScript support, so there is nothing extra to install. It checks every pairing against live TMDB and writes the JSON only if all of them pass. It fails when a person id does not resolve, a name differs from TMDB's (the link would redirect), a pairing shares fewer than 3 released films by the pair page's default rules, someone has no profile photo, fewer than 3 of the shared films have a poster, or a pairing is listed twice. The counts use the same code as the `/p/` page, so a card always matches its page. Commit the regenerated JSON; `npm test` fails if it is out of date. Only released films count (announced films do not, see above), so a count grows when an announced film comes out and also drifts when TMDB adds, removes or re-dates films; refresh now and then, and after a major release.

The hero above the headline (`src/components/landing/hero-collage.tsx`) is a collage of one pairing at a time: two portraits and, hanging on one faded timeline line below them, the posters of the (up to) 5 most-voted films they share (also recorded in the JSON), with a quiet "+N more" at the right end of the row when the pair shares more films than that, all as one link to their page. The posters sit on the timeline line below the people; nothing else (no connector) joins the two. Every few seconds it changes to another pairing, sometimes both people and sometimes only one, which is why several people appear in more than one pairing in `examples.ts`. It rotates only through pairings that share a person with another one (`heroPool` in `src/lib/hero-scenes.ts`, where the scene rules are; so a new pairing whose two people are in no other pairing shows on the cards and the Featured tab but never in the hero, and a test fails when too many are left out), and pauses on hover, focus (on the collage link, Previous or Next), press, typing in the search field, off-screen and a hidden tab; with reduced motion it never autoplays, and only Previous, Next and the arrow keys change the scene. There is no pause button: Previous and Next put the visitor in charge, and hovering or focusing the collage holds it still.

Which pairing it opens on is random, picked in the browser once the page has loaded (`pickFirstScene`: uniform over the pool, and not the one the last visit of this browser session opened on, remembered in `sessionStorage`). The landing page stays statically prerendered, so the server cannot pick: it renders an empty, fixed-size stage (nothing shifts when the scene arrives, and the headline stays the largest paint) and puts one default pairing, Harrison Ford and George Lucas (`DEFAULT_SCENE_KEY`), inside a `<noscript>`, so crawlers and visitors without JavaScript get a real link, while everyone else downloads the images of the chosen scene only. The scene fades in once its images have loaded (not at all with reduced motion).

Two small buttons beside the collage, outside its link, step through the pairings: Previous (left) and Next (right), and so do the ArrowLeft and ArrowRight keys. The buttons are drawn as arrow keycaps to say so (`keycap-button.tsx`: an outline only, a 32px rounded square with a 1px muted border and an arrow, no fill, edge or shadow, in the colours of the pause button). Stepping, by click or key, presses the matching key for about 150ms (`keycap-press.ts`: it dips 1px and its border and arrow flash to the hover colours); only a step that happens presses it, so a key the page ignores (see below) or a held key repeating does not, and with reduced motion the key does not move and only changes colour. The visit keeps a history of the last 30 scenes (`src/lib/hero-history.ts`): Next shows the scene after the current one if you went back and otherwise makes a new one by the rotation's rules, Previous goes back one, and at the start of the history it makes a fresh scene, so the button always does something. A press cancels a swap in flight, plays the usual swap (mirrored for Previous), and starts a full scene's time over; a rotation that is held still stays held. A polite live region names the scene after a press or a key, never after the automatic rotation. The keys act from anywhere on the page while the hero is at least partly in view, except where the arrows already mean something (`heroKeyAction` in `src/lib/hero-keys.ts`): tabs, listboxes, menus, an open combobox, dialogs, a select, and a text field that has text in it. An empty search field lets them through. The Tab order follows the picture: Previous, the collage link, Next, then the search field.

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

It needs `TMDB_READ_ACCESS_TOKEN` and Node 22.9 or newer, like `examples:refresh`, makes about 2,000 TMDB requests (8 at a time, with retries and backoff; a cold crawl took about 13 minutes when last run, a rerun from the cache under a second) and caches every response under `node_modules/.cache/parallel-people-index` (set `PEOPLE_INDEX_CACHE_DIR` to move it, pass `--no-cache` for a fresh crawl) so a rerun costs nothing. It writes the JSON only when every person in `examples.ts` is in it, so run it after adding people there; `npm test` fails if one is missing. The same run also writes `src/lib/collaborators.generated.json`, the collaborator graph behind the "Frequent collaborators" suggestions (see that section), from the credits it has already fetched.

**Regenerate the index at least every six months.** TMDB's terms limit how long cached TMDB data may be kept, and both generated files (the index and the collaborator graph, written by the same run with the same `generatedAt`) carry a timestamp so their age is visible. Run `npm run people:refresh`, check `npm test` and `npm run people:eval` (hit rates) still look right, and commit both files. `npm run people:eval -- --tmdb` also runs the same queries through TMDB's raw search for comparison (one live call per query).

## Frequent collaborators

On a single-person page, clicking (or tabbing into) the empty "Add a person" field (the one the people pill opens into) opens its dropdown with a "Frequent collaborators" group: up to 8 of the people that person has worked with most (their usual director, cinematographer, composer, editor and co-stars), as options of the same combobox that lists search results. Each row shows a photo, the name, and a muted line with their roles and the number of films together ("Director, Writer · 11 films together"); choosing one adds them to the timeline (on the view you are on), exactly like picking a search result. The count is the one the pair page then shows as its film count (released, non-minor films only), and hovering a row names the best-known films they share. As soon as you type, the dropdown shows the normal search results; clearing the text brings the suggestions back; Escape and leaving the field close it as before. The list is requested the first time the field is focused (a visit that never touches the field costs no request, and the field's size never changes), kept in memory per person for later focuses, shows skeleton rows meanwhile, and falls back to the plain field when there is nothing to suggest or anything fails (no error text). Multi-person pages, the landing page and the header search do not show it.

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

It needs `TMDB_READ_ACCESS_TOKEN` (only to find the films) and Node 22.9 or newer, like the other refresh scripts. TMDB responses are cached on disk (`node_modules/.cache/parallel-awards`; set `AWARDS_CACHE_DIR` to move it, `--no-cache` for a fresh crawl). Wikidata costs one request per 50 films (17 for the 845 films of the 126 pairings: a few seconds once TMDB is cached, about 20 on a cold run), at most 2 at a time, with the user agent `ParallelBot/0.1 (https://github.com/zherring/parallel)` and backoff on HTTP 429 and 5xx; a batch the service times out on is split in halves. The script writes nothing when the result is empty, when films with data drop by more than 30% against the committed file, or when a film of the validation set that is in the corpus differs from the Academy's tally (`--force` overrides).

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

## Quotes

Quotes uses a full-screen, vertically scroll-snapped layout by default on every pairing with curated quotes or criticism. No opt-in flag is needed:

- `/p/1032-martin-scorsese+3661-thelma-schoonmaker?view=clippings`
- `/p/5655-wes-anderson+1532-bill-murray?view=clippings&quote=when-i-read-rushmore-i-figured`
- `/p/488-steven-spielberg+491-john-williams?view=clippings`

Desktop places stationary portraits beside the quote, using the site canvas and a subtly lighter quote pane. Mobile puts a broad 3:2 portrait panel below the compact navigation, meeting a top-aligned quote panel with its own inset. Short screens cap the picture height; long quotes scroll internally. The speaker remains in color and the other portrait is grayscale; critics treat both equally. Missing portraits fall back to initials, and the embedded TMDB credit stays fixed.

Scroll or swipe to snap between quotes. Space advances, Shift+Space goes back, and the arrow buttons do the same. Tab into a long quote to scroll its text with Space / Shift+Space; navigation resumes at the text's edge. Keyboard/button navigation wraps at the ends, visibly scrolling back up when returning to quote one (immediate with reduced motion); held Space does not skip quotes, and fields, controls and dialogs retain their own key behavior. There is no autoplay. The quote counter opens an index for skimming and jumping directly to a quote, and the More reading shortcut opens the related source list. Both reuse the shared film/person `SidePanel`: a right-hand slide-out on desktop and a bottom sheet on mobile, with the standard dismissal, focus restoration and reduced-motion behavior. There is no separate centered modal. Reading-only pairs show their source list in the split layout.

The share button stays visible above each quote. Attribution lives in the explainer, with a short speaker lead-in only when their name is missing—never a separate “name on name” row. Unambiguous full, first and family names are real links: a plain click opens the person's details, while modified clicks follow the person's page. Sources, years, reprint credits and secondhand disclosures remain intact; screen readers retain an explicit speaker credit. The compact home, pairing, view and settings controls remain available; the expanded masthead does not.

Existing `?view=clippings&quote=...` and bare `?quote=...` links open the correct quote without reordering the sequence. Scrolling replaces the current URL rather than adding history entries. Legacy `exhibit` flags are ignored and removed when the deck publishes its current quote. Only the active Quotes view mounts portraits and keyboard listeners; inactive source-linked quote text remains in server HTML.

Photography is deferred. A future image should belong to the quoted source article and that specific quote, with provenance and usage rights checked—not be an arbitrary collaboration backdrop. This implementation only loads portraits from TMDB; it includes no archival photograph assets.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

Awards data comes from Wikidata (CC0).

## License

[MIT](LICENSE). Film data and images come from TMDB and remain subject to [TMDB's terms](https://www.themoviedb.org/api-terms-of-use). Awards data comes from [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) (CC0).
