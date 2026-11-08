export const meta = {
  name: 'clippings-research',
  description: 'Research sourced Clippings quotes (artists on each other, or critics on the collaboration) for pairing keys, one Sonnet agent per pair',
  whenToUse: 'To research more duos for the Clippings tab. args: an array of pairingKeys (the two TMDB ids, sorted, joined with "+"), or {keys: [...], critics: true} for critics and reading links instead of artist quotes; add force: true to overwrite files already staged. Then run `npm run clippings:merge`.',
  phases: [
    { title: 'Research', detail: 'one Sonnet agent per pair, at most 8 at a time; writes scripts/clippings/research/{quotes|critics}/<key>.json' },
  ],
}

const MAX_PARALLEL = 8

// args: ["488+491", ...] | "488+491, 31+488" | { keys: [...], critics?: boolean, force?: boolean }
const input = Array.isArray(args) ? { keys: args } : typeof args === 'string' ? { keys: args.split(/[\s,]+/) } : args || {}
const keys = [...new Set((Array.isArray(input.keys) ? input.keys : []).map((k) => String(k).trim()).filter(Boolean))]
const critics = Boolean(input.critics)
const force = Boolean(input.force)
const bad = keys.filter((k) => !/^\d+\+\d+$/.test(k))
if (keys.length === 0 || bad.length > 0) {
  throw new Error(
    bad.length
      ? `Not pairing keys (two TMDB ids, sorted, joined with "+", e.g. 488+491): ${bad.join(', ')}`
      : 'No pairing keys. Pass args as ["488+491", ...] or {keys: [...], critics: true}.',
  )
}

const kind = critics ? 'critics' : 'quotes'
const briefs = critics
  ? ['scripts/clippings/briefs/CRITICS_BRIEF.md']
  : ['scripts/clippings/briefs/BRIEF.md', 'scripts/clippings/briefs/LEAN.md']

// The script has no file access, so each agent resolves its own pair from the key.
function prompt(key) {
  const out = `scripts/clippings/research/${kind}/${key}.json`
  return (
    `You are researching one pairing for the Clippings feature of this repo (your working directory is the repo root).\n\n` +
    `Pairing key: ${key} (the two TMDB ids, sorted, joined with "+").\n\n` +
    `1. Resolve the pair. Open src/lib/examples.generated.json and read the entry "${key}": its "people" array is [{id, name, ...}, {id, name, ...}]. ` +
    `In your output JSON, "pair" must be exactly [people[0].name, people[1].name] and "tmdb_ids" exactly [people[0].id, people[1].id], in that order; ` +
    `every "speaker" and "about" (artist quotes) must be one of those two names exactly. If the key is not in that file, stop and reply "NOT FOUND: ${key}".\n` +
    `2. For context on what the two made together, find the pairing in src/lib/examples.ts (search for either id) and read its blurb. Use it only to orient your searches.\n` +
    `3. Output file: ${out}. ` +
    (force
      ? `Overwrite it if it exists.\n`
      : `If it already exists, do not research or overwrite it: reply "EXISTS: ${out}" and stop.\n`) +
    `4. Read ${briefs.join(', then ')}` +
    (critics ? '' : ' (its overrides win where they conflict with BRIEF.md)') +
    ` and follow ${briefs.length > 1 ? 'them' : 'it'} exactly.\n` +
    `5. Write the JSON to ${out} and validate that it parses. Do not touch any other file in the repo.\n\n` +
    `Your final reply must be AT MOST 3 lines, as the brief says.`
  )
}

const firstLines = (text) =>
  String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('\n  ')

phase('Research')
log(`${keys.length} pair(s), ${kind}, up to ${MAX_PARALLEL} at a time${force ? ', overwriting staged files' : ''}`)

// Fixed assignment of keys to workers (not a shared queue) so that a resumed run replays its agents in the same order.
const workers = Math.min(MAX_PARALLEL, keys.length)
const summaries = {}
await parallel(
  Array.from({ length: workers }, (_, w) => async () => {
    for (const key of keys.filter((_, i) => i % workers === w)) {
      try {
        const reply = await agent(prompt(key), { label: key, phase: 'Research', model: 'sonnet' })
        summaries[key] = reply === null ? 'no result (the agent was skipped or failed)' : firstLines(reply)
      } catch (err) {
        summaries[key] = `FAILED: ${err && err.message ? err.message : err}`
      }
    }
  }),
)

return (
  keys.map((key) => `${key} [${kind}]:\n  ${summaries[key]}`).join('\n') +
  `\n\nNext: npm run clippings:merge (validates and merges what is staged), then npm test, then review on the dev server before committing.`
)
