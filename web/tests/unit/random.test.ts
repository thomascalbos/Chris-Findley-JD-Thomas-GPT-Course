// Unit tests (CM-11): ranking and picking for Random, with made-up movies.
import { describe, expect, it } from "vitest";
import type { Availability, Movie } from "@/app/movies";
import { RANDOM_TOP, pickRandom, rankRandom, type RandomOptions } from "@/app/random";
import { seededRng } from "@/app/walk";

const movie = (id: string, over: Partial<Movie> = {}): Movie => ({
  id, title: id, year: 2015, runtime: 110, rating: "PG-13", score: 4, genres: ["Sci-fi"], moods: ["Suspenseful"],
  attention: "easy", intensity: 2, synopsis: "", availability: [], poster: null, ...over,
});
const on = (...services: Availability["service"][]): Availability[] => services.map((service) => ({ service, type: "subscription" }));
const opts = (over: Partial<RandomOptions> = {}): RandomOptions => ({
  watched: [], includeRewatches: false, exclude: [], favorites: [], similar: new Map(), personal: true, ...over,
});
const ids = (ms: { movie: Movie }[]) => ms.map((r) => r.movie.id);

describe("rankRandom", () => {
  it("scenario 1: movies similar to a favorite outrank unrelated ones, and the favorite itself is skipped", () => {
    const pool = [movie("fav"), ...Array.from({ length: 20 }, (_, i) => movie(`plain${i}`)), movie("near", { score: 3.8 })];
    const ranked = rankRandom(pool, opts({ favorites: ["fav"], similar: new Map([["near", 0.8]]) }));
    expect(ranked[0].movie.id).toBe("near");
    expect(ids(ranked)).not.toContain("fav");
  });

  it("scenario 2: watched movies are skipped unless Include rewatches is on", () => {
    const pool = [movie("seen"), movie("new")];
    expect(ids(rankRandom(pool, opts({ watched: ["seen"] })))).toEqual(["new"]);
    expect(ids(rankRandom(pool, opts({ watched: ["seen"], includeRewatches: true })))).toContain("seen");
  });

  it("scenario 3: with setup skipped, widely available movies outrank equally rated ones on one service", () => {
    const pool = [movie("narrow", { availability: on("netflix") }), movie("wide", { availability: on("netflix", "hbo", "hulu") })];
    expect(rankRandom(pool, opts({ personal: false }))[0].movie.id).toBe("wide");
  });

  it("rentals don't count toward how widely available a movie is", () => {
    const rentals: Availability[] = [{ service: "netflix", type: "rent" }, { service: "hbo", type: "rent" }];
    const pool = [movie("rent", { availability: rentals }), movie("stream", { availability: on("hulu") })];
    expect(rankRandom(pool, opts({ personal: false }))[0].movie.id).toBe("stream");
  });
});

describe("pickRandom", () => {
  const pool = Array.from({ length: 30 }, (_, i) => movie(`m${i}`, { score: 5 - i * 0.05 }));

  it("varies among the top few, never beyond them, and never repeats the current pick", () => {
    const ranked = rankRandom(pool, opts({ exclude: ["m0"] }));
    const top = new Set(ids(ranked.slice(0, RANDOM_TOP)));
    const picks = Array.from({ length: 200 }, (_, s) => pickRandom(ranked, seededRng(s))!.id);
    expect(new Set(picks).size).toBeGreaterThan(3);
    expect(picks.every((id) => top.has(id))).toBe(true);
    expect(picks).not.toContain("m0");
  });

  it("returns nothing when nothing is left", () => {
    expect(pickRandom([], seededRng(1))).toBeNull();
  });
});
