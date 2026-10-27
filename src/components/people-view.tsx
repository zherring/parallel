import Link from "next/link";
import { joinNames } from "@/lib/format";
import { roleSummary } from "@/lib/roles";
import { buildPeopleSlug } from "@/lib/slug";
import type { PairShared } from "@/lib/shared";
import type { Film, PersonTimeline, SharedFilm } from "@/lib/types";

interface Props {
  timelines: PersonTimeline[];
  /** Films all people share, non-minor credits only. */
  shared: SharedFilm[];
  /** Per-pair shared films; empty unless there are 3 or more people. */
  pairwise: PairShared[];
}

const tmdbMovieUrl = (id: number) => `https://www.themoviedb.org/movie/${id}`;

function FilmLink({ film }: { film: Pick<Film, "id" | "title"> }) {
  return (
    <a href={tmdbMovieUrl(film.id)} className="text-strong underline-offset-2 hover:underline">
      {film.title}
    </a>
  );
}

export function PeopleView({ timelines, shared, pairwise }: Props) {
  const nameById = new Map(timelines.map((t) => [t.person.id, t.person.name]));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold text-strong">
        {joinNames(timelines.map((t) => t.person.name))}
      </h1>

      {timelines.length > 1 && (
        <section aria-labelledby="together" className="mt-8">
          <h2 id="together" className="text-xl font-semibold text-strong">
            Films together
          </h2>
          {shared.length === 0 ? (
            <p className="mt-2 text-muted">No films together found on TMDB.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {shared.map((film) => (
                <li key={film.id}>
                  <time dateTime={film.releaseDate} className="mr-2 tabular-nums text-muted">
                    {film.year}
                  </time>
                  <FilmLink film={film} />
                  <ul className="ml-12 text-sm text-muted">
                    {timelines.map(({ person }) => (
                      <li key={person.id}>
                        {person.name}: {roleSummary(film.byPerson[person.id])}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}

          {pairwise.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-strong">By pair</h3>
              {pairwise.map(({ a, b, films }) => (
                <section key={`${a}-${b}`} className="mt-3">
                  <h4 className="text-strong">
                    {nameById.get(a)} & {nameById.get(b)}
                  </h4>
                  {films.length === 0 ? (
                    <p className="text-sm text-muted">No films together found on TMDB.</p>
                  ) : (
                    <ul className="text-sm">
                      {films.map((film) => (
                        <li key={film.id}>
                          <span className="mr-2 tabular-nums text-muted">{film.year}</span>
                          <FilmLink film={film} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </section>
      )}

      {timelines.map(({ person, films }) => {
        const listed = films.filter((f) => !f.minor);
        return (
          <section key={person.id} aria-labelledby={`person-${person.id}`} className="mt-10">
            <h2 id={`person-${person.id}`} className="text-xl font-semibold text-strong">
              {timelines.length > 1 ? (
                <Link href={`/p/${buildPeopleSlug([person])}`}>{person.name}</Link>
              ) : (
                person.name
              )}
            </h2>
            {person.knownFor && <p className="text-sm text-muted">Known for {person.knownFor}</p>}
            {listed.length === 0 ? (
              <p className="mt-3 text-muted">No films found on TMDB.</p>
            ) : (
              <ol className="mt-3 space-y-1">
                {listed.map((film) => (
                  <li key={film.id}>
                    <time dateTime={film.releaseDate} className="mr-2 tabular-nums text-muted">
                      {film.year}
                    </time>
                    <FilmLink film={film} />
                    <span className="ml-2 text-sm text-muted">
                      {roleSummary(film.credits.filter((c) => !c.minor))}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
