// System test (CM-10): takes the quiz in Chrome as test account A and checks all
// four scenarios. What the screen can't show (moods, the jump distance, what was
// saved) is checked in Supabase through test account A's own pick_events and
// watched rows. Clears both before and after, so it can run again.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const email = process.env.TEST_A_EMAIL!;
const password = process.env.TEST_A_PASSWORD!;

async function logInAsTestA(context: BrowserContext, baseURL: string) {
  const jar: { name: string; value: string }[] = [];
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => jar, setAll: (cookies) => cookies.forEach(({ name, value }) => jar.push({ name, value })) },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Couldn't log in as test account A: ${error.message}`);
  await context.addCookies(jar.map((c) => ({ ...c, url: baseURL })));
}

async function testA(): Promise<SupabaseClient> {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return db;
}
async function clearTestA(db: SupabaseClient) {
  await db.from("watched").delete().neq("movie_id", "");
  await db.from("pick_events").delete().gt("id", 0);
}

const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const mustHave = (page: Page) => page.getByRole("switch", { name: /^Must have/ });
const next = (page: Page) => page.getByRole("button", { name: /^(Next|Next refinement|Find my movie)$/ });
const pickTitle = (page: Page) => page.locator("h2").first();

// Takes the quiz from Home. `follow` answers each follow-up question (by its title).
async function takeQuiz(page: Page, core: { occasion: string; genres: string[]; primary?: string; time: string; mustTime?: boolean },
  follow: (title: string) => Promise<void> = async () => { await page.locator("button[aria-pressed]").first().click(); }) {
  await page.goto("/");
  await page.getByRole("button", { name: "Find tonight's movie" }).click();
  await chip(page, core.occasion).click();
  await next(page).click();
  for (const g of core.genres) await chip(page, g).click();
  if (core.primary) await chip(page, `★ ${core.primary}`).click();
  await next(page).click();
  await chip(page, core.time).click();
  if (core.mustTime) await mustHave(page).click();
  while ((await next(page).textContent()) !== "Find my movie") {
    await next(page).click();
    await follow(await page.locator("h1").first().textContent() ?? "");
  }
  await next(page).click();
}

async function lastSession(db: SupabaseClient) {
  const { data, error } = await db.from("pick_events").select("session_id, seed, step, movie_id, action, detail, jump, created_at").order("id");
  if (error) throw error;
  const sessionId = data.at(-1)!.session_id;
  return data.filter((e) => e.session_id === sessionId);
}
async function movie(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("movies").select("id, title, genres, moods").eq("id", id).single();
  if (error) throw error;
  return data as { id: string; title: string; genres: string[]; moods: string[] };
}

