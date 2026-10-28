import { describe, expect, it } from "vitest";
import {
  MAX_OG_POSTERS,
  OG_CONTENT_WIDTH,
  buildOgCard,
  careerSpan,
  fanWidth,
  fitFont,
  peopleLayout,
  pickPosters,
  posterSlots,
  truncateName,
} from "@/lib/og-card";
import type { Film, PersonTimeline } from "@/lib/types";

const TODAY = "2026-10-27";

const film = (id: number, year: number, over: Partial<Film> = {}): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `${year}-06-01`,
  year,
  posterPath: `/poster-${id}.jpg`,
  voteCount: 100,
  credits: [{ role: "director", job: "Director", minor: false }],
  minor: false,
  ...over,
});

const timeline = (id: number, name: string, films: Film[], profilePath: string | null = `/face-${id}.jpg`): PersonTimeline => ({
  person: { id, name, profilePath, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

describe("truncateName", () => {
  it("keeps names that fit", () => {
    expect(truncateName("Ethan Hawke", 20)).toBe("Ethan Hawke");
    expect(truncateName("Ethan Hawke", 11)).toBe("Ethan Hawke");
  });

  it("cuts long names to the limit with an ellipsis", () => {
    const cut = truncateName("Christopher Nolan-Hawthorne", 12);
    expect(cut).toBe("Christopher…");
    expect(Array.from(cut)).toHaveLength(12);
  });

  it("does not leave a space before the ellipsis, or split a character", () => {
    expect(truncateName("Anna Maria Delvaux", 6)).toBe("Anna…");
    expect(truncateName("𝒜𝒷𝒸𝒹𝒺𝒻", 4)).toBe("𝒜𝒷𝒸…");
  });
});

describe("pickPosters", () => {
  const candidate = (id: number, year: number, voteCount: number, posterPath: string | null = `/p${id}.jpg`) => ({
    id,
    title: `Film ${id}`,
    year,
    releaseDate: `${year}-01-01`,
    posterPath,
    voteCount,
  });

  it("takes the most voted films and shows them oldest first", () => {
    const picked = pickPosters([
      candidate(1, 2010, 50),
      candidate(2, 1995, 900),
      candidate(3, 2020, 300),
      candidate(4, 2001, 10),
      candidate(5, 2005, 700),
      candidate(6, 2015, 600),
    ]);
    expect(picked.map((p) => p.id)).toEqual([2, 5, 6, 3]);
  });

  it("skips films without a poster, even popular ones", () => {
    const picked = pickPosters([candidate(1, 2000, 9999, null), candidate(2, 2001, 1), candidate(3, 2002, 2)]);
    expect(picked.map((p) => p.id)).toEqual([2, 3]);
  });

  it("returns fewer than the maximum when there are fewer films", () => {
    expect(pickPosters([candidate(1, 2000, 1)])).toHaveLength(1);
    expect(pickPosters([])).toEqual([]);
  });

  it("is stable for ties and does not change its input", () => {
    const input = [candidate(2, 2002, 5), candidate(1, 2001, 5), candidate(3, 2003, 5)];
    const copy = [...input];
    expect(pickPosters(input, 2).map((p) => p.id)).toEqual([1, 2]);
    expect(input).toEqual(copy);
  });

  it("returns only the fields the card needs", () => {
    expect(pickPosters([candidate(7, 1999, 1)])[0]).toEqual({ id: 7, title: "Film 7", year: 1999, posterPath: "/p7.jpg" });
  });
});

describe("careerSpan", () => {
  it("runs from the first film to the latest released one", () => {
    expect(careerSpan([film(1, 1992), film(2, 2014), film(3, 2008)], TODAY)).toBe("1992–2014");
  });

  it("ignores films that are not out yet for the end year", () => {
    expect(careerSpan([film(1, 1992), film(2, 2014), film(3, 2027)], TODAY)).toBe("1992–2014");
  });

  it("shows one year when there is one", () => {
    expect(careerSpan([film(1, 2003)], TODAY)).toBe("2003");
    expect(careerSpan([film(1, 2003), film(2, 2003)], TODAY)).toBe("2003");
  });

  it("falls back to the unreleased films when that is all there is", () => {
    expect(careerSpan([film(1, 2028), film(2, 2029)], TODAY)).toBe("2028–2029");
  });

  it("has no span without films", () => {
    expect(careerSpan([], TODAY)).toBeNull();
  });
});

describe("buildOgCard", () => {
  const linklater = timeline(564, "Richard Linklater", [
    film(10, 1995, { voteCount: 5000 }),
    film(11, 2004, { voteCount: 4000 }),
    film(12, 2013, { voteCount: 3000 }),
    film(13, 2014, { voteCount: 6000 }),
    film(14, 2016, { voteCount: 100 }),
    film(99, 1990, { voteCount: 10 }),
  ]);
  const hawke = timeline(569, "Ethan Hawke", [
    film(10, 1995, { voteCount: 5100 }),
    film(11, 2004, { voteCount: 4000 }),
    film(12, 2013, { voteCount: 2900 }),
    film(13, 2014, { voteCount: 6000 }),
    film(14, 2016, { voteCount: 100 }),
    film(77, 2001, { voteCount: 9000 }),
  ]);

  it("describes a pair: both people, the count as the headline, the best known shared films", () => {
    const card = buildOgCard([linklater, hawke], TODAY);
    expect(card.kind).toBe("pair");
    expect(card.headline).toEqual({ figure: "5", text: "films together" });
    expect(card.people.map((p) => p.label)).toEqual(["Richard Linklater", "Ethan Hawke"]);
    expect(card.people.map((p) => p.initials)).toEqual(["RL", "EH"]);
    expect(card.people[0].profilePath).toBe("/face-564.jpg");
    expect(card.posters).toHaveLength(MAX_OG_POSTERS);
    // 14 has the fewest votes of the five shared films and is left out; the rest are oldest first.
    expect(card.posters.map((p) => p.id)).toEqual([10, 11, 12, 13]);
    expect(card.subline).toBeNull();
  });

  it("never uses a film only one of them made", () => {
    const card = buildOgCard([linklater, hawke], TODAY);
    expect(card.posters.map((p) => p.id)).not.toContain(77);
    expect(card.posters.map((p) => p.id)).not.toContain(99);
  });

  it("is singular for one shared film", () => {
    const a = timeline(1, "A One", [film(1, 2000)]);
    const b = timeline(2, "B Two", [film(1, 2000), film(2, 2005)]);
    expect(buildOgCard([a, b], TODAY).headline).toEqual({ figure: "1", text: "film together" });
  });

  it("counts only released films together, and gives an announced one no poster", () => {
    // 2027 is after TODAY (2026-10-27): both list it, but it is not a film made together yet.
    const a = timeline(1, "A One", [film(1, 2000), film(2, 2027, { voteCount: 99999 })]);
    const b = timeline(2, "B Two", [film(1, 2000), film(2, 2027, { voteCount: 99999 })]);
    const card = buildOgCard([a, b], TODAY);
    expect(card.headline).toEqual({ figure: "1", text: "film together" });
    expect(card.posters.map((p) => p.id)).toEqual([1]);
  });

  it("counts a film released today", () => {
    const a = timeline(1, "A One", [film(1, 2000), film(2, 2026, { releaseDate: TODAY })]);
    const b = timeline(2, "B Two", [film(1, 2000), film(2, 2026, { releaseDate: TODAY })]);
    expect(buildOgCard([a, b], TODAY).headline).toEqual({ figure: "2", text: "films together" });
    expect(buildOgCard([a, b], "2026-10-26").headline).toEqual({ figure: "1", text: "film together" });
  });

  it("falls back to the side-by-side card when the only shared film is announced", () => {
    const a = timeline(1, "A One", [film(1, 2000), film(2, 2028)]);
    const b = timeline(2, "B Two", [film(3, 2005), film(2, 2028)]);
    const card = buildOgCard([a, b], TODAY);
    expect(card.headline).toEqual({ figure: null, text: "Careers side by side" });
    expect(card.posters).toEqual([]);
  });

  it("says so when nothing is shared, with no posters", () => {
    const a = timeline(1, "A One", [film(1, 2000)]);
    const b = timeline(2, "B Two", [film(2, 2005)]);
    const card = buildOgCard([a, b], TODAY);
    expect(card.headline).toEqual({ figure: null, text: "Careers side by side" });
    expect(card.posters).toEqual([]);
  });

  it("counts films the way the page does: minor credits are left out", () => {
    const a = timeline(1, "A One", [film(1, 2000), film(2, 2001, { minor: true, credits: [{ role: "other", job: "Thanks", minor: true }] })]);
    const b = timeline(2, "B Two", [film(1, 2000), film(2, 2001, { minor: true, credits: [{ role: "other", job: "Thanks", minor: true }] })]);
    expect(buildOgCard([a, b], TODAY).headline.figure).toBe("1");
  });

  it("uses family names for three and four people", () => {
    const people = [
      timeline(7467, "David Fincher", [film(1, 1999)]),
      timeline(7479, "Jeff Cronenweth", [film(1, 1999)]),
      timeline(287, "Brad Pitt", [film(1, 1999)]),
      timeline(819, "Edward Norton", [film(1, 1999)]),
    ];
    expect(buildOgCard(people.slice(0, 3), TODAY).people.map((p) => p.label)).toEqual(["Fincher", "Cronenweth", "Pitt"]);
    const four = buildOgCard(people, TODAY);
    expect(four.people.map((p) => p.label)).toEqual(["Fincher", "Cronenweth", "Pitt", "Norton"]);
    expect(four.headline).toEqual({ figure: "1", text: "film together" });
  });

  it("truncates a family name that would overflow its column", () => {
    const people = [
      timeline(1, "A Wolfeschlegelsteinhausenberger", [film(1, 1999)]),
      timeline(2, "B Smith", [film(1, 1999)]),
      timeline(3, "C Jones", [film(1, 1999)]),
    ];
    const label = buildOgCard(people, TODAY).people[0].label;
    expect(label.endsWith("…")).toBe(true);
    expect(Array.from(label).length).toBeLessThanOrEqual(17);
  });

  it("falls back to initials data when a person has no photo", () => {
    const card = buildOgCard([timeline(1, "Madonna", [film(1, 1985)], null), timeline(2, "Guy Ritchie", [film(1, 1985)])], TODAY);
    expect(card.people[0]).toMatchObject({ initials: "M", profilePath: null });
  });

  it("describes one person by career span, film count and top posters", () => {
    const solo = timeline(7467, "David Fincher", [
      film(1, 1992, { voteCount: 3000 }),
      film(2, 1995, { voteCount: 20000 }),
      film(3, 1999, { voteCount: 25000 }),
      film(4, 2010, { voteCount: 11000 }),
      film(5, 2014, { voteCount: 15000 }),
      film(6, 2023, { voteCount: 5000, posterPath: null }),
      film(7, 2001, { minor: true, voteCount: 99999 }),
      film(8, 2030, { voteCount: 1, releaseDate: "2030-01-01" }),
    ]);
    const card = buildOgCard([solo], TODAY);
    expect(card.kind).toBe("solo");
    expect(card.headline).toEqual({ figure: null, text: "1992–2023" });
    expect(card.subline).toBe("7 films on a timeline");
    expect(card.people).toHaveLength(1);
    expect(card.people[0].label).toBe("David Fincher");
    // Not the minor one, not the one without a poster; most voted four, oldest first.
    expect(card.posters.map((p) => p.id)).toEqual([2, 3, 4, 5]);
  });

  it("handles a person with no films", () => {
    const card = buildOgCard([timeline(1, "Newcomer", [])], TODAY);
    expect(card.headline.text).toBe("Filmography");
    expect(card.subline).toBeNull();
    expect(card.posters).toEqual([]);
  });

  it("is singular for a person with one film", () => {
    expect(buildOgCard([timeline(1, "Solo Artist", [film(1, 2010)])], TODAY).subline).toBe("1 film on a timeline");
  });

  it("sets every name at the size the longest one fits, so the row looks even", () => {
    const people = [
      timeline(1, "A Schoonmakerowski", [film(1, 1999)]),
      timeline(2, "B Smith", [film(1, 1999)]),
      timeline(3, "C Jones", [film(1, 1999)]),
    ];
    const sizes = buildOgCard(people, TODAY).people.map((p) => p.fontSize);
    expect(new Set(sizes).size).toBe(1);
    expect(sizes[0]).toBeLessThan(peopleLayout(3).font);
  });

  it("keeps the full size when every name fits", () => {
    const people = [
      timeline(1, "A Smith", [film(1, 1999)]),
      timeline(2, "B Jones", [film(1, 1999)]),
      timeline(3, "C Brown", [film(1, 1999)]),
    ];
    expect(buildOgCard(people, TODAY).people.map((p) => p.fontSize)).toEqual([32, 32, 32]);
  });
});

describe("fitFont", () => {
  it("keeps the largest size when the longest word fits", () => {
    expect(fitFont("Ethan Hawke", 300, 36, 20)).toBe(36);
  });

  it("shrinks until the longest word fits, never below the minimum", () => {
    // 10 letters at 0.6em: 300px allows 50px, 150px allows 25px, 20px allows the floor.
    expect(fitFont("Cronenweth", 300, 62, 20)).toBe(50);
    expect(fitFont("Cronenweth", 150, 62, 20)).toBe(25);
    expect(fitFont("Cronenweth", 20, 62, 22)).toBe(22);
  });

  it("measures the longest word, not the whole name, because names wrap", () => {
    expect(fitFont("Richard Linklater", 216, 36, 20)).toBe(36);
  });

  it("handles empty text", () => {
    expect(fitFont("", 100, 30, 20)).toBe(30);
  });
});

describe("layout", () => {
  it("makes portraits overlap for two or more people, and not for one", () => {
    for (const n of [2, 3, 4]) {
      const layout = peopleLayout(n);
      expect(layout.pitch).toBeLessThan(layout.diameter);
      expect(layout.width).toBe(n * layout.pitch);
    }
    expect(peopleLayout(1).pitch).toBe(0);
  });

  it("clamps the people count", () => {
    expect(peopleLayout(0)).toEqual(peopleLayout(1));
    expect(peopleLayout(9)).toEqual(peopleLayout(4));
  });

  it("always leaves room for a fan next to the people", () => {
    for (const n of [1, 2, 3, 4]) {
      expect(peopleLayout(n).width + fanWidth(n)).toBeLessThan(OG_CONTENT_WIDTH);
      expect(fanWidth(n)).toBeGreaterThan(400);
    }
  });

  it("fits every poster count inside the fan, as 2:3 posters stepping right", () => {
    for (const people of [1, 2, 3, 4]) {
      const available = fanWidth(people);
      for (let k = 1; k <= MAX_OG_POSTERS; k++) {
        const slots = posterSlots(available, k);
        expect(slots).toHaveLength(k);
        const total = slots[0].width + slots.slice(1).reduce((sum, slot) => sum + slot.pitch, 0);
        expect(total).toBeLessThanOrEqual(available);
        for (const slot of slots) {
          expect(slot.height).toBe(Math.round(slot.width * 1.5));
          expect(slot.width).toBeGreaterThan(120);
        }
        expect(slots[0].pitch).toBe(0);
        // Each poster overlaps the one before but leaves more than half of it showing.
        for (const slot of slots.slice(1)) {
          expect(slot.pitch).toBeLessThan(slots[0].width);
          expect(slot.pitch).toBeGreaterThan(slots[0].width / 2);
        }
      }
    }
  });

  it("makes a lone poster bigger than one of four", () => {
    expect(posterSlots(500, 1)[0].width).toBeGreaterThan(posterSlots(500, 4)[0].width);
  });

  it("tilts the posters like dealt cards, alternating up and down", () => {
    const slots = posterSlots(600, 4);
    expect(slots.map((s) => s.rotate)).toEqual([-7, -2.5, 2.5, 7]);
    expect(Math.sign(slots[0].dy)).not.toBe(Math.sign(slots[1].dy));
  });

  it("has no slots without posters, and never more than the maximum", () => {
    expect(posterSlots(600, 0)).toEqual([]);
    expect(posterSlots(600, 9)).toHaveLength(MAX_OG_POSTERS);
  });
});
