export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border text-sm text-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p>
          A project by{" "}
          <a href="https://zachherring.com" className="underline hover:text-strong">
            Zach Herring
          </a>
        </p>
        <div className="flex items-center gap-3">
          {/* Official TMDB mark; kept smaller than the Parallel wordmark per their guidelines. */}
          <a href="https://www.themoviedb.org/" aria-label="TMDB" className="shrink-0">
            <img src="/tmdb-logo.svg" alt="TMDB" width={78} height={10} className="h-2.5 w-auto" />
          </a>
          <p className="max-w-xs">
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>
      </div>
    </footer>
  );
}
