// Turns quiz answers into a filter on the real catalog (quiz_movies in
// supabase/migrations/0006). Mirrors criteria() in engine.ts: only questions
// that were asked and answered with something specific filter anything.
// CM-09 counts the matches; CM-10 ranks them for the pick.

import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { eraRange, isOpen, type Answers, type QuestionKey } from "./engine";
import type { ServiceId } from "./movies";

export type QuizFilter = {
  genres?: string[];
  maxRuntime?: number;
  mood?: string;
  ratings?: string[];
  minScore?: number;
  minYear?: number;
  maxYear?: number;
  attention?: string;
  services?: ServiceId[];
};

export function quizFilter(answers: Answers, asked: QuestionKey[], services: ServiceId[]): QuizFilter {
  const val = (k: QuestionKey) => (asked.includes(k) && !isOpen(answers[k]) ? answers[k]! : null);
  const f: QuizFilter = {};
  const genres = val("genres");
  if (genres) f.genres = genres;
  const time = val("time");
  if (time) f.maxRuntime = Number(time[0]);
  const mood = val("mood");
  if (mood) f.mood = mood[0];
  const ratings = val("ratings");
  if (ratings) f.ratings = ratings;
  const minScore = val("minScore");
  if (minScore) f.minScore = Number(minScore[0]);
  const era = val("era");
  if (era) Object.assign(f, eraRange(era[0]));
  const attention = val("attention");
  if (attention) f.attention = attention[0];
  if (services.length) f.services = services;
  return f;
}

// How many real movies fit, without fetching them.
export async function countMatches(f: QuizFilter): Promise<number> {
  const { count, error } = await getSupabaseBrowser()
    .rpc("quiz_movies", { f }, { count: "exact" })
    .select("id")
    .range(0, 0);
  if (error) throw error;
  return count ?? 0;
}
