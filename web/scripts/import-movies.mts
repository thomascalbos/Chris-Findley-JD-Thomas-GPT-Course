// CM-02: imports the catalog from TMDB into Supabase.
// Catalog: feature films (40+ minutes) with at least 200 TMDB votes and a US rating of G, PG, PG-13, or R.
//
// Run from web/:  node --env-file=.env.local scripts/import-movies.mts [options]
//   --limit N        import at most N new movies (a quick test run; keeps the sample movies)
//   --fail-after N   stop with an error after N movies, to test resuming (scenario 4)
//   --rediscover     ask TMDB for the list of movies again instead of using data/tmdb-ids.json
//   --retag          recompute tags for movies already imported, without calling TMDB
//
// Safe to rerun: movies already in the database are skipped, and every write is an
// upsert keyed on the movie id, so a run that stopped halfway picks up where it left
// off without duplicates. Needs TMDB_READ_TOKEN and SUPABASE_SECRET_KEY in .env.local.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { tagMovie } from "./tagging.mts";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const num = (name: string) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : undefined);
const limit = num("--limit");
const failAfter = num("--fail-after");

const { TMDB_READ_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!TMDB_READ_TOKEN || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing TMDB_READ_TOKEN, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
// The secret key bypasses row-level security. It's used only here, on a team computer.
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const DATA_DIR = new URL("../data/", import.meta.url);
mkdirSync(DATA_DIR, { recursive: true });
const IDS_FILE = new URL("tmdb-ids.json", DATA_DIR);
const SKIPPED_FILE = new URL("tmdb-skipped.json", DATA_DIR);
const readJson = <T,>(file: URL, fallback: T): T => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback);

const RATINGS = ["G", "PG", "PG-13", "R"];
const MIN_VOTES = 200;
const MIN_RUNTIME = 40; // shorter than this is a short film, not a feature
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// TMDB ---------------------------------------------------------------------

async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TMDB_READ_TOKEN}`, accept: "application/json" } });
    if (res.ok) return (await res.json()) as T;
    // Back off on rate limits and server errors; give up after 5 tries.
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 1000 * 2 ** attempt;
      await sleep(wait);
      continue;
    }
    throw new Error(`TMDB ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
  }
}

// TMDB's discover list stops at 500 pages, so ask one release year at a time.
async function discoverIds(): Promise<number[]> {
  const ids = new Set<number>();
  for (let year = 1900; year <= new Date().getFullYear(); year++) {
    for (let page = 1; ; page++) {
      const res = await tmdb<{ results: { id: number }[]; total_pages: number }>("/discover/movie", {
        primary_release_year: year, "vote_count.gte": MIN_VOTES, include_adult: "false", include_video: "false",
        sort_by: "vote_count.desc", page,
      });
      res.results.forEach((m) => ids.add(m.id));
      if (page >= res.total_pages) break;
    }
    process.stdout.write(`\rFinding movies: ${year} (${ids.size} so far)`);
  }
  console.log();
  return [...ids];
}

// Watch providers ------------------------------------------------------------
// TMDB's streaming data comes from JustWatch. Only CineMatch's eight services
// count; channel versions (e.g. "Paramount Plus Apple TV Channel") count as the service.

type Provider = { provider_name: string };
type Availability = { service: string; type: "subscription" | "free" | "rent" };

const SUBSCRIPTION_SERVICES: [RegExp, string][] = [
  [/^Netflix/i, "netflix"],
  [/^Amazon Prime Video/i, "prime"],
  [/^Paramount(\+| Plus)/i, "paramount"],
  [/^Disney(\+| Plus)/i, "disney"],
  [/^Hulu/i, "hulu"],
  [/^Apple TV(\+| Plus)/i, "apple"],
  [/^(HBO )?Max\b/i, "hbo"],
];
const RENT_SERVICES: [RegExp, string][] = [
  [/^Amazon Video$/i, "prime"],
  [/^Apple TV( Store)?$/i, "apple"],
];

function availability(us?: { flatrate?: Provider[]; free?: Provider[]; ads?: Provider[]; rent?: Provider[] }): Availability[] {
  if (!us) return [];
  const out = new Map<string, Availability>();
  const add = (service: string, type: Availability["type"]) => out.set(`${service}:${type}`, { service, type });
  for (const p of us.flatrate ?? []) {
    const match = SUBSCRIPTION_SERVICES.find(([re]) => re.test(p.provider_name));
    if (match) add(match[1], "subscription");
  }
  for (const p of [...(us.free ?? []), ...(us.ads ?? [])]) {
    if (/^Tubi/i.test(p.provider_name)) add("tubi", "free");
  }
  for (const p of us.rent ?? []) {
    const match = RENT_SERVICES.find(([re]) => re.test(p.provider_name));
    if (match) add(match[1], "rent");
  }
  return [...out.values()];
}

// One movie ------------------------------------------------------------------

type Details = {
  id: number; title: string; release_date: string; runtime: number | null; overview: string;
  poster_path: string | null; vote_average: number; vote_count: number; popularity: number;
  genres: { name: string }[];
  keywords: { keywords: { name: string }[] };
  release_dates: { results: { iso_3166_1: string; release_dates: { certification: string; type: number }[] }[] };
  "watch/providers": { results: Record<string, Parameters<typeof availability>[0]> };
};

function usRating(d: Details): string | undefined {
  const us = d.release_dates.results.find((r) => r.iso_3166_1 === "US")?.release_dates ?? [];
  // Prefer the theatrical (type 3) certification, then any other US one.
  const sorted = [...us].sort((a, b) => Number(b.type === 3) - Number(a.type === 3));
  return sorted.map((r) => r.certification.trim()).find(Boolean);
}

