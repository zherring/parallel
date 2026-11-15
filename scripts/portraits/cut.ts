/**
 * Spike (zherring/spike-portraits): `npm run portraits:cut`.
 *
 * For each artist in PORTRAIT_IDS, reads the person from TMDB (profile_path, plus their best-known films' posters for the contact sheet),
 * downloads the w500 portrait to scripts/portraits/.cache (gitignored), and has cut.py (rembg + OpenCV, in scripts/portraits/.venv) turn it
 * into 12-, 20- and 32-vertex polygons. Writes normalized points, not images, to src/lib/portrait-cuts.json, keyed by TMDB person id.
 * An id whose stored profilePath matches TMDB's current one is skipped; a changed photo is recomputed.
 *
 * Setup once: python3 -m venv scripts/portraits/.venv && scripts/portraits/.venv/bin/python -I -m pip install "rembg[cpu]" opencv-python-headless numpy
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PORTRAIT_IDS, type PortraitCut, type PortraitCuts } from "../../src/lib/portrait-cuts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const outFile = join(root, "src/lib/portrait-cuts.json");
const cacheDir = join(here, ".cache");
const python = join(here, ".venv/bin/python");

const token = process.env.TMDB_READ_ACCESS_TOKEN;
if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is not set (put it in .env)");

interface Credit {
  id: number;
  poster_path: string | null;
  vote_count?: number;
}
interface Person {
  name: string;
  profile_path: string | null;
  movie_credits: { cast: Credit[]; crew: Credit[] };
}

async function tmdb<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`TMDB ${path} answered ${response.status}`);
  return (await response.json()) as T;
}

function topPosters(person: Person, count: number): string[] {
  const seen = new Set<number>();
  return [...person.movie_credits.crew, ...person.movie_credits.cast]
    .filter((c) => c.poster_path && !seen.has(c.id) && seen.add(c.id))
    .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    .slice(0, count)
    .map((c) => c.poster_path!);
}

async function main() {
  const existing: PortraitCuts = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};
  mkdirSync(cacheDir, { recursive: true });

  const pending: { id: number; person: Person; file: string }[] = [];
  for (const id of PORTRAIT_IDS) {
    const person = await tmdb<Person>(`/person/${id}?append_to_response=movie_credits`);
    if (!person.profile_path) {
      console.log(`${id} ${person.name}: no TMDB photo, skipped`);
      continue;
    }
    if (existing[id]?.profilePath === person.profile_path) {
      console.log(`${id} ${person.name}: unchanged, skipped`);
      continue;
    }
    const file = join(cacheDir, `${id}${person.profile_path.replace(/\//g, "_")}`);
    if (!existsSync(file)) {
      const image = await fetch(`https://image.tmdb.org/t/p/w500${person.profile_path}`);
      if (!image.ok) throw new Error(`portrait for ${id} answered ${image.status}`);
      writeFileSync(file, Buffer.from(await image.arrayBuffer()));
    }
    pending.push({ id, person, file });
  }

  if (pending.length > 0) {
    // Python's own CA bundle can be missing (python.org installs); point it at certifi's for the one-time model download.
    const certs = execFileSync(python, ["-I", "-c", "import certifi; print(certifi.where())"], { encoding: "utf8" }).trim();
    const stdout = execFileSync(python, ["-I", join(here, "cut.py"), ...pending.map((p) => `${p.id}=${p.file}`)], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, SSL_CERT_FILE: process.env.SSL_CERT_FILE ?? certs },
    });
    const { results } = JSON.parse(stdout) as { results: Record<string, Omit<PortraitCut, "name" | "profilePath" | "posters"> | null> };
    for (const { id, person } of pending) {
      const result = results[id];
      if (!result) {
        console.log(`${id} ${person.name}: no person found in the photo`);
        continue;
      }
      existing[id] = { name: person.name, profilePath: person.profile_path!, ...result, posters: topPosters(person, 9) };
      console.log(`${id} ${person.name}: cut with ${result.model} (mask covers ${Math.round(result.coverage * 100)}% of the frame)`);
    }
  }

  // A fallback cut is kept as is but flagged; this also backfills the flag on entries cut before it existed (model is stored).
  for (const cut of Object.values(existing)) {
    if (cut.model === "birefnet-portrait") {
      delete cut.flagged;
      delete cut.flagReason;
    } else {
      cut.flagged = true;
      cut.flagReason = `birefnet-portrait mask under 5%; kept the ${cut.model} fallback`;
    }
  }

  // Keep the file in PORTRAIT_IDS order so diffs stay readable.
  const ordered: PortraitCuts = {};
  for (const id of PORTRAIT_IDS) if (existing[id]) ordered[id] = existing[id];
  writeFileSync(outFile, `${JSON.stringify(ordered)}\n`);
  console.log(`${Object.keys(ordered).length} entries in ${outFile}; ${pending.length} recomputed`);
  const flagged = Object.entries(ordered).filter(([, cut]) => cut.flagged);
  console.log(`${flagged.length} flagged${flagged.length ? ":" : ""}`);
  for (const [id, cut] of flagged) console.log(`  ${id} ${cut.name}: ${cut.flagReason}`);
}

await main();
