// CM-11: Random pick from the real catalog.
//   rankRandom  orders the candidates (pure, unit tested)
//   pickRandom  picks one of the top few at random, so Another random pick varies
//   loadRandom  loads what ranking needs from Supabase, via picks.ts

import type { Movie, ServiceId } from "./movies";
import { loadNeighbors, loadPool, loadWatched } from "./picks";
import type { Ranked, Rng } from "./walk";

export const RANDOM_TOP = 10;
export const SIMILARITY_WEIGHT = 3; // a close neighbor of a favorite beats a slightly higher audience score
export const REACH_WEIGHT = 0.5; // per service that includes it, for viewers who skipped setup
export const SETUP_SKIPPED_MIN_SCORE = 3.5;

export type RandomOptions = {
  watched: string[];
  includeRewatches: boolean;
  exclude: string[]; // the pick on screen, so Another random pick never repeats it
  favorites: string[];
  similar: Map<string, number>; // movie id -> best similarity to any favorite
  personal: boolean; // services or favorites saved
};

// Services that include the movie with a subscription or for free (rentals don't count).
const reach = (m: Movie) => new Set(m.availability.filter((a) => a.type !== "rent").map((a) => a.service)).size;

export function rankRandom(pool: Movie[], o: RandomOptions): Ranked[] {
  const skip = new Set([...o.exclude, ...o.favorites, ...(o.includeRewatches ? [] : o.watched)]);
  return pool
    .filter((m) => !skip.has(m.id))
    .map((m) => ({
      movie: m,
      fit: (m.score ?? 0) + (o.personal ? SIMILARITY_WEIGHT * (o.similar.get(m.id) ?? 0) : REACH_WEIGHT * reach(m)),
    }))
    .sort((a, b) => b.fit - a.fit);
}

export function pickRandom(ranked: Ranked[], rng: Rng = Math.random, top = RANDOM_TOP): Movie | null {
  const n = Math.min(top, ranked.length);
  return n ? ranked[Math.floor(rng() * n)].movie : null;
}

export type RandomData = { pool: Movie[]; watched: string[]; similar: Map<string, number> };

// With services saved, only movies on them; with setup skipped, well-rated movies anywhere.
export async function loadRandom(services: ServiceId[], favorites: string[]): Promise<RandomData> {
  const [pool, watched, neighbors] = await Promise.all([
    loadPool(services.length ? { services } : { minScore: SETUP_SKIPPED_MIN_SCORE }),
    loadWatched(),
    Promise.all(favorites.map((id) => loadNeighbors(id).catch(() => []))), // similarity is a bonus, not required
  ]);
  const similar = new Map<string, number>();
  for (const list of neighbors) for (const n of list) similar.set(n.id, Math.max(similar.get(n.id) ?? 0, n.score));
  return { pool, watched, similar };
}
