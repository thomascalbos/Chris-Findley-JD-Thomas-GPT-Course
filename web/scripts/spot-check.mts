// CM-02 scenario 2: picks 50 random movies and writes web/data/spot-check.csv for a
// teammate to judge. Open it in Excel or Google Sheets, and in the "Sensible?" column
// mark each row Y or N. At least 40 Y passes; otherwise adjust scripts/tagging.mts,
// rerun the import with --retag, and check a fresh sample.
// Run from web/:  node --env-file=.env.local scripts/spot-check.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);

const { count } = await db.from("movies").select("id", { count: "exact", head: true }).eq("is_sample", false);
if (!count) throw new Error("No imported movies yet. Run scripts/import-movies.mts first.");

const offsets = new Set<number>();
while (offsets.size < Math.min(50, count)) offsets.add(Math.floor(Math.random() * count));

const rows: string[][] = [];
for (const offset of offsets) {
  const { data, error } = await db.from("movies").select("title, year, rating, runtime, tmdb_genres, moods, attention, intensity")
    .eq("is_sample", false).order("id").range(offset, offset).single();
  if (error) throw new Error(error.message);
  rows.push([data.title, data.year, data.rating, data.runtime, data.tmdb_genres.join(", "), data.moods.join(", "),
    data.attention, ["", "1 (gentle)", "2 (some tension)", "3 (intense)"][data.intensity], ""]);
}

const csv = (cell: unknown) => `"${String(cell).replaceAll('"', '""')}"`;
const header = ["Title", "Year", "Rating", "Minutes", "TMDB genres", "Mood", "Attention", "Intensity", "Sensible? (Y/N)"];
const dir = new URL("../data/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("spot-check.csv", dir), [header, ...rows].map((r) => r.map(csv).join(",")).join("\n"));
console.log(`Wrote ${rows.length} random movies to web/data/spot-check.csv`);
