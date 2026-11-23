/**
 * Spike (zherring/spike-portraits): `npm run portraits:cut`.
 *
 * For each artist in PORTRAIT_IDS, reads the person from TMDB (profile_path, plus their best-known films' posters for the contact sheet),
 * downloads the portrait (w780, see `SOURCE_SIZE`) to scripts/portraits/.cache (gitignored), and has cut.py (rembg + OpenCV, in scripts/portraits/.venv) turn it
 * into 12-, 20- and 32-vertex polygons. Writes normalized points, not images, to src/lib/portrait-cuts.json, keyed by TMDB person id.
 * The photo is the person's override (`PROFILE_OVERRIDES`) if they have one, else TMDB's current one (never the app's `profilePathFor`, which follows the cut: this
 * script has to see TMDB's photo change). An id whose stored profilePath matches that photo is skipped; a changed photo is recomputed.
 * The run fails (exit code 1, the people named) when an override is not among the person's TMDB images, or when birefnet-portrait found nothing and the
 * isnet-general-use fallback cut instead: that cut is not kept (the fallback made Gene Wilder's garbage). Cuts that did succeed are saved either way.
 *
 * `npm run portraits:cut -- --posters [ids]` refreshes only each person's posters (posters.ts: their best-known, varied films' posters, the core `posters` here and
 * the extension in portrait-backdrops.json) and cuts no one: the polygons, the photos and everything else in the file stay as they are, and it needs neither Python nor the venv.
 * A normal run gives the people it has just cut the same lists.
 *
 * Setup once: python3 -m venv scripts/portraits/.venv && scripts/portraits/.venv/bin/python -I -m pip install "rembg[cpu]" opencv-python-headless numpy
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BACKDROP_POSTERS } from "../../src/lib/backdrop-posters";
import { buildHeroPairings } from "../../src/lib/example-cards";
import { heroPool } from "../../src/lib/hero-scenes";
import { PORTRAIT_IDS, type PortraitCut, type PortraitCuts } from "../../src/lib/portrait-cuts";
import { PROFILE_OVERRIDES } from "../../src/lib/profile-overrides";
import { acceptedShortLists, posterLists, readBackdrops, writeBackdrops } from "./posters";
import { fetchPerson, fetchProfilePaths, requireTmdbToken, topPosters, type Person } from "./tmdb";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const outFile = join(root, "src/lib/portrait-cuts.json");
const cacheDir = join(here, ".cache");
const python = join(here, ".venv/bin/python");

/**
 * The rendition the photo is cut from. w500 (what the app shows) is a poor source: TMDB's CDN serves a corrupt w500 of some photos (Gene Wilder's was
 * striped noise), and the model does better on more pixels. The cut's points are normalized, so the size does not touch what the app draws. TMDB's
 * image configuration lists no w780 for profiles (w45, w185, h632, original), but its CDN serves it, as it does w500.
 */
const SOURCE_SIZE = "w780";

/** The model whose cut is kept; cut.py's retry with another (`PortraitCut.model`) means birefnet-portrait found almost nothing in the photo. */
const PRIMARY_MODEL = "birefnet-portrait";

/** Photos per cut.py process: the JSON is written after each, so a run that dies partway resumes from the last finished batch. */
const BATCH = 8;

type CutResult = Omit<PortraitCut, "name" | "profilePath" | "posters"> | { error: string } | null;

/** Writes the file in PORTRAIT_IDS order (so diffs stay readable) and returns what it wrote. */
function write(existing: PortraitCuts): PortraitCuts {
  const ordered: PortraitCuts = {};
  for (const id of PORTRAIT_IDS) if (existing[id]) ordered[id] = existing[id];
  writeFileSync(outFile, `${JSON.stringify(ordered)}\n`);
  return ordered;
}

/** Flags fallback cuts and writes the file. */
function save(existing: PortraitCuts): PortraitCuts {
  // The run no longer keeps a fallback cut (`PRIMARY_MODEL`); this flags one stored before that rule (model is stored), so it stays listed at the end of a run.
  for (const cut of Object.values(existing)) {
    if (cut.model === PRIMARY_MODEL) {
      delete cut.flagged;
      delete cut.flagReason;
    } else {
      cut.flagged = true;
      cut.flagReason = `birefnet-portrait mask under 5%; kept the ${cut.model} fallback`;
    }
  }
  return write(existing);
}

