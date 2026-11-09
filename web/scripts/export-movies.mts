// CM-02: saves the team's local copy of the catalog to web/data/movies.json
// (not committed; run this any time to refresh it). Uses only the public key,
// since the catalog is public.
// Run from web/:  node --env-file=.env.local scripts/export-movies.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);

const movies: Record<string, unknown>[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("movies").select("*, movie_availability(service, type)").order("id").range(from, from + 999);
  if (error) throw new Error(error.message);
  movies.push(...data);
  if (data.length < 1000) break;
}

const dir = new URL("../data/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("movies.json", dir), JSON.stringify({ exportedAt: new Date().toISOString(), count: movies.length, movies }, null, 1));
console.log(`Saved ${movies.length} movies to web/data/movies.json`);
