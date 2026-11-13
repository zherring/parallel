# Clippings research brief

Goal: find real, sourced quotes in which artist A talks about working with / their relationship with artist B, and B talks about A. These go into a "Clippings" section on a site about creative collaborations: the artists describe their relationship in their own words, each short excerpt linked to the article it came from (we show a brief excerpt and send readers to the original).

Tools: WebSearch and WebFetch (load them via ToolSearch with query "select:WebSearch,WebFetch" if deferred). Bash is fine for checking text you fetched.

## Rules (accuracy matters more than volume)
- Every quote must be seen by you on a freely accessible page you fetched. Never include quotes from memory. Copy verbatim from the fetched text (trim with "…" if needed, never reword). Keep each excerpt short: a sentence to a few sentences.
- If the quote contains quoted speech, keep it as on the page; we normalize marks later.
- Prefer original, openly available publications: newspaper/magazine/trade interviews, official speech transcripts (Academy acceptance speech database aaspeechesdb.oscars.org, AFI, BAFTA, festivals), NPR/Fresh Air transcripts, guild magazines, orchestra/studio pages. Aggregator/quote sites (BrainyQuote, Goodreads, IMDb quotes, Wikiquote, AZQuotes) are NOT acceptable sources; use them only as leads to find the original.
- Paywalled or blocked page: skip it and move on. Do not try to get around paywalls (no archive.org / cached copies of paywalled pages). Note notable skips in `notes`. Open syndicated copies of the same article (e.g. a wire story or a syndicated newspaper reprint that credits the original) are OK — record the original in `publication` and the host in `via`.
- Not in English? If a quote is only available in another language, put the source's text verbatim in `original`, its two-letter language code in `original_lang` ("it", "es", "fr"), and a faithful, plain English translation of it in `quote` (literal, same cuts and "…"). The site shows the English and marks it as translated. Never put non-English text in `quote` alone, and only translate a quote you can't find in English.
- If the article quotes something said elsewhere (e.g. "as he told Rolling Stone in 1982"), set `secondhand: true` and explain in `context`.
- Prefer quotes that reveal the relationship (how they work together, what one gives the other, a specific story about a specific film, affection, friction, a falling-out) over generic praise.
- Target 6–10 quotes, both directions if at all possible, spread across years/films. If one direction is thin, say so honestly; don't pad.

## Output
Write JSON to the path given in your task (under `scripts/clippings/research/quotes/`), shape:
{
  "pair": ["Name A", "Name B"],
  "tmdb_ids": [idA, idB],
  "clippings": [
    {
      "speaker": "Name A",            // exactly as in "pair"
      "about": "Name B",              // exactly as in "pair"
      "quote": "verbatim text",          // in English: your translation when the source is in another language
      // "original": "verbatim source text", "original_lang": "it",   // ONLY for a quote not available in English; both or neither
      "film": "Title" or null,         // specific work discussed, if any
      "said_year": 2012 or null,       // when it was said
      "publication": "Variety",        // SHORT name of the ORIGINAL source (e.g. "Los Angeles Times", "Academy Awards", "Fresh Air")
      "via": null or "Host site",      // the site you actually read/link if it's a reprint/syndication of the original
      "title": "article headline",
      "date": "YYYY-MM-DD" | "YYYY-MM" | "YYYY",   // ORIGINAL publication date
      "url": "https://... (the page you actually saw it on)",
      "context": "one short sentence: where/when/why it was said (note if translated)",
      "secondhand": false
    }
  ],
  "notes": "dead ends, skipped paywalled sources, unverifiable famous quotes, how hard this was"
}
Validate the JSON (e.g. `node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' FILE`). `npm run clippings:merge` checks the rest (names and ids against the app's data, dates `YYYY[-MM[-DD]]`, https URLs, speaker/about in the pair), so get those exactly right.

Then reply with a short summary: count per direction, the 2–3 best quotes, any sources you were unsure about.
