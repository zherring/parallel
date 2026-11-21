/**
 * The site's footer: who made it and where the code is, at the left; the credits at the right, in the small type, as three lines: TMDB's mark on its own line, then its notice, then the awards data's
 * source (the notice and the source are the same size). Below `md` (768px) the two groups stack, the credits under the first, at the left; from `md` the credits are right-aligned. TMDB's terms ask for
 * the mark with the notice, and for it to be less prominent than the site's own name, which it is (it is 10px tall, and the notice is in small type).
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border text-sm text-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 md:flex-row md:items-start md:justify-between md:gap-8">
        <p className="md:shrink-0">
          A project by{" "}
          <a href="https://zachherring.com" className="underline hover:text-strong">
            Zach Herring
          </a>
          <span aria-hidden="true"> · </span>
          <a href="https://github.com/zherring/parallel" className="underline hover:text-strong">
            Open source on GitHub
          </a>
        </p>
        <div className="flex min-w-0 flex-col gap-1 text-xs md:items-end md:text-right">
          {/* Official TMDB mark, on its own line above the notice; kept smaller than the Parallel wordmark per their guidelines. */}
          <a href="https://www.themoviedb.org/" aria-label="TMDB" className="block w-fit">
            <img src="/tmdb-logo.svg" alt="TMDB" width={78} height={10} className="block h-2.5 w-auto" />
          </a>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          <p>
            Awards data from{" "}
            <a href="https://www.wikidata.org/" className="underline hover:text-strong">
              Wikidata
            </a>{" "}
            (CC0)
          </p>
        </div>
      </div>
    </footer>
  );
}
