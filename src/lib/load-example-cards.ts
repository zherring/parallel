import "server-only";
import { buildExampleCards, type ExampleCardData } from "@/lib/example-cards";
import { EXAMPLE_PAIRINGS } from "@/lib/examples";
import { getPersonMovieCredits } from "@/lib/tmdb";
import type { PersonTimeline } from "@/lib/types";

// The landing page is force-dynamic, which also turns off Next's fetch cache for the TMDB calls
// made while rendering it. This process-level memo keeps those ~24 calls to one batch per hour
// (30s after a partial failure, so a TMDB hiccup heals quickly).
const FRESH_MS = 60 * 60 * 1000;
const RETRY_MS = 30 * 1000;
/** The page never waits longer than this for TMDB; slow loads finish in the background. */
const PAGE_BUDGET_MS = 4000;

interface Built {
  cards: ExampleCardData[];
  complete: boolean;
}

let memo: { expires: number; built: Promise<Built> } | null = null;

async function build(): Promise<Built> {
  const ids = [...new Set(EXAMPLE_PAIRINGS.flatMap((p) => p.people.map((person) => person.id)))];
  const settled = await Promise.allSettled(ids.map((id) => getPersonMovieCredits(id)));

  const timelines = new Map<number, PersonTimeline>();
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") timelines.set(ids[i], result.value);
  });

  return { cards: buildExampleCards(timelines), complete: timelines.size === ids.length };
}

/** Text-only cards: used when TMDB is down or too slow. Never throws. */
export async function loadExampleCards(): Promise<ExampleCardData[]> {
  const now = Date.now();
  if (!memo || memo.expires <= now) {
    const entry = { expires: now + RETRY_MS, built: build() };
    memo = entry;
    void entry.built.then(({ complete }) => {
      if (complete) entry.expires = Date.now() + FRESH_MS;
    });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), PAGE_BUDGET_MS);
  });
  try {
    const built = await Promise.race([memo.built, timeout]);
    return built ? built.cards : buildExampleCards(new Map());
  } finally {
    clearTimeout(timer);
  }
}
