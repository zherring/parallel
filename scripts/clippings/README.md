# Clippings pipeline

Research sourced quotes for the Clippings tab, review them, and merge them into the app. A pair is identified by its
pairingKey: the two TMDB ids, sorted, joined with `+` (`488+491` is Spielberg and Williams).

```
pairs.txt ──▶ research agents ──▶ research/{quotes|critics}/<key>.json ──▶ npm run clippings:merge ──▶ src/lib/{clippings,essays}.json
 (queue)      (one Sonnet agent     (staged, reviewable raw output)          (validate, normalise,        (what the app renders)
               per pair)                                                      add stable ids)
```

| Step | What | How |
| --- | --- | --- |
| 1. Queue | Pairs waiting to be researched, one key per line with a `# Name & Name` label | `pairs.txt` |
| 2. Research | One lean `clippings-researcher` agent per pair (Sonnet, web + file tools only, `.claude/agents/`), up to 8 in parallel, each following `briefs/` and writing its JSON to `research/` | `/clippings <keys or "next N">` in Claude Code (skill `.claude/skills/clippings`, workflow `.claude/workflows/clippings-research.js`) |
| 3. Merge | Validate every staged file whose key is not in the app JSON yet, and add it | `npm run clippings:merge` |
| 4. Review | Read every new quote against its source on the dev server (`npm run dev`, the pair's page, Clippings tab) | by hand |
| 5. Test, commit | `npm test`, then commit the app JSON and the staged files together | by hand |
| Later | Check every link is alive and every quote is still on its page | `npm run clippings:check` |

The pair must already be in `src/lib/examples.ts` / `src/lib/examples.generated.json` (add it and run `npm run examples:refresh`):
the merge checks names and TMDB ids against that file.

## Research

`/clippings 3098+4415 1223+1224` runs the workflow for those keys; `/clippings next 3` takes the first three keys of `pairs.txt`
that are not merged or staged yet; `/clippings critics 3098+4415` researches critics' quotes and reading links instead of the
artists' own words. Each agent costs roughly 25 tool calls and ends with a three-line summary. The agents' rules (real pages
only, verbatim, no paywall circumvention, no aggregator quote sites) are in `briefs/`:

- `briefs/BRIEF.md` + `briefs/LEAN.md`: artists on each other (LEAN trims the target to six quotes and about 25 tool calls).
- `briefs/CRITICS_BRIEF.md`: critics and scholars on the collaboration, as complete pull-quote sentences, plus a links-only
  "More reading" list.

To research without Claude Code's workflow tool, give an agent the brief(s), the pair's names and ids from
`examples.generated.json`, and the path `research/quotes/<key>.json` (or `critics/`) to write.

## Merge

```
npm run clippings:merge                       # every staged file whose key is not in the app JSON yet
npm run clippings:merge -- 3098+4415          # just these keys
npm run clippings:merge -- 3098+4415 --dry-run   # validate and report, write nothing
npm run clippings:merge -- 488+491 --force    # replace an existing key from its staged file (see research/README.md)
npm run clippings:merge -- 488+491 --force --allow-id-changes   # ... even if a quote's share-link id would disappear
```

It never overwrites a key that is already in the app JSON unless `--force`, and never writes anything if any file fails
validation (all problems are listed). Checks:

- `pair` and `tmdb_ids` match `examples.generated.json` (each id with its name), and the file name is the key.
- `speaker` and `about` are in the pair (and different); `quote`, `publication`, `title`, `context` are present.
- `date` is `YYYY`, `YYYY-MM` or `YYYY-MM-DD`; `url` is https (two http-only sites already cited are allowed, see `HTTP_ONLY_HOSTS` in `lib.ts`).
- Critics: `kind` is one of essay / feature / academic / book chapter / review / video essay; reading items have `paywalled`.
- Straight double quotes inside a quote come in pairs; ids are unique, non-empty slugs (a critic's id starts with `critic-`).
  A quote with no ASCII word to make a slug from gets 8 hex digits of a hash of the quote instead.
- `--force` keeps the id of every quote that is still there (same `url` and words, or same `url` and first six words) and fails,
  listing them, when an existing id would disappear, since a shared link names it; `--allow-id-changes` accepts that.

What it does to the data: keeps only the whitelisted fields, turns quoted speech inside a quote into paired curly single quotes
(`"Yes"` or `“Yes”` become `‘Yes’`), and gives each quote a stable id: the first six words, lowercased, apostrophes dropped,
`-2` on a repeat (`critic-` in front for critics). **The id is what a shared `?quote=<id>` link carries, so do not change a quote's
opening words after it has shipped.** The output is 2-space JSON with a trailing newline.

Warnings (FLAGS in the output, never blocking): fewer than four quotes, nothing from one of the pair, secondhand quotes,
quotes over 90 words, critic quotes outside 15 to 80 words.

## Link check

`npm run clippings:check -- [keys...] [--strict]` fetches every quote and reading link (browser user agent, 15 s timeout, six at a
time), and for quotes checks the text is still on the page after normalising case, quote marks, dashes, punctuation, accents and
whitespace; every `…`-separated or `[bracketed]` stretch of a quote must appear. Statuses: `ok`, `quote-missing`, `dead` (404/410,
DNS failure, redirect to the front page, "not found" page), `blocked` (401/403/429, bot walls, timeouts and other network errors,
PDFs: could not be checked, a warning). A quote whose words are all on the page but split by others has probably dropped an inline
attribution ("Scorsese told ET") without marking it with `…`. The report goes to `reports/check-<date>.json` (gitignored); with
`--strict` the exit code is non-zero for dead or quote-missing items only.

There is no `.github/` in the repo, so there is no scheduled run; add a weekly workflow that runs `npm ci && npm run
clippings:check` and uploads `scripts/clippings/reports/` if you want one.

## Files

- `briefs/`: the research agents' instructions.
- `research/`: staged raw agent output, one file per pair and kind, and the history of what is in the app (`research/README.md`).
- `pairs.txt`: the queue.
- `merge.ts`, `lib.ts` (+ `lib.test.ts`): the merge and its pure helpers.
- `check-links.ts`, `check-lib.ts` (+ `check-lib.test.ts`): the link check and its pure helpers.
- `reports/`: link-check output (gitignored).