/**
 * Replaces `posters` (the core) of each of `ids` in `existing` and writes the extension, from `posterLists`; a person it could not make a list of keeps theirs. Returns the lines
 * to print: the problems, the people whose list repeats a poster (fewer films than tiles) and those whose collections could not all be kept apart.
 */
async function refreshPosters(existing: PortraitCuts, ids: readonly number[]): Promise<{ lines: string[]; ok: boolean }> {
  const { lists, problems } = await posterLists(ids);
  const backdrops = readBackdrops();
  const short: string[] = [];
  const relaxed: string[] = [];
  for (const [id, list] of lists) {
    const cut = existing[id];
    cut.posters = list.core;
    backdrops[id] = list.extension;
    if (list.distinct < BACKDROP_POSTERS) short.push(`  ${id} ${cut.name}: ${list.distinct} different posters (${list.films} films)`);
    if (list.relaxed !== "none") relaxed.push(`  ${id} ${cut.name}: ${list.relaxed} touch (${list.films} films)`);
  }
  writeBackdrops(backdrops);
  const out = [`${lists.size} posters lists made`];
  if (short.length > 0) out.push(`${short.length} with fewer than ${BACKDROP_POSTERS} different posters (a poster repeats, never on a tile beside itself):`, ...short);
  if (relaxed.length > 0) out.push(`${relaxed.length} whose collections or posters could not all be kept apart:`, ...relaxed);
  // The stored lists of everyone (not only this run's people), in the form of the test's table: paste these over its entries.
  const landingIds = heroPool(buildHeroPairings()).flatMap((pairing) => pairing.people.map((person) => person.id));
  out.push(`ACCEPTED_SHORT_LISTS in src/lib/portrait-backdrops.test.ts, as this data needs it (the landing page's people with fewer than ${BACKDROP_POSTERS} different posters); paste these over the table's entries:`, ...acceptedShortLists(existing, backdrops, landingIds));
  if (problems.length > 0) out.push(`${problems.length} problems:`, ...problems.map((line) => `  ${line}`));
  return { lines: out, ok: problems.length === 0 };
}

/** `--posters`: only the posters. The ids after it, if any, are the people refreshed; else everyone in the file. */
async function mainPosters(argv: readonly string[]) {
  const existing: PortraitCuts = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};
  const named = argv.filter((arg) => /^\d+$/.test(arg)).map(Number);
  const ids = (named.length > 0 ? named : PORTRAIT_IDS).filter((id) => existing[id]);
  console.log(`${ids.length} people`);
  const { lines, ok } = await refreshPosters(existing, ids);
  // Written as it was read, only `posters` changed: no flagging, no dropping of anyone's polygons.
  write(existing);
  for (const line of lines) console.log(line);
  if (!ok) process.exitCode = 1;
}

