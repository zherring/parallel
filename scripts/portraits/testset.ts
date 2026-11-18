/**
 * Spike (zherring/spike-portraits): `npm run portraits:testset`.
 *
 * Nineteen well-known film people with no cut (none is in PORTRAIT_IDS), for the tear fallback (src/lib/portrait-tears.ts) in /dev/portraits/grid.
 * Reads each from TMDB (profile_path, plus their most-voted films' posters, as cut.ts) and writes src/lib/portrait-testset.json. No segmentation.
 */
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PORTRAIT_IDS } from "../../src/lib/portrait-cuts";
import type { PortraitTestArtist } from "../../src/lib/portrait-tears";
import { fetchPerson, requireTmdbToken, topPosters } from "./tmdb";

const outFile = join(resolve(dirname(fileURLToPath(import.meta.url)), "../.."), "src/lib/portrait-testset.json");

/** Directors and actors, men and women, across eras, ethnicities and framings. */
const TEST_SET_IDS: readonly number[] = [
  5064, // Meryl Streep
  505710, // Zendaya
  1190668, // Timothée Chalamet
  112, // Cate Blanchett
  19492, // Viola Davis
  932967, // Mahershala Ali
  1373737, // Florence Pugh
  1253360, // Pedro Pascal
  1620, // Michelle Yeoh
  14392, // Kathryn Bigelow
  1769, // Sofia Coppola
  929825, // Ava DuVernay
  55934, // Taika Waititi
  206919, // Daniel Kaluuya
  1038, // Jodie Foster
  1395183, // Chloé Zhao
  6817, // Agnès Varda
  16897, // Sidney Poitier
  1932, // Audrey Hepburn
];

async function main() {
  requireTmdbToken();
  const covered = TEST_SET_IDS.filter((id) => PORTRAIT_IDS.includes(id));
  if (covered.length) throw new Error(`already cut (in PORTRAIT_IDS): ${covered.join(", ")}`);
  const artists: PortraitTestArtist[] = [];
  for (const id of TEST_SET_IDS) {
    const person = await fetchPerson(id);
    if (!person.profile_path) {
      console.log(`${id} ${person.name}: no TMDB photo, skipped`);
      continue;
    }
    artists.push({ id, name: person.name, profilePath: person.profile_path, posters: topPosters(person, 9) });
    console.log(`${id} ${person.name}`);
  }
  writeFileSync(outFile, `${JSON.stringify(artists, null, 2)}\n`);
  console.log(`${artists.length} artists in ${outFile}`);
}

await main();
