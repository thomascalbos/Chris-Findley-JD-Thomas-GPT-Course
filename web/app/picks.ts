// CM-10: what picking needs from Supabase, read and written from the browser.
//   loadPool       movies that meet the Must haves (quiz_movies, CM-09), in the shape the engine uses
//   loadWatched    movies the viewer marked watched (watched, migration 0009)
//   loadNeighbors  a movie's similar movies, most similar first (movie_neighbors, CM-14)
//   saveWatched    Already watched / Seen it
//   logPick        one row per pick shown and per answer to it, with the session's seed (pick_events)

import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { QuizFilter } from "./quiz-filter";
import type { Availability, Movie } from "./movies";
import type { Jump, Neighbor } from "./walk";

// Enough to choose from without loading the whole catalog into the browser:
// the most popular movies that meet the Must haves come first.
export const POOL_LIMIT = 5000;
const PAGE = 1000; // Supabase returns at most 1,000 rows per request

const COLUMNS = "id, title, year, runtime, rating, score, genres, moods, attention, intensity, synopsis, poster, checked_at, popularity, movie_availability (service, type)"; // popularity must be selected to sort by it

type Row = {
  id: string; title: string; year: number; runtime: number; rating: Movie["rating"]; score: number | string | null;
  genres: Movie["genres"]; moods: Movie["moods"]; attention: Movie["attention"]; intensity: Movie["intensity"];
  synopsis: string; poster: string | null; checked_at: string; movie_availability: Availability[];
};

const toMovie = (r: Row): Movie => ({
  id: r.id, title: r.title, year: r.year, runtime: r.runtime, rating: r.rating,
  score: r.score === null ? null : Number(r.score),
  genres: r.genres, moods: r.moods, attention: r.attention, intensity: r.intensity,
  synopsis: r.synopsis, poster: r.poster, checkedAt: r.checked_at, availability: r.movie_availability,
});

// The first page also says how many movies match; the rest load in parallel.
export async function loadPool(mustHaves: QuizFilter): Promise<Movie[]> {
  const db = getSupabaseBrowser();
  const page = (from: number, count = false) =>
    db.rpc("quiz_movies", { f: mustHaves }, count ? { count: "exact" } : {}).select(COLUMNS)
      .order("popularity", { ascending: false, nullsFirst: false }).order("id").range(from, from + PAGE - 1);
  const first = await page(0, true);
  if (first.error) throw first.error;
  const total = Math.min(first.count ?? 0, POOL_LIMIT);
  const rest = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(total / PAGE) - 1) }, (_, i) => page((i + 1) * PAGE)));
  const failed = rest.find((r) => r.error);
  if (failed?.error) throw failed.error;
  return [first, ...rest].flatMap((r) => (r.data as unknown as Row[]).map(toMovie));
}

export async function loadWatched(): Promise<string[]> {
  const { data, error } = await getSupabaseBrowser().from("watched").select("movie_id");
  if (error) throw error;
  return data.map((r) => r.movie_id);
}

export async function loadNeighbors(movieId: string): Promise<Neighbor[]> {
  const { data, error } = await getSupabaseBrowser().from("movie_neighbors").select("neighbor_id, rank, score").eq("movie_id", movieId).order("rank");
  if (error) throw error;
  return data.map((r) => ({ id: r.neighbor_id, rank: r.rank, score: r.score }));
}

export async function saveWatched(movieId: string, liked: boolean | null) {
  const { error } = await getSupabaseBrowser().from("watched").upsert({ movie_id: movieId, liked, source: "pick", watched_at: new Date().toISOString() }, { onConflict: "user_id,movie_id" });
  if (error) throw error;
}

export type PickEvent = {
  sessionId: string; seed: number; step: number; movieId: string;
  action: "shown" | "not_this_one" | "already_watched" | "watch"; detail?: string; jump?: Jump;
};

// Logging never gets in the viewer's way: a failure is reported in the console only.
export async function logPick(e: PickEvent) {
  const { error } = await getSupabaseBrowser().from("pick_events").insert({
    session_id: e.sessionId, seed: e.seed, step: e.step, movie_id: e.movieId, action: e.action, detail: e.detail ?? null, jump: e.jump ?? null,
  });
  if (error) console.warn("Couldn't record pick event", error.message);
}
