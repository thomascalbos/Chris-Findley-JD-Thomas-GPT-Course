// CM-06 scenarios 1 and 3: title search finds movies within a second, tolerates
// a one-letter typo, says nothing matches for nonsense, and is closed to
// logged-out visitors. Logs in as test account A with the public key.
// Run from web/: node --env-file=.env.local scripts/check-search.mts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const anon = createClient(url, key, { auth: { persistSession: false } });
const { error: anonError } = await anon.rpc("search_movies", { q: "matrix" });
console.log(anonError ? "PASS  logged out: search refused" : "FAIL  logged out: search answered");

const client = createClient(url, key, { auth: { persistSession: false } });
const { error: loginError } = await client.auth.signInWithPassword({ email: process.env.TEST_A_EMAIL!, password: process.env.TEST_A_PASSWORD! });
if (loginError) throw new Error(`Couldn't log in as test account A: ${loginError.message}`);

// The session's first search is slower while the connection warms up, so it's
// timed and reported on its own rather than counted against the one-second goal.
const warm = performance.now();
await client.rpc("search_movies", { q: "warm up" });
console.log(`INFO  first search of the session: ${Math.round(performance.now() - warm)} ms`);

// [search, expected title, where it must appear]. Null means nothing should match.
const cases: [string, string | null, "top 3" | "results"][] = [
  ["matrix", "The Matrix", "top 3"],
  ["toy sto", "Toy Story", "top 3"],
  ["Matrx", "The Matrix", "top 3"],           // missing letter
  ["dark knigt", "The Dark Knight", "top 3"], // missing letter
  ["Titanc", "Titanic", "top 3"],             // missing letter
  ["Barbi", "Barbie", "top 3"],               // missing letter
  ["Inceptoin", "Inception", "top 3"],        // swapped letters
  ["Barbei", "Barbie", "results"],            // swapped letters, and one letter from "Barber", so Barber can rank first
  ["xqzvwplk", null, "results"],
  ["%%", null, "results"],                    // % must match literally, not as a wildcard
];

let failures = 0;
for (const [q, expected, where] of cases) {
  const start = performance.now();
  const { data, error } = await client.rpc("search_movies", { q, max_results: 20 });
  const ms = Math.round(performance.now() - start);
  if (error) throw new Error(`"${q}": ${error.message}`);
  const all = data as { title: string; year: number }[];
  const top = all.slice(0, 3);
  const ok = expected === null ? all.length === 0 : (where === "top 3" ? top : all).some((m) => m.title === expected);
  if (!ok || ms > 1000) failures++;
  const shown = top.map((m) => `${m.title} (${m.year})`).join(", ") || "No movies match";
  console.log(`${ok && ms <= 1000 ? "PASS" : "FAIL"}  "${q}" -> ${shown}  [${ms} ms, ${data.length} results]`);
}
console.log(failures ? `\n${failures} failed` : "\nAll passed");
