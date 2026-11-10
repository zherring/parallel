import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/collaborators-index", () => ({ loadCollaboratorGraph: vi.fn() }));
vi.mock("@/lib/collaborator-verify", () => ({ suggestFromTimelines: vi.fn(() => []) }));

import { resetSuggestionCache, suggestCollaboratorsChecked } from "@/lib/collaborators";
import { loadCollaboratorGraph } from "@/lib/collaborators-index";
import { __resetTmdbClientStateForTests, getPersonMovieCredits } from "@/lib/tmdb";

const fetchMock = vi.fn<typeof fetch>();
const SUBJECT = 1;
const CANDIDATES = Array.from({ length: 20 }, (_, i) => 101 + i);
const VISITOR = 500;
const DISCOVER_MS = 700;

const answerAfter = (ms: number, body: unknown) =>
  new Promise<Response>((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body))), ms));

beforeEach(() => {
  __resetTmdbClientStateForTests();
  resetSuggestionCache();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TMDB_READ_ACCESS_TOKEN", "test-token");
  vi.useFakeTimers();
  // AbortSignal.timeout runs on a timer fake timers cannot see; this one aborts on the fake clock.
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("The operation timed out", "TimeoutError")), ms);
    return controller.signal;
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(loadCollaboratorGraph).mockResolvedValue(new Map([[SUBJECT, { ids: CANDIDATES, counts: CANDIDATES.map(() => 5) }]]));
  fetchMock.mockImplementation((input) => {
    const { pathname } = new URL(String(input));
    if (pathname.includes("/discover/")) return answerAfter(DISCOVER_MS, { page: 1, total_pages: 1, results: [] });
    if (pathname.endsWith("/movie_credits")) return answerAfter(100, { cast: [], crew: [] });
    return answerAfter(100, { id: Number(pathname.split("/")[3]), name: "Someone" });
  });
});
afterEach(() => {
  fetchMock.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("the collaborator fan-out and a visitor's page", () => {
  it("does not queue the page's short-film lookup behind 20 candidates: only the person is looked up for shorts", async () => {
    const fanOut = suggestCollaboratorsChecked(SUBJECT);
    await vi.advanceTimersByTimeAsync(1000); // the person's own lookup is done, the candidates are loading

    const started = Date.now();
    let finishedAfter = -1;
    const page = getPersonMovieCredits(VISITOR).then((timeline) => {
      finishedAfter = Date.now() - started;
      return timeline;
    });
    await vi.advanceTimersByTimeAsync(DISCOVER_MS + 200);

    // Well under the 3s budget, and nothing cut short: the page's lookup had the lane to itself.
    expect(finishedAfter, "the page is ready").toBeGreaterThanOrEqual(0);
    expect(finishedAfter).toBeLessThanOrEqual(DISCOVER_MS + 200);
    expect((await page).shortsIncomplete).toBeUndefined();

    await vi.advanceTimersByTimeAsync(60_000);
    expect((await fanOut).complete).toBe(true);
    const lookedUp = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((url) => url.pathname.includes("/discover/"))
      .map((url) => Number(url.searchParams.get("with_people")));
    expect(lookedUp.sort((a, b) => a - b)).toEqual([SUBJECT, VISITOR]);
  });
});