async function main() {
  requireTmdbToken();
  const argv = process.argv.slice(2);
  if (argv.includes("--posters")) return mainPosters(argv);
  const started = Date.now();
  const existing: PortraitCuts = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};
  mkdirSync(cacheDir, { recursive: true });
  const noPhoto: string[] = [];
  const failed: string[] = [];
  const fellBack: string[] = [];
  const cutIds: number[] = [];

  // An override that TMDB does not list for the person would 404 or show another photo: fail before cutting anything.
  const unlisted: string[] = [];
  for (const [id, path] of Object.entries(PROFILE_OVERRIDES)) {
    const listed = await fetchProfilePaths(Number(id));
    if (!listed.includes(path)) unlisted.push(`${id}: ${path} is not among TMDB's profile images for the person`);
  }
  if (unlisted.length > 0) {
    console.error(`PROFILE_OVERRIDES names photos TMDB does not list:\n${unlisted.map((line) => `  ${line}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }

  const pending: { id: number; person: Person; photo: string; file: string }[] = [];
  for (const id of PORTRAIT_IDS) {
    try {
      const person = await fetchPerson(id);
      const photo = PROFILE_OVERRIDES[id] ?? person.profile_path;
      if (!photo) {
        console.log(`${id} ${person.name}: no TMDB photo, skipped`);
        noPhoto.push(`${id} ${person.name}`);
        continue;
      }
      if (existing[id]?.profilePath === photo) {
        console.log(`${id} ${person.name}: unchanged, skipped`);
        continue;
      }
      const file = join(cacheDir, `${SOURCE_SIZE}_${id}${photo.replace(/\//g, "_")}`);
      if (!existsSync(file)) {
        const image = await fetch(`https://image.tmdb.org/t/p/${SOURCE_SIZE}${photo}`);
        if (!image.ok) throw new Error(`portrait answered ${image.status}`);
        writeFileSync(file, Buffer.from(await image.arrayBuffer()));
      }
      pending.push({ id, person, photo, file });
    } catch (error) {
      console.log(`${id}: ${(error as Error).message}, skipped`);
      failed.push(`${id}: ${(error as Error).message}`);
    }
  }
  console.log(`${pending.length} to cut of ${PORTRAIT_IDS.length}`);

  if (pending.length > 0) {
    // Python's own CA bundle can be missing (python.org installs); point it at certifi's for the one-time model download.
    const certs = execFileSync(python, ["-I", "-c", "import certifi; print(certifi.where())"], { encoding: "utf8" }).trim();
    for (let at = 0; at < pending.length; at += BATCH) {
      const batch = pending.slice(at, at + BATCH);
      let results: Record<string, CutResult>;
      try {
        const stdout = execFileSync(python, ["-I", join(here, "cut.py"), ...batch.map((p) => `${p.id}=${p.file}`)], {
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
          stdio: ["ignore", "pipe", "inherit"],
          env: { ...process.env, SSL_CERT_FILE: process.env.SSL_CERT_FILE ?? certs },
        });
        results = (JSON.parse(stdout) as { results: Record<string, CutResult> }).results;
      } catch (error) {
        console.log(`cut.py failed on ${batch.map((p) => p.id).join(", ")}: ${(error as Error).message}`);
        for (const { id, person } of batch) failed.push(`${id} ${person.name}: cut.py process failed`);
        continue;
      }
      for (const { id, person, photo } of batch) {
        const result = results[id];
        if (!result) {
          console.log(`${id} ${person.name}: no person found in the photo`);
          failed.push(`${id} ${person.name}: no person found in the photo`);
          continue;
        }
        if ("error" in result) {
          console.log(`${id} ${person.name}: ${result.error}`);
          failed.push(`${id} ${person.name}: ${result.error}`);
          continue;
        }
        if (result.model !== PRIMARY_MODEL) {
          const line = `${id} ${person.name}: ${PRIMARY_MODEL} found almost nothing in ${photo} (or could not load) and ${result.model} cut it instead; not kept`;
          console.error(line);
          fellBack.push(line);
          continue;
        }
        existing[id] = { name: person.name, profilePath: photo, ...result, posters: topPosters(person, 9) };
        cutIds.push(id);
        console.log(`${id} ${person.name}: cut with ${result.model} (mask covers ${Math.round(result.coverage * 100)}% of the frame)`);
      }
      save(existing);
      console.log(`[${Math.min(at + BATCH, pending.length)}/${pending.length}] saved`);
    }
    // The people cut now get the new lists of posters too (their `topPosters` above is only a stand-in).
    const refreshed = await refreshPosters(existing, cutIds);
    for (const line of refreshed.lines) console.log(line);
    if (!refreshed.ok) process.exitCode = 1;
  }

  const ordered = save(existing);
  console.log(`${Object.keys(ordered).length} entries in ${outFile}; ${pending.length} attempted; ${Math.round((Date.now() - started) / 1000)}s`);
  const flagged = Object.entries(ordered).filter(([, cut]) => cut.flagged);
  console.log(`${flagged.length} flagged${flagged.length ? ":" : ""}`);
  for (const [id, cut] of flagged) console.log(`  ${id} ${cut.name}: ${cut.flagReason}`);
  console.log(`${noPhoto.length} with no TMDB photo${noPhoto.length ? ":" : ""}`);
  for (const line of noPhoto) console.log(`  ${line}`);
  console.log(`${failed.length} failed${failed.length ? ":" : ""}`);
  for (const line of failed) console.log(`  ${line}`);
  if (fellBack.length > 0) {
    console.error(`\n${fellBack.length} cut by the fallback model, so not kept (their old cut-outs, if any, stay; pick another photo for them in PROFILE_OVERRIDES):`);
    for (const line of fellBack) console.error(`  ${line}`);
    process.exitCode = 1;
  }
}

await main();
