import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { XPreview } from "@/components/dev/x-preview";
import { X_PREVIEW_PRESETS, parseMetaTags, previewMeta, previewTarget, type PreviewMeta } from "@/lib/x-preview";

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

  const host = requestHeaders.get("host") ?? "127.0.0.1:3000";
  const origin = `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${host}`;

  let meta: PreviewMeta | null = null;
  let error: string | null = null;
  if (!target) {
    error = "That is not a pair or a quote: use a /p/... path, a URL of one, or people ids such as 488+491.";
  } else {
    try {
      // The headers of a browser test that stubs the data layer (`next-test-*`) go on to the page it reads, so that it sees the same stub; a person's browser sends none.
      const forwarded = [...requestHeaders].filter(([name]) => name.startsWith("next-test-"));
      const response = await fetch(`${origin}${target}`, {
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
