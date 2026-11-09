// The real movie catalog in Supabase (CM-02), read from the browser. The quiz
// still runs on the sample movies in movies.ts until CM-09 and CM-10.

import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Availability, Rating } from "./movies";

export type SearchHit = { id: string; title: string; year: number; rating: Rating; poster: string | null };

export type CatalogMovie = SearchHit & {
  runtime: number;
  score: number | null; // out of 5; null means "Not enough ratings yet"
  genres: string[];
  synopsis: string;
  checkedAt: string; // when availability was last checked
  availability: Availability[];
};

// Best match first, typo-tolerant (search_movies in supabase/migrations/0004).
export async function searchMovies(q: string): Promise<SearchHit[]> {
  const { data, error } = await getSupabaseBrowser().rpc("search_movies", { q, max_results: 20 });
  if (error) throw error;
  return data as SearchHit[];
}

export async function getMovie(id: string): Promise<CatalogMovie> {
  const { data, error } = await getSupabaseBrowser()
    .from("movies")
    .select("id, title, year, rating, poster, runtime, score, genres, synopsis, checked_at, movie_availability (service, type)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    year: data.year,
    rating: data.rating,
    poster: data.poster,
    runtime: data.runtime,
    score: data.score === null ? null : Number(data.score),
    genres: data.genres,
    synopsis: data.synopsis,
    checkedAt: data.checked_at,
    availability: data.movie_availability as Availability[],
  };
}

// TMDB serves each poster in fixed widths; the import saved the w500 one.
export const posterAt = (url: string, width: "w92" | "w342" | "w500") => url.replace("/w500/", `/${width}/`);
