// CM-10: choosing picks on the real catalog (see "Design notes for picking" in the PRD).
//
// 1. Land: the quiz's rules score every movie that meets the Must haves; the first
//    pick is drawn at random from the best-fitting few, closer fits more likely.
// 2. Jump: after feedback, the next pick is drawn from the current pick's similar
//    movies (CM-14's movie_neighbors). The feedback picks how far to jump (close,
//    medium, or far along the list) and filters out what the viewer turned down.
//    The distance is random within limits, so the same answers can lead to
//    different movies.
//
// Everything random comes from one seeded generator per session, so a session can
// be replayed exactly from its seed (CM-16).

import type { Movie } from "./movies";

export type Rng = () => number;

// mulberry32: small, fast, and good enough for picking movies.
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}
export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export type Ranked = { movie: Movie; fit: number };

// Draws one item, more likely the higher its weight.
function draw<T>(items: T[], weight: (t: T) => number, rng: Rng): T | null {
  if (!items.length) return null;
  const ws = items.map((t) => Math.max(0, weight(t)));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) if ((r -= ws[i]) <= 0) return items[i];
  return items[items.length - 1];
}

// How strongly a better fit is preferred: a movie 2 fit points behind the best
// is about a third as likely. Lower means the top fit wins more often.
const TEMPERATURE = 2;
export const LANDING_ZONE = 12;

// The first pick: one of the best-fitting movies, at random.
export function land(ranked: Ranked[], rng: Rng): Ranked | null {
  const zone = [...ranked].sort((a, b) => b.fit - a.fit).slice(0, LANDING_ZONE);
  if (!zone.length) return null;
  const best = zone[0].fit;
  return draw(zone, (r) => Math.exp((r.fit - best) / TEMPERATURE), rng);
}

// Feedback ----------------------------------------------------------------------------------

export type RejectReason = "seen" | "mood" | "genre" | "intense" | "other";
export type Feedback =
  | { kind: "not_this_one"; reason: RejectReason }
  | { kind: "already_watched"; liked: boolean | null };

export type Band = "close" | "medium" | "far";
// Positions in a movie's list of similar movies (most similar first).
export const BANDS: Record<Band, [number, number]> = { close: [1, 10], medium: [11, 25], far: [26, Infinity] };

// How likely each jump distance is after each kind of feedback.
export function bandOdds(f: Feedback): Record<Band, number> {
  if (f.kind === "already_watched") {
    if (f.liked === true) return { close: 1, medium: 0, far: 0 }; // the right kind of movie: stay close
    if (f.liked === false) return { close: 0, medium: 0.4, far: 0.6 };
    return { close: 0.6, medium: 0.4, far: 0 };
  }
  switch (f.reason) {
    case "seen": return { close: 0.7, medium: 0.3, far: 0 }; // right kind, just already seen
    case "mood": return { close: 0.2, medium: 0.6, far: 0.2 };
    case "genre": return { close: 0, medium: 0.3, far: 0.7 };
    case "intense": return { close: 0.3, medium: 0.5, far: 0.2 };
    default: return { close: 1 / 3, medium: 1 / 3, far: 1 / 3 };
  }
}

// What the next pick must (or must not) share with the one the viewer turned down.
export function feedbackFilter(f: Feedback, from: Movie): (m: Movie) => boolean {
  if (f.kind === "not_this_one" && f.reason === "mood") {
    // Scenario 2: a different mood, but at least one shared genre.
    return (m) => !m.moods.some((x) => from.moods.includes(x)) && m.genres.some((g) => from.genres.includes(g));
  }
  if (f.kind === "not_this_one" && f.reason === "intense") return (m) => m.intensity < from.intensity;
  return () => true;
}

export type Neighbor = { id: string; rank: number; score: number };
export type Jump = { from: string; band: Band | "landing"; rank?: number; score?: number; widened?: boolean };

// The next pick after feedback on `from`. `eligible` is every movie that still
// qualifies (meets the Must haves, not shown or watched), already scored by the
// rules with the session's adjustments. Returns null if no similar movie
// qualifies; the caller then lands again on the whole pool.
export function jump(from: Movie, feedback: Feedback, neighbors: Neighbor[], eligible: Ranked[], rng: Rng): { pick: Ranked; jump: Jump } | null {
  const byId = new Map(eligible.map((r) => [r.movie.id, r]));
  const keep = feedbackFilter(feedback, from);
  const candidates = neighbors
    .filter((n) => byId.has(n.id) && keep(byId.get(n.id)!.movie))
    .map((n) => ({ ...n, ranked: byId.get(n.id)! }));
  if (!candidates.length) return null;

  const odds = bandOdds(feedback);
  const inBand = (b: Band) => candidates.filter((c) => c.rank >= BANDS[b][0] && c.rank <= BANDS[b][1]);
  // Roll the distance; if nothing qualifies at that distance, try the others,
  // most likely first, then nearest.
  const rolled = draw((Object.keys(odds) as Band[]).filter((b) => odds[b] > 0), (b) => odds[b], rng)!;
  const order: Band[] = [rolled, ...(Object.keys(odds) as Band[]).filter((b) => b !== rolled).sort((a, b) => odds[b] - odds[a] || BANDS[a][0] - BANDS[b][0])];
  for (const band of order) {
    const pool = inBand(band);
    if (!pool.length) continue;
    const best = Math.max(...pool.map((c) => c.ranked.fit));
    const chosen = draw(pool, (c) => Math.exp((c.ranked.fit - best) / TEMPERATURE), rng)!;
    return { pick: chosen.ranked, jump: { from: from.id, band, rank: chosen.rank, score: chosen.score, widened: band !== rolled || undefined } };
  }
  return null;
}
