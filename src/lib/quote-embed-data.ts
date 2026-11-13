import { getPairClippingSet } from "@/lib/clippings";
import { voiceClippings } from "@/lib/clippings-view";
import { getPairCritics } from "@/lib/critics";
import { embedQuotes, type EmbedQuote } from "@/lib/quote-embed";
import type { PersonTimeline } from "@/lib/types";

/**
 * Every quote of the pair on a /p/ page, in the order of the Clippings tab, each speaker with the headshot and colour the
 * page gives them (matched by TMDB id, so the same pair in the other order of its URL is the same quotes). Empty for a
 * page that is not exactly a pair with quotes. This reads the JSON, so it belongs to the server: the routes hand the
 * result to the client as a prop (see `quote-embed.ts` for what a quote is).
 */
export function pairQuotes(timelines: readonly PersonTimeline[]): EmbedQuote[] {
  const ids = timelines.map((t) => t.person.id);
  const set = getPairClippingSet(ids);
  return embedQuotes(set ? voiceClippings(set, timelines.map((t) => t.person)) : null, getPairCritics(ids));
}
