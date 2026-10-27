import { buildPeopleSlug } from "@/lib/slug";

export interface ExamplePairing {
  /** Names must match TMDB exactly so the slug is already canonical (no redirect on click). */
  people: { id: number; name: string }[];
  blurb: string;
}

/** Ids and names were checked against TMDB search, and each pair has films together there. */
export const EXAMPLE_PAIRINGS: readonly ExamplePairing[] = [
  {
    people: [
      { id: 7467, name: "David Fincher" },
      { id: 7479, name: "Jeff Cronenweth" },
    ],
    blurb: "A director and his cinematographer: Fight Club, The Social Network, Gone Girl.",
  },
  {
    people: [
      { id: 7467, name: "David Fincher" },
      { id: 287, name: "Brad Pitt" },
    ],
    blurb: "From Se7en to Fight Club to Benjamin Button, a long and volatile partnership.",
  },
  {
    people: [
      { id: 1032, name: "Martin Scorsese" },
      { id: 3661, name: "Thelma Schoonmaker" },
    ],
    blurb: "The editor behind nearly every Scorsese picture since Raging Bull.",
  },
  {
    people: [
      { id: 1223, name: "Joel Coen" },
      { id: 151, name: "Roger Deakins" },
    ],
    blurb: "From Barton Fink to Hail, Caesar!, the eye behind the Coens’ look.",
  },
  {
    people: [
      { id: 21684, name: "Bong Joon Ho" },
      { id: 20738, name: "Song Kang-ho" },
    ],
    blurb: "Memories of Murder, The Host, Snowpiercer, Parasite: director and muse.",
  },
  {
    people: [
      { id: 136495, name: "Damien Chazelle" },
      { id: 1419631, name: "Justin Hurwitz" },
    ],
    blurb: "Whiplash, La La Land, First Man, Babylon: a director and his composer.",
  },
];

export function pairingHref(pairing: Pick<ExamplePairing, "people">): string {
  return `/p/${buildPeopleSlug(pairing.people)}`;
}
