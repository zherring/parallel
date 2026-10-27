import { tmdbImage } from "@/lib/images";
import { MINOR_TOGGLE_LABEL, roleSummary } from "@/lib/roles";
import type { PairShared } from "@/lib/shared";
import type { SharedFilm } from "@/lib/types";
import type { PersonRef } from "@/lib/lanes";
import { ShareActions } from "./share-actions";

interface TogetherProps {
  people: PersonRef[];
  shared: SharedFilm[];
  pairwise: PairShared[];
  /** Films that would be added by turning minor credits on; 0 when already on. */
  minorExtra: number;
  /** Films together as the page shows them by default (non-minor credits), for the share text. */
  shareCount: number;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

const tmdbMovieUrl = (id: number) => `https://www.themoviedb.org/movie/${id}`;

const linkClass = "font-medium text-strong underline-offset-2 hover:underline";
const detailsButtonClass =
  "rounded text-sm text-accent-blue underline-offset-2 hover:underline";

function Thumb({ film }: { film: Pick<SharedFilm, "title" | "posterPath"> }) {
  const src = tmdbImage(film.posterPath, "w92");
  return src ? (
    <img
      src={src}
      alt=""
      width={48}
      height={72}
      loading="lazy"
      decoding="async"
      className="h-[72px] w-12 rounded-[4px] border border-strong/20 object-cover"
    />
  ) : (
    <span
      aria-hidden
      className="flex h-[72px] w-12 items-center justify-center rounded-[4px] border border-border bg-surface p-1 text-center text-[9px] leading-tight text-muted"
    >
      <span className="line-clamp-4 break-words">{film.title}</span>
    </span>
  );
}

export function Together({ people, shared, pairwise, minorExtra, shareCount, onSelect }: TogetherProps) {
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const count = shared.length;

  return (
    <section aria-labelledby="together" className="mt-10">
      <ShareActions
        shared={shared}
        names={people.map((p) => p.name)}
        canExport
        share={{ people, count: shareCount }}
        heading={
          <h2 id="together" className="text-xl font-semibold text-strong">
            {count === 0 ? "No films together" : `${count} ${count === 1 ? "film" : "films"} together`}
          </h2>
        }
      />

      {count === 0 ? (
        <p className="mt-4 max-w-xl text-body">
          No films together found on TMDB. Try adding a collaborator in a nearby role, such as the cinematographer,
          editor or a co-star.
          {minorExtra > 0 && ` Turning on "${MINOR_TOGGLE_LABEL}" would add ${minorExtra}.`}
        </p>
      ) : (
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {shared.map((film) => (
            <li key={film.id} className="flex gap-3 rounded-lg border border-border bg-surface p-3">
              <button
                type="button"
                aria-label={`Open details for ${film.title} (${film.year})`}
                onClick={(event) => onSelect(film.id, event.currentTarget)}
                className="shrink-0 cursor-pointer self-start rounded-[4px]"
              >
                <Thumb film={film} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="break-words">
                  <a href={tmdbMovieUrl(film.id)} className={linkClass}>
                    {film.title}
                  </a>{" "}
                  <time dateTime={film.releaseDate} className="tabular-nums text-muted">
                    {film.year}
                  </time>
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-muted">
                  {people.map((person) => (
                    <li key={person.id}>
                      <span className="text-body">{person.name}</span>: {roleSummary(film.byPerson[person.id] ?? [])}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`${detailsButtonClass} mt-1.5 cursor-pointer`}
                  onClick={(event) => onSelect(film.id, event.currentTarget)}
                >
                  View details
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {pairwise.length > 0 && (
        <details className="mt-6 rounded-lg border border-border bg-surface">
          <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-strong">
            By pair <span className="font-normal text-muted">({pairwise.length} pairs)</span>
          </summary>
          <div className="space-y-4 px-4 pb-4">
            {pairwise.map(({ a, b, films }) => (
              <section key={`${a}-${b}`}>
                <h3 className="text-strong">
                  {nameById.get(a)} & {nameById.get(b)}
                </h3>
                {films.length === 0 ? (
                  <p className="text-sm text-muted">No films together found on TMDB.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {films.map((film) => (
                      <li key={film.id}>
                        <time dateTime={film.releaseDate} className="mr-2 tabular-nums text-muted">
                          {film.year}
                        </time>
                        <a href={tmdbMovieUrl(film.id)} className={linkClass}>
                          {film.title}
                        </a>{" "}
                        <button
                          type="button"
                          className={`${detailsButtonClass} ml-1 cursor-pointer`}
                          onClick={(event) => onSelect(film.id, event.currentTarget)}
                        >
                          Details
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
