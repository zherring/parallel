# Staged research

`quotes/<key>.json` (artists on each other) and `critics/<key>.json` (critics and reading links) are the raw output of the
research agents, one file per pair, named by the pairingKey (the two TMDB ids, sorted, joined with `+`). `npm run clippings:merge`
turns them into entries of `src/lib/clippings.json` and `src/lib/essays.json`. They stay in the repo as the record of what
the agents found and what they said about sources they skipped (`notes`).

The 26 quote files and 2 critics files here are the batches that produced the data currently in the app (the superseded first
critics pass is not kept).

## The app JSON is the source of truth, not these files

Once a pair is merged, `src/lib/clippings.json` and `src/lib/essays.json` are what the owner edits and what ships. The staged
files are not kept in sync, so **`--force` on a merged key replaces the app's entry with the staged file and loses every later
hand edit**. Do not use it unless you mean to. What `--force` would change today (checked by merging every staged file over
the current data and comparing):

| Key | Pair | `--force` would |
| --- | --- | --- |
| `488+491` | Spielberg & Williams | revert shortened `publication` names and the `via` hosts (NPR, Los Angeles Times / The Post and Courier, Classical California) to the agent's longer labels |
| `1032+3661` | Scorsese & Schoonmaker | same `publication`/`via` reverts (Academy Awards, Fresh Air, CineMontage, The Irish News, Associated Press / SHOOTonline) and bring back the 2007 Oscar speech line ("And Michael Ballhaus on camera and Howard Shore's wonderful score…"), dropped from the app |
| `1259+4385` | Leone & Morricone | revert `publication`, `via` and the corrected original `date`s (Sight and Sound 2006-07, Cinema Papers 1984-12, Cineaste 1995, BBC 2014, Frayling 2000, 2003) to the hosting pages' dates |
| `525+947` | Nolan & Zimmer | revert `publication`/`via`/`date` (New York Times 2017-07 via Gulf News, ReelBlend via Screen Rant) |
| `1045+2636` (critics) | Hitchcock & Herrmann | bring back the dropped Steven C. Smith quote about *Psycho* (the old merge script skipped it because it overlapped another) |
| `488+491` (critics) | Spielberg & Williams | change the Keegan quote's " — " back to the agent's " -- " |
| `151+137427`, `3186+7467`, `510+531`, `5281+5292`, `138+2231`, `1032+6193` | six duos from the second and third batches | change one quote each (six in all) whose inner quotes were merged with the wrong opening mark: the old Python merge turned every straight `"` into `’`, so the app has `’Will you join me?’` where `--force` gives `‘Will you join me?’`. This one is a fix, and nothing else in those six keys differs, so `--force` on just those keys repairs them |

Every other quotes key (`380+1032`, `7623+11357`, `1045+2636`, `3146+3151`, `4762+74333`, `136495+1419631`, `608+636`, `4185+11218`,
`1357+12453`, `564+569`, `1532+5655`, `500+9033`, `20738+21684`, `309+955`, `107446+155267`, `880+1892`) round-trips
byte-for-byte: `--force` on all of them leaves `src/lib/clippings.json` without a diff. Critics key `488+491`'s reading list does too.

To change a merged quote, edit the app JSON. To redo a pair from scratch, research it again (the workflow's `force` option
overwrites the staged file), then decide key by key whether to `--force` it over the app data.

## About the first four duos

Spielberg & Williams, Scorsese & Schoonmaker, Leone & Morricone and Nolan & Zimmer were the first batch, built by an earlier
script. Their staged files are the agents' original output (Spielberg & Williams' had no `tmdb_ids`; they were added so the file
passes the merge checks). Scorsese & Schoonmaker's has ten quotes where the app has nine (the Oscar line above).
