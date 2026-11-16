// CM-04: the weekly refresh of streaming availability.
// Runs every Monday from .github/workflows/weekly-refresh.yml, or by hand.
//
// For every imported movie, asks TMDB for its current US streaming services,
// then updates movie_availability to match, records each service gained or
// lost in availability_changes, and sets movies.checked_at to now.
//
// Run from web/:  node --env-file=.env.local scripts/refresh-availability.mts [options]
//   --dry-run   ask TMDB and report what would change, but write nothing
//   --limit N   check only the first N movies (a quick test run)
//
// Safe to rerun: each movie is compared with what's in the database right now,
// so a second run only applies what the first one missed. A movie TMDB couldn't
// answer for keeps its old availability and checked_at, and the run exits with
// an error so GitHub Actions marks it failed and emails the team.
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { availability, tmdb, TmdbError, type UsProviders } from "./tmdb.mts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : undefined;

const { TMDB_READ_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!TMDB_READ_TOKEN || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing TMDB_READ_TOKEN, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SECRET_KEY");
  process.exit(1);
}
// The secret key bypasses row-level security. It lives only in .env.local and
// the repo's GitHub Actions secrets.
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

type Row = { movie_id: string; service: string; type: string };
const rowKey = (r: { service: string; type: string }) => `${r.service}:${r.type}`;

// What the database says now ---------------------------------------------------

async function selectAll<T>(table: "movies" | "movie_availability", columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(columns).order(table === "movies" ? "id" : "movie_id").range(from, from + 999);
    if (table === "movies") q = q.eq("is_sample", false); // imported movies only
    const { data, error } = await q;
    if (error) throw new Error(`Reading ${table}: ${error.message}`);
    rows.push(...(data as T[]));
    if (data.length < 1000) return rows;
  }
}

const movies = (await selectAll<{ id: string; tmdb_id: number }>("movies", "id, tmdb_id")).slice(0, limit);
const current = new Map<string, Row[]>();
for (const r of await selectAll<Row>("movie_availability", "movie_id, service, type")) {
  if (!current.has(r.movie_id)) current.set(r.movie_id, []);
  current.get(r.movie_id)!.push(r);
}
console.log(`${dryRun ? "Dry run: " : ""}checking ${movies.length} movies against TMDB.`);

// Saving -------------------------------------------------------------------------

type Result = { id: string; added: Row[]; removed: Row[] };
let pending: Result[] = [];
const totals = { checked: 0, added: 0, removed: 0, notFound: 0 };
const failed: string[] = [];
const examples: string[] = [];

async function save(batch: Result[]) {
  if (dryRun || !batch.length) return;
  const now = new Date().toISOString();
  const added = batch.flatMap((r) => r.added);
  const removed = batch.flatMap((r) => r.removed);
  if (added.length) {
    const { error } = await db.from("movie_availability").upsert(added, { ignoreDuplicates: true });
    if (error) throw new Error(`Adding availability: ${error.message}`);
  }
  for (const r of removed) {
    const { error } = await db.from("movie_availability").delete().match(r);
    if (error) throw new Error(`Removing availability: ${error.message}`);
  }
  const changes = [
    ...added.map((r) => ({ ...r, change: "added", changed_at: now })),
    ...removed.map((r) => ({ ...r, change: "removed", changed_at: now })),
  ];
  if (changes.length) {
    const { error } = await db.from("availability_changes").insert(changes);
    if (error) throw new Error(`Recording changes: ${error.message}`);
  }
  // Only movies TMDB answered for get a new checked_at.
  const { error } = await db.from("movies").update({ checked_at: now }).in("id", batch.map((r) => r.id));
  if (error) throw new Error(`Stamping checked_at: ${error.message}`);
}

async function flush() {
  const batch = pending;
  pending = [];
  await save(batch);
}

// Checking each movie --------------------------------------------------------------

// Eight requests at a time keeps well under TMDB's rate limit, the same as the import.
const queue = [...movies];
let done = 0;
async function worker() {
  while (queue.length) {
    const m = queue.shift()!;
    try {
      const res = await tmdb<{ results: Record<string, UsProviders> }>(`/movie/${m.tmdb_id}/watch/providers`);
      const fresh = availability(res.results.US).map((a) => ({ movie_id: m.id, ...a }));
      const before = current.get(m.id) ?? [];
      const beforeKeys = new Set(before.map(rowKey));
      const freshKeys = new Set(fresh.map(rowKey));
      const added = fresh.filter((r) => !beforeKeys.has(rowKey(r)));
      const removed = before.filter((r) => !freshKeys.has(rowKey(r))).map(({ movie_id, service, type }) => ({ movie_id, service, type }));
      totals.checked++;
      totals.added += added.length;
      totals.removed += removed.length;
      if ((added.length || removed.length) && examples.length < 10) {
        examples.push(`${m.id}: ${[...added.map((r) => `+${rowKey(r)}`), ...removed.map((r) => `-${rowKey(r)}`)].join(" ")}`);
      }
      pending.push({ id: m.id, added, removed });
    } catch (e) {
      if (e instanceof TmdbError && e.status === 404) totals.notFound++; // TMDB removed the movie; leave it as it is
      else {
        failed.push(m.id);
        console.error(`\n${m.id}: ${(e as Error).message}`);
      }
    }
    done++;
    if (pending.length >= 50) await flush();
    if (done % 100 === 0 || done === movies.length) process.stdout.write(`\rChecked ${done}/${movies.length}`);
  }
}

try {
  await Promise.all(Array.from({ length: 8 }, worker));
} finally {
  await flush(); // save whatever finished, even if the run stopped early
  console.log();
}

// Report --------------------------------------------------------------------------

const lines = [
  `${dryRun ? "Dry run (nothing saved). " : ""}Checked ${totals.checked} of ${movies.length} movies.`,
  `Services added: ${totals.added}. Services removed: ${totals.removed}.`,
  ...(totals.notFound ? [`${totals.notFound} movies no longer exist on TMDB and were left as they were.`] : []),
  ...(failed.length ? [`${failed.length} movies failed and keep their old availability. Rerun the refresh to retry them.`] : []),
  ...(examples.length ? ["", "Examples:", ...examples.map((e) => `- ${e}`)] : []),
];
console.log(lines.join("\n"));
// On GitHub Actions, also show the summary on the run's page.
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Weekly availability refresh\n\n${lines.join("\n")}\n`);

if (failed.length) process.exit(1);
