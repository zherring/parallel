import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { XPreview } from "@/components/dev/x-preview";
import { X_PREVIEW_PRESETS, parseMetaTags, previewFetchOrigin, previewMeta, previewTarget, type PreviewMeta } from "@/lib/x-preview";

export const metadata: Metadata = { title: "X preview (development)", robots: { index: false, follow: false } };

// Seconds this function may run; why this value: see REQUEST_DEADLINE_MS in src/lib/tmdb.ts.
export const maxDuration = 30;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Where a link to a pair or a quote is previewed as it appears in a post on X, for the owner to iterate on the embeds without deploying: a development-only page (a 404 in
 * production). It fetches the target page's own HTML from this server and reads the tags X would read (`twitter:card`, `twitter:player`, `twitter:image`, the player's size),
 * so the preview frames what the app really sends; see `XPreview` for the desktop post and the phone's panel.
 */
export default async function XPreviewPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === "production") notFound();

  const [query, requestHeaders] = await Promise.all([searchParams, headers()]);
  const raw = Array.isArray(query.target) ? query.target[0] : query.target;
  const target = previewTarget(raw ?? X_PREVIEW_PRESETS[0].target);

  // `origin` is where the visitor's browser reached this page (what the preview's frames are loaded from, by the browser). It is not where the server reads the target from: the
  // `Host` header is the client's, so a crafted one would make the fetch below a request to any host and show the reply in the tags panel. That goes to this machine (the request's
  // own host if it is a loopback one, on any port, else `127.0.0.1` on the server's `PORT`).
  const host = requestHeaders.get("host") ?? "127.0.0.1:3000";
  const origin = `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${host}`;
  const fetchOrigin = previewFetchOrigin(requestHeaders.get("host"), requestHeaders.get("x-forwarded-proto"), process.env.PORT);

  let meta: PreviewMeta | null = null;
  let error: string | null = null;
  if (!target) {
    error = "That is not a pair or a quote: use a /p/... path, a URL of one, or people ids such as 488+491.";
  } else {
    try {
      // The headers of a browser test that stubs the data layer (`next-test-*`) go on to the page it reads, so that it sees the same stub; a person's browser sends none. This relies on
      // an internal of `next/experimental/testmode` (the names of the headers its Playwright fixture sends, and that the server's proxy reads them from the request): it is allowed to
      // break with a Next upgrade, and the browser test of this page (`x-preview.spec.ts`) is what says so when it does.
      const forwarded = [...requestHeaders].filter(([name]) => name.startsWith("next-test-"));
      const response = await fetch(`${fetchOrigin}${target}`, {
        cache: "no-store",
        headers: { ...Object.fromEntries(forwarded), "user-agent": "Twitterbot/1.0 (parallel x-preview)" },
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) error = `${target} answered ${response.status}.`;
      else meta = previewMeta(parseMetaTags(await response.text()));
    } catch (cause) {
      error = `${target} could not be read: ${cause instanceof Error ? cause.message : "unknown error"}.`;
    }
  }

  return <XPreview origin={origin} target={target ?? ""} input={raw ?? ""} meta={meta} error={error} />;
}
