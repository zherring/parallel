---
name: clippings
description: Research more duos for the Clippings tab. Use when the user runs /clippings with pairing keys (e.g. "488+491 31+488"), "critics <keys>", or "next N from queue", or asks to research quotes for more collaborations. Runs the clippings-research workflow, merges the staged JSON, runs the tests and reports per-pair counts and flags.
---

# Clippings research

The pipeline lives in `scripts/clippings/` (read its `README.md` if anything below is unclear). A pair is identified by its
pairingKey: the two TMDB ids, sorted, joined with `+` (`488+491`). Queue: `scripts/clippings/pairs.txt`.

## Steps

1. **Work out the keys.**
   - `/clippings 3098+4415 1223+1224` means exactly those keys.
   - `/clippings next 3` means the first 3 keys in `scripts/clippings/pairs.txt` (ignore blank lines and `#` comments; the
     name after `#` is only a label) that are NOT already in `src/lib/clippings.json` and have no file in
     `scripts/clippings/research/quotes/`.
   - `/clippings critics <keys>` (or "critics next N") is the same but for critic quotes and reading links: pass
     `critics: true`, and skip keys already in `src/lib/essays.json` or staged in `research/critics/`.
   - Check every key exists in `src/lib/examples.generated.json`. If a pair is not there, stop and tell the user to add it to
     `src/lib/examples.ts` and run `npm run examples:refresh`; do not research it.
   - Never re-research a key that is already merged unless the user says so (it would be staged again but `merge` will not
     overwrite the app data without `--force`, and `--force` loses hand edits: see `scripts/clippings/research/README.md`).

2. **Run the workflow.** Call the Workflow tool with the saved script `.claude/workflows/clippings-research.js`
   (`name: "clippings-research"`, or `scriptPath: ".claude/workflows/clippings-research.js"`):
   - artist quotes: `args: ["3098+4415", "1223+1224"]`
   - critics: `args: {"keys": ["3098+4415"], "critics": true}`
   - add `"force": true` (object form) only if the user wants to redo a pair whose file is already staged.

   It runs one lean `clippings-researcher` agent per pair (Sonnet, no MCP servers; defined in `.claude/agents/clippings-researcher.md`), at most 8 at once, and writes `scripts/clippings/research/{quotes|critics}/<key>.json`. Each
   agent replies in at most 3 lines; collect those.

3. **Merge.** `npm run clippings:merge` (no arguments: merges every staged file whose key is not in the app JSON yet). It
   validates names and ids against `examples.generated.json`, speaker/about, dates, https URLs and ids, and prints one line per
   pair with counts and FLAGS. If it fails nothing is written: read the messages, fix the staged file by hand (or re-run that
   pair's research with `force`), and run it again. Use `-- <key> --dry-run` to look without writing.

4. **Test.** `npm test` (and `npm run typecheck` if you touched any code). Optionally `npm run clippings:check -- <keys>` to
   confirm each new quote is on its page.

5. **Report**, per pair: name & name, quotes merged per direction (or critics/reading counts), the flags from the merge output
   (few quotes, one-sided, secondhand, over-long), each agent's single best quote and any source it was unsure about, and
   anything a staged file's `notes` says was skipped (paywalls, unverifiable famous quotes).

6. **Remind the owner to review before committing**: run `npm run dev`, open each pair's page (`/p/<slug>`, from the Clippings
   tab on the landing page) and read every new quote against its source; research agents can mis-transcribe or pick a weak line.
   The new quotes are uncommitted edits to `src/lib/clippings.json` / `src/lib/essays.json` and the staged files; do not commit
   or push unless asked.

## Cost (keep it lean)

- The research agent is `clippings-researcher` (`.claude/agents/clippings-researcher.md`): Read, Write, Bash, WebSearch, WebFetch
  only. Don't switch the workflow back to a plain `model: 'sonnet'` agent: that inherits every MCP server and tool definition
  (~55k tokens on every call before any research, about 75% of the spend). The lean agent starts at ~8.5k.
- One pair per agent (`PAIRS_PER_AGENT = 1` in the workflow). Batching pairs made each later call carry the earlier pair's
  context and cost more once the baseline was small.
- Rough cost per pair, measured 2026-11-13: old setup ~1.3M input (mostly cache reads) and ~9k output; lean, 2 per agent
  ~0.6M; lean, 1 per agent estimated ~0.4M input and ~9k output. Output scales with the number of pairs whatever the setup.
- For big runs, go in chunks (~10-20 pairs) and let the owner check `/usage` between chunks.
- The agent file lives under `.claude/`, which this checkout's `.git/info/exclude` ignores: commit it with `git add -f`.

## Don't

- Don't hand-write quotes; every quote must come from a page an agent fetched (the briefs enforce this).
- Don't use `--force` on a key already in the app data without telling the owner what it would overwrite.
- Don't edit quote text in the app JSON after the fact without checking whether anyone has a `?quote=<id>` link: ids are
  derived from the first six words of the quote when merged and are what links carry.
