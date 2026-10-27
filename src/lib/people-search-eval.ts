import { normalizeName } from "@/lib/people-match";

/**
 * Realistic half-typed and misspelled searches with the person each one is after, used to measure
 * how well a search finds people (`npm run people:eval`, and a regression floor in
 * people-search-eval.test.ts). `expect` lists the names that count as a hit; more than one only
 * where the query is honestly ambiguous ("ste", "coppla").
 */
export interface EvalQuery {
  q: string;
  expect: readonly string[];
}

const one = (q: string, name: string): EvalQuery => ({ q, expect: [name] });

export const EVAL_QUERIES: readonly EvalQuery[] = [
  // The product owner's examples, and the ways they fail on TMDB
  one("speil", "Steven Spielberg"),
  one("spiel", "Steven Spielberg"),
  one("georg", "George Lucas"),
  one("steven spie", "Steven Spielberg"),
  one("george luc", "George Lucas"),
  {
    q: "ste",
    expect: [
      "Steven Spielberg",
      "Steven Soderbergh",
      "Steve Carell",
      "Steve Buscemi",
      "Steve McQueen",
      "Stellan Skarsgård",
      "Stephen King",
    ],
  },
  // Typos
  one("scorcese", "Martin Scorsese"),
  one("tarantno", "Quentin Tarantino"),
  { q: "cronenwet", expect: ["Jordan Cronenweth", "Jeff Cronenweth"] },
  one("kubric", "Stanley Kubrick"),
  one("hitchcok", "Alfred Hitchcock"),
  one("christoper nolan", "Christopher Nolan"),
  one("spilberg", "Steven Spielberg"),
  { q: "coppla", expect: ["Francis Ford Coppola", "Sofia Coppola"] },
  one("phillip seymour hoffman", "Philip Seymour Hoffman"),
  one("ridly scott", "Ridley Scott"),
  one("villeneuv", "Denis Villeneuve"),
  one("dicaprio", "Leonardo DiCaprio"),
  one("timothe chala", "Timothée Chalamet"),
  // Half-typed names
  one("tom han", "Tom Hanks"),
  one("deakin", "Roger Deakins"),
  one("thelma sch", "Thelma Schoonmaker"),
  one("jeff cron", "Jeff Cronenweth"),
  one("nolan", "Christopher Nolan"),
  one("chris nol", "Christopher Nolan"),
  one("denis vil", "Denis Villeneuve"),
  one("wes ander", "Wes Anderson"),
  one("cate blanch", "Cate Blanchett"),
  one("meryl str", "Meryl Streep"),
  one("leonardo dica", "Leonardo DiCaprio"),
  one("hans zim", "Hans Zimmer"),
  one("zimmer", "Hans Zimmer"),
  one("ennio mor", "Ennio Morricone"),
  one("bong joon", "Bong Joon Ho"),
  one("park chan", "Park Chan-wook"),
  one("almodovar", "Pedro Almodóvar"),
  one("kurosawa", "Akira Kurosawa"),
  one("scarlett joh", "Scarlett Johansson"),
  one("keanu", "Keanu Reeves"),
  one("robert de ni", "Robert De Niro"),
  one("daniel day", "Daniel Day-Lewis"),
  one("fincher", "David Fincher"),
  one("tim burto", "Tim Burton"),
  one("hayao miya", "Hayao Miyazaki"),
  one("guillermo del", "Guillermo del Toro"),
  one("paul thomas and", "Paul Thomas Anderson"),
  one("joaquin phoen", "Joaquin Phoenix"),
  one("emma sto", "Emma Stone"),
  one("jean luc god", "Jean-Luc Godard"),
  one("lubezki", "Emmanuel Lubezki"),
];

/** 1-based position of the first result whose name is one of the expected names; 0 when none is. */
export function hitRank(resultNames: readonly string[], expect: readonly string[]): number {
  const wanted = new Set(expect.map(normalizeName));
  const at = resultNames.findIndex((name) => wanted.has(normalizeName(name)));
  return at + 1;
}

export interface HitRates {
  queries: number;
  top1: number;
  top3: number;
  top8: number;
}

/** Fraction of queries (0..1) whose expected person is first, in the top 3, and in the top 8. */
export function hitRates(ranks: readonly number[]): HitRates {
  const within = (n: number) => ranks.filter((rank) => rank >= 1 && rank <= n).length / ranks.length;
  return { queries: ranks.length, top1: within(1), top3: within(3), top8: within(8) };
}
