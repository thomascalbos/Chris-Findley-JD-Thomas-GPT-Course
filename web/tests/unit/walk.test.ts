// Unit tests (CM-10): landing and jumping, with made-up movies so the rules are easy to see.
import { describe, expect, it } from "vitest";
import type { Movie } from "@/app/movies";
import { BANDS, bandOdds, jump, land, scoreWeight, secondHop, seededRng, type Neighbor, type Ranked } from "@/app/walk";

const movie = (id: string, over: Partial<Movie> = {}): Movie => ({
  id, title: id, year: 2015, runtime: 110, rating: "PG-13", score: 4, genres: ["Sci-fi"], moods: ["Suspenseful"],
  attention: "easy", intensity: 2, synopsis: "", availability: [], poster: null, ...over,
});
const ranked = (m: Movie, fit = 10): Ranked => ({ movie: m, fit });

describe("land", () => {
  it("the same seed always lands on the same movie; different seeds can land on different ones", () => {
    const pool = Array.from({ length: 12 }, (_, i) => ranked(movie(`m${i}`), 10 - i * 0.1));
    expect(land(pool, seededRng(7))!.movie.id).toBe(land(pool, seededRng(7))!.movie.id);
    const firsts = new Set(Array.from({ length: 50 }, (_, s) => land(pool, seededRng(s))!.movie.id));
    expect(firsts.size).toBeGreaterThan(3); // scenario 1: same answers, different first picks
  });

  it("only lands among the best fits, and favors the closest", () => {
    const pool = [ranked(movie("best"), 20), ...Array.from({ length: 30 }, (_, i) => ranked(movie(`weak${i}`), 5 - i * 0.01))];
    const counts = new Map<string, number>();
    for (let s = 0; s < 200; s++) {
      const id = land(pool, seededRng(s))!.movie.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.get("best")).toBeGreaterThan(190);
    expect([...counts.keys()].some((id) => /weak(1[2-9]|2\d)/.test(id))).toBe(false); // never outside the top 12
  });

  it("returns nothing when nothing qualifies", () => {
    expect(land([], seededRng(1))).toBeNull();
  });
});

describe("jump", () => {
  const from = movie("interstellar", { genres: ["Sci-fi", "Drama"], moods: ["Serious and thought-provoking"], intensity: 2 });
  // 40 similar movies, most similar first.
  const others = Array.from({ length: 40 }, (_, i) => movie(`n${i + 1}`, {
    genres: i % 2 ? ["Sci-fi"] : ["Comedy"],
    moods: i % 3 ? ["Suspenseful"] : ["Serious and thought-provoking"],
    intensity: (i % 3) + 1 as 1 | 2 | 3,
  }));
  const neighbors: Neighbor[] = others.map((m, i) => ({ id: m.id, rank: i + 1, score: 0.6 - i * 0.01 }));
  const eligible = others.map((m) => ranked(m));

  it("scenario 2: Wrong mood lands on a different mood that shares a genre", () => {
    for (let s = 0; s < 50; s++) {
      const r = jump(from, { kind: "not_this_one", reason: "mood" }, neighbors, eligible, seededRng(s))!;
      expect(r.pick.movie.moods).not.toContain("Serious and thought-provoking");
      expect(r.pick.movie.genres.some((g) => from.genres.includes(g))).toBe(true);
    }
  });

  it("scenario 3: Already watched and liked it stays among the close neighbors", () => {
    for (let s = 0; s < 50; s++) {
      const r = jump(from, { kind: "already_watched", liked: true }, neighbors, eligible, seededRng(s))!;
      expect(r.jump.band).toBe("close");
      expect(r.jump.rank).toBeLessThanOrEqual(BANDS.close[1]);
    }
  });

  it("Dislike the genre and didn't like it jump further out", () => {
    for (const f of [{ kind: "not_this_one", reason: "genre" } as const, { kind: "already_watched", liked: false } as const]) {
      const ranks = Array.from({ length: 50 }, (_, s) => jump(from, f, neighbors, eligible, seededRng(s))!.jump.rank!);
      expect(Math.min(...ranks)).toBeGreaterThan(BANDS.close[1]);
    }
  });

  it("Too intense only lands on calmer movies", () => {
    for (let s = 0; s < 50; s++) {
      expect(jump(from, { kind: "not_this_one", reason: "intense" }, neighbors, eligible, seededRng(s))!.pick.movie.intensity).toBeLessThan(from.intensity);
    }
  });

  it("only lands on movies that still qualify, and widens the distance when it must", () => {
    const onlyFar = eligible.filter((r) => Number(r.movie.id.slice(1)) > 30);
    const r = jump(from, { kind: "already_watched", liked: true }, neighbors, onlyFar, seededRng(3))!;
    expect(onlyFar.map((x) => x.movie.id)).toContain(r.pick.movie.id);
    expect(r.jump.widened).toBe(true);
    expect(jump(from, { kind: "not_this_one", reason: "seen" }, neighbors, [], seededRng(3))).toBeNull();
  });

  it("every kind of feedback has odds that add up to 1", () => {
    const kinds = [
      ...(["seen", "mood", "genre", "intense", "other"] as const).map((reason) => ({ kind: "not_this_one" as const, reason })),
      ...[true, false, null].map((liked) => ({ kind: "already_watched" as const, liked })),
    ];
    for (const f of kinds) expect(Object.values(bandOdds(f)).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe("secondHop", () => {
  it("lists movies two jumps away once each, after the direct ones, skipping the start", () => {
    const direct = [{ id: "a", rank: 1, score: 0.5 }, { id: "b", rank: 2, score: 0.4 }];
    const theirs = [[{ id: "start", rank: 1, score: 0.5 }, { id: "c", rank: 2, score: 0.3 }, { id: "b", rank: 3, score: 0.3 }], [{ id: "c", rank: 1, score: 0.3 }, { id: "d", rank: 2, score: 0.2 }]];
    expect(secondHop("start", direct, theirs)).toEqual([{ id: "c", rank: 100, score: 0.3 }, { id: "d", rank: 101, score: 0.2 }]);
  });
});

describe("audience score skew", () => {
  it("a 5-star movie is 20 times as likely as an equally fitting 3-star one, about 4.5x per star", () => {
    expect(scoreWeight(5) / scoreWeight(3)).toBeCloseTo(20);
    expect(scoreWeight(4) / scoreWeight(3)).toBeCloseTo(Math.sqrt(20));
    expect(scoreWeight(5) / scoreWeight(4)).toBeCloseTo(scoreWeight(4) / scoreWeight(3)); // same factor per star
    expect(scoreWeight(null)).toBe(1); // "Not enough ratings yet" counts as 3 stars
  });

  it("shows up in the picks: equal fits, 5 stars beats 3 stars about 20 to 1", () => {
    const pool = [ranked(movie("five", { score: 5 })), ranked(movie("three", { score: 3 }))];
    let five = 0;
    for (let s = 0; s < 4200; s++) if (land(pool, seededRng(s))!.movie.id === "five") five++;
    expect(five / (4200 - five)).toBeGreaterThan(16);
    expect(five / (4200 - five)).toBeLessThan(25);
  });
});
