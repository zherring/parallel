/** Browser-side helpers for calling our own /api routes with typed, user-friendly failures. */

export type ApiErrorKind = "not-found" | "rate-limited" | "server" | "network";

export class ApiClientError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status?: number,
  ) {
    super(`API request failed (${kind}${status ? ` ${status}` : ""})`);
    this.name = "ApiClientError";
  }
}

export function errorKindForStatus(status: number): ApiErrorKind {
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  return "server";
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * GETs JSON. Aborts surface as the original AbortError (callers ignore those); everything else
 * becomes an ApiClientError.
 */
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiClientError("network");
  }
  if (!res.ok) throw new ApiClientError(errorKindForStatus(res.status), res.status);
  try {
    return (await res.json()) as T;
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiClientError("server", res.status);
  }
}

export type ApiSubject = "search" | "film";

export function errorMessage(kind: ApiErrorKind, subject: ApiSubject): string {
  switch (kind) {
    case "rate-limited":
      return subject === "search"
        ? "You're searching a little too fast. Wait a moment and try again."
        : "Too many requests right now. Wait a moment and try again.";
    case "not-found":
      return subject === "film"
        ? "We couldn't find that film on TMDB."
        : "Nothing found for that search.";
    case "network":
      return "Can't reach the server. Check your connection and try again.";
    case "server":
      return subject === "search"
        ? "Search is having trouble right now. Please try again."
        : "Film details are unavailable right now. Please try again.";
  }
}
