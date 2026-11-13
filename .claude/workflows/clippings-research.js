export const meta = {
  name: 'clippings-research',
  description: 'Research sourced Clippings quotes (artists on each other, or critics on the collaboration) for pairing keys, one lean Sonnet agent per pair',
  whenToUse: 'To research more duos for the Clippings tab. args: an array of pairingKeys (the two TMDB ids, sorted, joined with "+"), or {keys: [...], critics: true} for critics and reading links instead of artist quotes; add force: true to overwrite files already staged. Then run `npm run clippings:merge`.',
  phases: [
    { title: 'Research', detail: 'one clippings-researcher agent (no MCP) per pair, at most 8 at a time; writes scripts/clippings/research/{quotes|critics}/<key>.json' },
  ],
}

const MAX_PARALLEL = 8
// Measured 2026-11-13: the lean agent starts at ~8.5k context, so batching no longer pays. With 2 pairs per agent the second
// pair carries the first pair's leftovers (context reached ~67k) and cost ~0.61M input per pair; 1 per agent is cheaper.
// Keep at 1 unless the agent's baseline grows again (the old all-tools agent started at ~55k).
const PAIRS_PER_AGENT = 1

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
function pairSteps(key) {
  const out = `scripts/clippings/research/${kind}/${key}.json`
  return (
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
    `5. Write the JSON to ${out} and validate that it parses. Do not touch any other file in the repo.\n`
  )
}

function prompt(batch) {
  const head =
    batch.length === 1
      ? `You are researching one pairing for the Clippings feature of this repo (your working directory is the repo root).\n\n`
      : `You are researching ${batch.length} pairings for the Clippings feature of this repo (your working directory is the repo root). ` +
        `Do them one at a time, in order, each into its own file; read the brief(s) once and reuse them.\n\n`
  const body = batch.map((k, i) => (batch.length > 1 ? `=== Pair ${i + 1} of ${batch.length} ===\n` : '') + pairSteps(k)).join('\n')
  const reply =
    batch.length === 1
      ? `Your final reply must be AT MOST 3 lines, as the brief says.`
      : `Your final reply: for each pair, a line "=== <key>" followed by AT MOST 3 lines, as the brief says.`
  return head + body + '\n' + reply
}

// Split a batched reply back into per-key summaries.
function splitReply(batch, reply) {
  if (batch.length === 1) return { [batch[0]]: firstLines(reply) }
  const out = {}
  const parts = String(reply ?? '').split(/^===\s*/m)
  for (const key of batch) {
    const part = parts.find((p) => p.startsWith(key))
    out[key] = part ? firstLines(part.slice(key.length)) : firstLines(reply)
  }
  return out
}

const firstLines = (text) =>
  String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('\n  ')

phase('Research')
const batches = []
for (let i = 0; i < keys.length; i += PAIRS_PER_AGENT) batches.push(keys.slice(i, i + PAIRS_PER_AGENT))
log(`${keys.length} pair(s) in ${batches.length} agent(s), ${kind}, up to ${MAX_PARALLEL} at a time${force ? ', overwriting staged files' : ''}`)

// Fixed assignment of batches to workers (not a shared queue) so that a resumed run replays its agents in the same order.
const workers = Math.min(MAX_PARALLEL, batches.length)
const summaries = {}
await parallel(
  Array.from({ length: workers }, (_, w) => async () => {
    for (const batch of batches.filter((_, i) => i % workers === w)) {
      try {
        const reply = await agent(prompt(batch), { label: batch.join(' '), phase: 'Research', agentType: 'clippings-researcher' })
        if (reply === null) for (const key of batch) summaries[key] = 'no result (the agent was skipped or failed)'
        else Object.assign(summaries, splitReply(batch, reply))
      } catch (err) {
        for (const key of batch) summaries[key] = `FAILED: ${err && err.message ? err.message : err}`
      }
    }
  }),
)

return (
  keys.map((key) => `${key} [${kind}]:\n  ${summaries[key]}`).join('\n') +
  `\n\nNext: npm run clippings:merge (validates and merges what is staged), then npm test, then review on the dev server before committing.`
)
