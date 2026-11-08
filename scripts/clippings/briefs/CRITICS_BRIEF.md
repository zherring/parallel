# Critic quotes brief

Goal: find critics' and scholars' writing ABOUT an artistic collaboration (not the artists' own words; those are covered by BRIEF.md).

We show it in the SAME format as the artists' own quotes: one big pull quote, credited "— Critic, Publication · Year", linking to the piece. An earlier pass was rejected because its pull lines "missed the point" — e.g. "showing that this is one of the most fruitful parings in cinematic history" is a fragment and empty praise. Don't repeat that.

Tools: WebSearch and WebFetch (load via ToolSearch "select:WebSearch,WebFetch" if deferred). Bash is fine for checking fetched text.

## What a good critic quote is
- 1–3 CONSECUTIVE, COMPLETE sentences, copied verbatim (no mid-sentence starts, no trailing fragments). Interior "…" only if absolutely needed, and never to splice distant passages.
- Stands alone: a reader who hasn't read the piece understands it (no dangling "this", "he" without antecedent if ambiguous — prefer passages that name the artists).
- Makes an actual CLAIM or OBSERVATION about the collaboration: how they worked, what one gave the other, what changed, why it mattered, a specific film/moment that reveals the dynamic, a tension, an argument. Insight > superlatives. Reject hype ("one of the greatest partnerships in film history") unless the sentence goes on to say something specific.
- Roughly 20–60 words. It will be displayed large, like a pull quote.
- Must be seen by you on the fetched page text. Never from memory or search snippets.

## Rules
- Paywalled / blocked / body not readable: do NOT circumvent (no archives, caches). Put it in `reading` (links-only list) instead.
- A readable piece with no passage meeting the bar also goes to `reading`.
- Sources: essays, features, reviews, academic papers and book chapters about the pair's collaboration (no listicles, content farms, AI-looking blogs, fan wikis, Reddit). Profiles of only one artist don't count unless the passage is squarely about the partnership. If the task names pieces already known (for example an earlier pass's), re-read those first, then add new openly readable ones if they yield a strong quote.
- At most 2 quotes from the same piece, and only if both are excellent.

## Output
Write JSON to the path in your task (under `scripts/clippings/research/critics/`). `"pair"` and `"tmdb_ids"` must be exactly as your task gives them; `date` is `YYYY[-MM[-DD]]`; every `url` must be https:
{
  "pair": [...], "tmdb_ids": [...],
  "critics": [   // best first; target 4–7
    { "critic": "Name" or null, "publication": "Short outlet", "via": null or "host if syndicated",
      "title": "headline", "date": "YYYY[-MM[-DD]]", "url": "https://...", "kind": "essay|feature|review|academic|book chapter",
      "quote": "verbatim complete sentence(s)", "why": "one line: what claim this makes (for the editor, not displayed)" }
  ],
  "reading": [  // links-only list for the bottom
    { "title": "...", "author": "..." or null, "publication": "...", "date": "...", "url": "...", "paywalled": true|false }
  ],
  "notes": "one or two sentences: dead ends, pieces skipped and why"
}
Validate the JSON (e.g. `node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' FILE`). Reply in AT MOST 3 lines: counts (critics / reading), the single strongest quote (truncated to ~25 words), anything you dropped.
