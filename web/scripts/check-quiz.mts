// CM-09: the live match count. For several sets of quiz answers, compares the
// database's count (quiz_movies) with a count done here in plain code over the
// whole catalog, so a filter that drifts from the quiz's rules shows up as a
// mismatch. Also checks it's quick and closed to logged-out visitors.
// Run from web/: node --env-file=.env.local scripts/check-quiz.mts
import { createClient } from "@supabase/supabase-js";

type F = { genres?: string[]; maxRuntime?: number; mood?: string; ratings?: string[]; minScore?: number; minYear?: number; maxYear?: number; attention?: string; services?: string[] };
type M = { id: string; genres: string[]; moods: string[]; attention: string; year: number; runtime: number; rating: string; score: number | null; movie_availability: { service: string; type: string }[] };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const anon = createClient(url, key, { auth: { persistSession: false } });
const { error: anonError } = await anon.rpc("quiz_movies", { f: {} }).select("id").range(0, 0);
console.log(anonError ? "PASS  logged out: quiz filter refused" : "FAIL  logged out: quiz filter answered");

const db = createClient(url, key, { auth: { persistSession: false } });
const { error: loginError } = await db.auth.signInWithPassword({ email: process.env.TEST_A_EMAIL!, password: process.env.TEST_A_PASSWORD! });
if (loginError) throw new Error(`Couldn't log in as test account A: ${loginError.message}`);

const all: M[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("movies").select("id, genres, moods, attention, year, runtime, rating, score, movie_availability (service, type)").range(from, from + 999);
  if (error) throw error;
  all.push(...(data as M[]));
  if (data.length < 1000) break;
}

// The quiz's rules, written out independently of the SQL.
const fits = (m: M, f: F) =>
  (!f.genres || m.genres.some((g) => f.genres!.includes(g))) &&
  (f.maxRuntime === undefined || m.runtime < f.maxRuntime) &&
  (!f.mood || m.moods.includes(f.mood)) &&
  (!f.ratings || f.ratings.includes(m.rating)) &&
  (f.minScore === undefined || (m.score !== null && Number(m.score) >= f.minScore)) &&
  (f.minYear === undefined || m.year >= f.minYear) &&
  (f.maxYear === undefined || m.year <= f.maxYear) &&
  (!f.attention || m.attention === f.attention) &&
  (!f.services || m.movie_availability.some((a) => a.type !== "rent" && f.services!.includes(a.service)));

const year = new Date().getFullYear();
const cases: [string, F][] = [
  ["no answers yet", {}],
  ["scenario 1: Comedy and Adventure, under 2 hours", { genres: ["Comedy", "Adventure"], maxRuntime: 120 }],
  ["  ...plus easy to follow, on Netflix or HBO Max", { genres: ["Comedy", "Adventure"], maxRuntime: 120, attention: "easy", services: ["netflix", "hbo"] }],
  ["Horror, R only, 3.5+ stars", { genres: ["Horror"], ratings: ["R"], minScore: 3.5 }],
  [`Suspenseful, recent (${year - 2}+)`, { mood: "Suspenseful", minYear: year - 2 }],
  [`Older (before ${year - 10}), PG or G, under 90 minutes`, { maxYear: year - 11, ratings: ["G", "PG"], maxRuntime: 90 }],
  ["Documentary, background, Tubi only", { genres: ["Documentary"], attention: "background", services: ["tubi"] }],
  ["impossible: Animation, R, under 90, 4+ stars, Tubi", { genres: ["Animation"], ratings: ["R"], maxRuntime: 90, minScore: 4, services: ["tubi"] }],
];

let failures = 0;
for (const [label, f] of cases) {
  const start = performance.now();
  const { count, error } = await db.rpc("quiz_movies", { f }, { count: "exact" }).select("id").range(0, 0);
  const ms = Math.round(performance.now() - start);
  if (error) throw new Error(`${label}: ${error.message}`);
  const expected = all.filter((m) => fits(m, f)).length;
  const ok = count === expected && ms <= 1000;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: database ${count}, expected ${expected}  [${ms} ms]`);
}
console.log(failures ? `\n${failures} failed` : `\nAll passed (${all.length} movies checked)`);