async function fetchMovie(tmdbId: number) {
  const d = await tmdb<Details>(`/movie/${tmdbId}`, { append_to_response: "release_dates,keywords,watch/providers" });
  const rating = usRating(d);
  if (!rating || !RATINGS.includes(rating)) return { skip: `US rating ${rating ?? "missing"}` };
  if (!d.runtime || !d.release_date) return { skip: "missing runtime or release date" };
  if (d.runtime < MIN_RUNTIME) return { skip: "short film" };
  if (d.vote_count < MIN_VOTES) return { skip: "fewer than 200 votes" };

  const tmdbGenres = d.genres.map((g) => g.name);
  const keywords = d.keywords.keywords.map((k) => k.name);
  const id = `tmdb-${d.id}`;
  return {
    movie: {
      id, tmdb_id: d.id, title: d.title, year: Number(d.release_date.slice(0, 4)), release_date: d.release_date,
      runtime: d.runtime, rating, score: Math.round(d.vote_average * 5) / 10, vote_count: d.vote_count,
      popularity: d.popularity, synopsis: d.overview ?? "",
      poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
      tmdb_genres: tmdbGenres, keywords, is_sample: false, checked_at: new Date().toISOString(),
      ...tagMovie({ tmdbGenres, keywords, runtime: d.runtime, rating }),
    },
    availability: availability(d["watch/providers"].results.US).map((a) => ({ movie_id: id, ...a })),
  };
}

// Database helpers -----------------------------------------------------------

async function selectAll<T>(columns: string, where: { real?: boolean } = {}): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from("movies").select(columns).order("id").range(from, from + 999);
    if (where.real) q = q.eq("is_sample", false); // imported movies only
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...(data as T[]));
    if (data.length < 1000) return rows;
  }
}

async function save(movies: object[], avail: object[]) {
  if (movies.length) {
    const { error } = await db.from("movies").upsert(movies, { onConflict: "id" });
    if (error) throw new Error(`Saving movies: ${error.message}`);
  }
  if (avail.length) {
    const { error } = await db.from("movie_availability").upsert(avail, { ignoreDuplicates: true });
    if (error) throw new Error(`Saving availability: ${error.message}`);
  }
}

// Retag only -----------------------------------------------------------------

if (flag("--retag")) {
  type Row = { tmdb_genres: string[]; keywords: string[]; runtime: number; rating: string };
  const rows = await selectAll<Row>("*", { real: true });
  const updated = rows.map((m) => ({ ...m, ...tagMovie({ tmdbGenres: m.tmdb_genres, keywords: m.keywords, runtime: m.runtime, rating: m.rating }) }));
  for (let i = 0; i < updated.length; i += 500) await save(updated.slice(i, i + 500), []);
  console.log(`Retagged ${updated.length} movies.`);
  process.exit(0);
}

// Import ---------------------------------------------------------------------

const allIds = !flag("--rediscover") && existsSync(IDS_FILE) ? readJson<number[]>(IDS_FILE, []) : await discoverIds();
writeFileSync(IDS_FILE, JSON.stringify(allIds));

const imported = new Set((await selectAll<{ tmdb_id: number }>("tmdb_id", { real: true })).map((m) => m.tmdb_id));
const skipped: Record<string, string> = readJson(SKIPPED_FILE, {});
// Newest first: if a run stops early, the movies people most likely want are already in.
const todo = allIds.filter((id) => !imported.has(id) && !skipped[id]).reverse().slice(0, limit);
console.log(`${allIds.length} candidates: ${imported.size} already imported, ${Object.keys(skipped).length} skipped earlier, ${todo.length} to go.`);

let done = 0;
let added = 0;
const failed: number[] = [];
let movieBuf: object[] = [];
let availBuf: object[] = [];

async function flush() {
  // Swap the buffers before saving, so movies other workers finish meanwhile aren't lost.
  const [movies, avail] = [movieBuf, availBuf];
  movieBuf = [];
  availBuf = [];
  await save(movies, avail);
  writeFileSync(SKIPPED_FILE, JSON.stringify(skipped));
}

// Eight requests at a time keeps well under TMDB's rate limit.
const queue = [...todo];
async function worker() {
  while (queue.length) {
    const tmdbId = queue.shift()!;
    if (failAfter !== undefined && done >= failAfter) throw new Error(`Stopped on purpose after ${failAfter} movies (--fail-after)`);
    try {
      const result = await fetchMovie(tmdbId);
      if ("skip" in result) skipped[tmdbId] = result.skip!;
      else {
        movieBuf.push(result.movie);
        availBuf.push(...result.availability);
        added++;
      }
    } catch (e) {
      failed.push(tmdbId);
      console.error(`\n${(e as Error).message}`);
    }
    done++;
    if (movieBuf.length >= 50) await flush();
    process.stdout.write(`\rImporting: ${done}/${todo.length} (${added} added, ${failed.length} failed)`);
  }
}

try {
  await Promise.all(Array.from({ length: 8 }, worker));
} finally {
  await flush(); // save whatever finished, even if the run stopped early
  console.log();
}

if (failed.length) {
  console.error(`${failed.length} movies failed. Run the import again to retry them.`);
  process.exit(1);
}

// Once the full catalog is in, the demo's sample movies go.
if (limit === undefined) {
  const { error, count } = await db.from("movies").delete({ count: "exact" }).eq("is_sample", true);
  if (error) throw new Error(`Removing sample movies: ${error.message}`);
  if (count) console.log(`Removed ${count} sample movies.`);
}
console.log(`Done: ${added} movies added this run.`);
