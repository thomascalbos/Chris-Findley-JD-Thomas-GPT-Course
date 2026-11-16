// Unit test (CM-09): countMatches turns a quiz filter into one count-only call
// to the quiz_movies function and returns the number. Supabase is mocked, so
// this needs no network and no login.
import { beforeEach, describe, expect, it, vi } from "vitest";

const range = vi.fn();
const select = vi.fn(() => ({ range }));
const rpc = vi.fn(() => ({ select }));
vi.mock("@/lib/supabase-browser", () => ({ getSupabaseBrowser: () => ({ rpc }) }));

const { countMatches } = await import("@/app/quiz-filter");

describe("countMatches", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks quiz_movies for an exact count without fetching rows, and returns it", async () => {
    range.mockResolvedValue({ count: 42, error: null });
    const filter = { genres: ["Comedy", "Adventure"], maxRuntime: 120 };

    await expect(countMatches(filter)).resolves.toBe(42);

    expect(rpc).toHaveBeenCalledWith("quiz_movies", { f: filter }, { count: "exact" });
    expect(select).toHaveBeenCalledWith("id");
    expect(range).toHaveBeenCalledWith(0, 0); // at most one row comes back
  });
});
