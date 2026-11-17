// System test (CM-09): drives the quiz in Chrome through all four
// Given-When-Then scenarios, logged in as test account A.
import { createServerClient } from "@supabase/ssr";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// The app logs in by emailed link. For the test, log test account A in with its
// password and hand the browser the same session cookies the app would set.
async function logInAsTestA(context: BrowserContext, baseURL: string) {
  const jar: { name: string; value: string }[] = [];
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => jar,
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.push({ name, value })),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_A_EMAIL!, password: process.env.TEST_A_PASSWORD! });
  if (error) throw new Error(`Couldn't log in as test account A: ${error.message}`);
  await context.addCookies(jar.map((c) => ({ ...c, url: baseURL })));
}

const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const mustHave = (page: Page) => page.getByRole("switch", { name: /^Must have/ });
const next = (page: Page) => page.getByRole("button", { name: /^(Next|Next refinement|Find my movie)$/ });

test("CM-09: the quiz", async ({ page, context, baseURL }) => {
  await logInAsTestA(context, baseURL!);
  await page.goto("/");

  // An account that hasn't done first-login setup (CM-07) gets it before Home.
  // Skipping both steps saves an empty setup to the test account and goes Home.
  const findMovie = page.getByRole("button", { name: "Find tonight's movie" });
  const setup = page.getByText("Setup · step 1 of 2");
  await expect(findMovie.or(setup)).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByRole("button", { name: "Skip" }).click();
    await page.getByRole("button", { name: "Skip" }).click();
  }
  await findMovie.click();
  await expect(page.getByText("Question 1 of 3")).toBeVisible();

  await test.step("Scenario 4: with no answer picked, Next is disabled", async () => {
    await expect(next(page)).toBeDisabled();
    await chip(page, "Solo unwind").click();
    await expect(next(page)).toBeEnabled();
    await next(page).click();
  });

  await test.step("Scenario 3: Must have turns on for a specific answer, and is disabled for Anything", async () => {
    // Genre is always a requirement (CM-10), so the genre question has no Must
    // have toggle; the time question does.
    await expect(page.getByText("Question 2 of 3")).toBeVisible();
    await chip(page, "Anything").click();
    await chip(page, "Comedy").click();
    await chip(page, "Adventure").click();
    await expect(chip(page, "Anything")).toHaveAttribute("aria-pressed", "false"); // picking a genre clears Anything
    await expect(mustHave(page)).toHaveCount(0);
    await expect(page.getByText("Genre is always a requirement: every pick will be comedy or adventure.")).toBeVisible();
    await next(page).click();

    await expect(page.getByText("Question 3 of 3")).toBeVisible();
    await chip(page, "Any length").click();
    await expect(mustHave(page)).toBeDisabled();
    await chip(page, "Under 2 hours").click();
    await mustHave(page).click();
    await expect(mustHave(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("(on)", { exact: true })).toBeVisible();
    await mustHave(page).click(); // back off, for scenario 1's answers
    await page.getByRole("button", { name: "Back" }).click();
    await next(page).click();
  });

  await test.step("Scenario 2: going Back from question 3 keeps earlier answers selected", async () => {
    await expect(page.getByText("Question 3 of 3")).toBeVisible();
    await chip(page, "Under 2 hours").click();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("Question 2 of 3")).toBeVisible();
    await expect(chip(page, "Comedy")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Adventure")).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("Question 1 of 3")).toBeVisible();
    await expect(chip(page, "Solo unwind")).toHaveAttribute("aria-pressed", "true");

    await next(page).click();
    await next(page).click();
    await expect(chip(page, "Under 2 hours")).toHaveAttribute("aria-pressed", "true");
  });

  await test.step("Scenario 1: Solo unwind, Comedy and Adventure, Under 2 hours → at most 4 follow-ups, 7 questions total", async () => {
    let followUps = 0;
    while ((await next(page).textContent()) !== "Find my movie") {
      await next(page).click();
      followUps++;
      await expect(page.getByText(`Optional refinement ${followUps} of`)).toBeVisible();
      // Answer each follow-up with its first option.
      await page.locator("button[aria-pressed]").first().click();
      expect(followUps).toBeLessThanOrEqual(4); // stop early if the quiz runs away
    }
    expect(3 + followUps).toBeLessThanOrEqual(7);
    console.log(`Scenario 1 asked 3 core questions + ${followUps} follow-ups = ${3 + followUps} total`);
  });
});
