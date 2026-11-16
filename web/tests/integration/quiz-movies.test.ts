// Integration test (CM-09): the app's real quizFilter, sent to the real
// quiz_movies function in Supabase, logged in as test account A (TEST_A_* in
// .env.local). It only reads; it never writes. The count must match the same
// rules applied in plain code to the whole catalog.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { quizFilter } from "@/app/quiz-filter";
import { CORE, type Answers } from "@/app/engine";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is missing from web/.env.local`);
  return v;
};

describe("quiz_movies with scenario 1's answers", () => {
  it("counts the same movies as the quiz's rules do", async () => {
    const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
      auth: { persistSession: false },
    });
    const { error: loginError } = await db.auth.signInWithPassword({ email: env("TEST_A_EMAIL"), password: env("TEST_A_PASSWORD") });
    if (loginError) throw new Error(`Couldn't log in as test account A: ${loginError.message}`);

    // Solo unwind, Comedy and Adventure, Under 2 hours. No services chosen.
    const answers: Answers = { occasion: ["solo"], genres: ["Comedy", "Adventure"], time: ["120"] };
    const filter = quizFilter(answers, CORE, []);
    expect(filter).toEqual({ genres: ["Comedy", "Adventure"], maxRuntime: 120 });

    const { count, error } = await db.rpc("quiz_movies", { f: filter }, { count: "exact" }).select("id").range(0, 0);
    expect(error).toBeNull();

    const movies: { genres: string[]; runtime: number }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error: readError } = await db.from("movies").select("genres, runtime").range(from, from + 999);
      if (readError) throw readError;
      movies.push(...data);
      if (data.length < 1000) break;
    }
    const expected = movies.filter((m) => m.genres.some((g) => filter.genres!.includes(g)) && m.runtime < filter.maxRuntime!).length;

    expect(expected).toBeGreaterThan(0); // otherwise the comparison proves nothing
    expect(count).toBe(expected);
  }, 30_000);
});
