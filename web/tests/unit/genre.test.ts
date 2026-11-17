// Unit tests (CM-10): genre is always a requirement, and a primary genre must be in every pick.
import { describe, expect, it } from "vitest";
import { NO_ADJUSTMENTS, rankPool, type Answers, type RecommendInput } from "@/app/engine";
import type { Movie } from "@/app/movies";
import { mustHaveFilter, quizFilter } from "@/app/quiz-filter";

const movie = (id: string, genres: Movie["genres"]): Movie => ({
  id, title: id, year: 2015, runtime: 100, rating: "PG", score: 4, genres, moods: ["Comforting"],
  attention: "easy", intensity: 1, synopsis: "", availability: [], poster: null,
});
const pool = [
  movie("comedy", ["Comedy"]),
  movie("animation", ["Animation"]),
  movie("animated-comedy", ["Animation", "Comedy"]),
  movie("drama", ["Drama"]), // fits everything else perfectly, but not a requested genre
];
const input = (answers: Answers): RecommendInput => ({
  answers, asked: ["occasion", "genres", "time"], must: {}, includeRewatches: false, exclude: [], adjustments: NO_ADJUSTMENTS, services: [],
  taste: { services: [], favorites: [], ratings: {}, watchlist: [], watched: [] },
});
const ids = (answers: Answers) => rankPool(input(answers), pool).eligible.map((r) => r.movie.id).sort();

describe("genre is always a requirement", () => {
  it("picks only movies with a chosen genre, even without Must have", () => {
    expect(ids({ occasion: ["solo"], genres: ["Comedy", "Animation"], time: ["any"] })).toEqual(["animated-comedy", "animation", "comedy"]);
  });

  it("with a primary genre, every pick includes it", () => {
    expect(ids({ occasion: ["solo"], genres: ["Comedy", "Animation"], primaryGenre: "Animation", time: ["any"] })).toEqual(["animated-comedy", "animation"]);
  });

  it("Anything means no genre limit, and a primary genre that's no longer chosen is ignored", () => {
    expect(ids({ occasion: ["solo"], genres: ["any"], time: ["any"] })).toHaveLength(4);
    expect(ids({ occasion: ["solo"], genres: ["Comedy"], primaryGenre: "Animation", time: ["any"] })).toEqual(["animated-comedy", "comedy"]);
  });

  it("the database filter always includes genre, narrowed to the primary genre when there is one", () => {
    const answers: Answers = { occasion: ["solo"], genres: ["Comedy", "Sci-fi"], time: ["120"] };
    expect(mustHaveFilter(answers, ["occasion", "genres", "time"], {}, [])).toEqual({ genres: ["Comedy", "Sci-fi"] });
    expect(mustHaveFilter({ ...answers, primaryGenre: "Sci-fi" }, ["occasion", "genres", "time"], {}, [])).toEqual({ genres: ["Sci-fi"] });
    expect(quizFilter({ ...answers, primaryGenre: "Sci-fi" }, ["occasion", "genres", "time"], [])).toEqual({ genres: ["Sci-fi"], maxRuntime: 120 });
  });
});