test("CM-10: recommendation and Not this one", async ({ page, context, baseURL }) => {
  test.setTimeout(180_000);
  const db = await testA();
  await clearTestA(db);
  await logInAsTestA(context, baseURL!);
  const scenario1 = { occasion: "Solo unwind", genres: ["Comedy", "Adventure"], time: "Under 2 hours" };

  await test.step("Scenario 1: same answers twice → both meet the Must have, show why and where to watch, and can differ", async () => {
    const titles: string[] = [];
    for (let i = 0; i < 4 && new Set(titles).size < 2; i++) {
      await takeQuiz(page, scenario1);
      await expect(page.getByRole("heading", { name: "Here's your movie" })).toBeVisible({ timeout: 20_000 });
      titles.push((await pickTitle(page).textContent())!);
      // The app records each pick in the background; wait for this one.
      await expect.poll(async () => (await db.from("pick_events").select("id", { count: "exact", head: true }).eq("action", "shown")).count).toBe(i + 1);
      const shown = await movie(db, (await lastSession(db)).at(-1)!.movie_id);
      expect(shown.genres.includes("Comedy") || shown.genres.includes("Adventure")).toBe(true); // Must have: Comedy or Adventure
      await expect(page.getByText("Why this one")).toBeVisible();
      await expect(page.getByText("Where to watch (US)")).toBeVisible();
      await expect(page.getByText(/Availability checked/)).toBeVisible();
      const watch = page.getByRole("link", { name: /^Watch/ });
      if (await watch.count()) await expect(watch.first()).toHaveAttribute("target", "_blank");
    }
    console.log(`Scenario 1 first picks: ${titles.join(" | ")}`);
    expect(new Set(titles).size).toBeGreaterThan(1);
  });

  await test.step("Scenario 2: Wrong mood → a different mood that shares a genre, answers kept, no repeats", async () => {
    const before = (await lastSession(db)).filter((e) => e.action === "shown").at(-1)!.movie_id;
    await page.getByRole("button", { name: "Not this one" }).click();
    await page.getByRole("button", { name: "Wrong mood" }).click();
    await expect(page.getByRole("heading", { name: "Here's your movie" })).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await lastSession(db)).filter((e) => e.action === "shown").length).toBe(2);
    await expect.poll(async () => (await lastSession(db)).some((e) => e.action === "not_this_one")).toBe(true);
    const events = await lastSession(db);
    const after = events.filter((e) => e.action === "shown").at(-1)!;
    const [a, b] = [await movie(db, before), await movie(db, after.movie_id)];
    console.log(`Scenario 2: ${a.title} [${a.moods}] → ${b.title} [${b.moods}], jump ${JSON.stringify(after.jump)}`);
    expect(b.id).not.toBe(a.id);
    expect(b.moods.some((m) => a.moods.includes(m))).toBe(false);
    expect(b.genres.some((g) => a.genres.includes(g))).toBe(true);
    expect(events.some((e) => e.action === "not_this_one" && e.detail === "mood")).toBe(true);
  });

  await test.step("Scenario 3: Already watched and liked it → saved as watched, next pick is a close neighbor", async () => {
    const before = (await lastSession(db)).filter((e) => e.action === "shown").at(-1)!.movie_id;
    await page.getByRole("button", { name: "Already watched" }).click();
    await page.getByRole("button", { name: /Yes, more like it/ }).click();
    await expect.poll(async () => (await lastSession(db)).filter((e) => e.action === "shown").length).toBe(3);
    const after = (await lastSession(db)).filter((e) => e.action === "shown").at(-1)!;
    const { data: saved } = await db.from("watched").select("movie_id, liked, source").eq("movie_id", before);
    console.log(`Scenario 3: ${(await movie(db, before)).title} → ${(await movie(db, after.movie_id)).title}, jump ${JSON.stringify(after.jump)}`);
    expect(saved).toEqual([{ movie_id: before, liked: true, source: "pick" }]);
    expect(after.jump.from).toBe(before);
    if (!after.jump.widened) expect(after.jump.band).toBe("close");
    expect(after.movie_id).not.toBe(before);
  });

  await test.step("Scenario 4: no movie meets every Must have → told what the closest misses, title hidden until I agree", async () => {
    await takeQuiz(page, { occasion: "Solo unwind", genres: ["Horror"], time: "Under 90 minutes", mustTime: true }, async (title) => {
      if (/attention/i.test(title)) { await chip(page, "Background-friendly").click(); await mustHave(page).click(); }
      else await page.locator("button[aria-pressed]").last().click(); // "No preference" / "No minimum"
    });
    await expect(page.getByRole("heading", { name: "Nothing checks every Must have" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/The closest movie in the catalog fits most of your answers, but/)).toBeVisible();
    await expect(page.locator("main h2")).toHaveCount(0); // no movie card, so no title
    await page.getByRole("button", { name: "Show me anyway" }).click();
    await expect(page.getByRole("heading", { name: "Here's your movie" })).toBeVisible();
    await expect(page.getByText(/It misses your Must have/)).toBeVisible();
  });

  await test.step("Genre is always required; with a primary genre, every pick includes it, through every jump", async () => {
    await takeQuiz(page, { occasion: "Solo unwind", genres: ["Comedy", "Sci-fi"], primary: "Sci-fi", time: "Any length" });
    await expect(page.getByRole("heading", { name: "Here's your movie" })).toBeVisible({ timeout: 20_000 });
    for (const reason of ["Wrong mood", "Dislike the genre", "Something else"]) {
      await page.getByRole("button", { name: "Not this one" }).click();
      await page.getByRole("button", { name: reason }).click();
      await expect(page.getByRole("heading", { name: "Here's your movie" })).toBeVisible({ timeout: 20_000 });
    }
    await expect.poll(async () => (await lastSession(db)).filter((e) => e.action === "shown").length).toBe(4);
    const shown = await Promise.all((await lastSession(db)).filter((e) => e.action === "shown").map((e) => movie(db, e.movie_id)));
    console.log(`Primary Sci-fi: ${shown.map((m) => `${m.title} [${m.genres}]`).join(" → ")}`);
    for (const m of shown) expect(m.genres).toContain("Sci-fi");
  });

  await clearTestA(db);
});
