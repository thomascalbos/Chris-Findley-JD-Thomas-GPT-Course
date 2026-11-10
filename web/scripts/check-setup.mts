// CM-07 scenarios 1 and 2, database side: setup is saved per viewer, a sixth
// favorite is refused even if the app is bypassed, and other viewers can't see
// it. Logs in as test accounts A and B with the public key, then removes what it
// saved for A. Run from web/: node --env-file=.env.local scripts/check-setup.mts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function logIn(email: string, password: string) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Couldn't log in as ${email}: ${error.message}`);
  return client;
}

const a = await logIn(process.env.TEST_A_EMAIL!, process.env.TEST_A_PASSWORD!);
const b = await logIn(process.env.TEST_B_EMAIL!, process.env.TEST_B_PASSWORD!);
let failures = 0;
const check = (ok: boolean, label: string) => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); };

// Start clean, as on a first login.
await a.from("favorites").delete().neq("movie_id", "");
await a.from("profiles").delete().not("user_id", "is", null);

const { data: six } = await a.from("movies").select("id, title").order("vote_count", { ascending: false }).limit(6);
if (!six || six.length < 6) throw new Error("Need at least 6 movies in the catalog");

// Scenario 1: Netflix, HBO Max, and three favorites, then read back as a new session would.
await a.from("profiles").upsert({ services: ["netflix", "hbo"], setup_done_at: new Date().toISOString() });
await a.from("favorites").insert(six.slice(0, 3).map((m) => ({ movie_id: m.id })));
const again = await logIn(process.env.TEST_A_EMAIL!, process.env.TEST_A_PASSWORD!);
const { data: profile } = await again.from("profiles").select("services, setup_done_at").single();
const { data: favs } = await again.from("favorites").select("movie_id");
check(JSON.stringify(profile?.services) === '["netflix","hbo"]' && Boolean(profile?.setup_done_at), `services and "setup done" kept after logging in again: ${profile?.services?.join(", ")}`);
check(favs?.length === 3, `3 favorites kept after logging in again: ${six.slice(0, 3).map((m) => m.title).join(", ")}`);

// Settings: changing services later keeps setup marked done, as the app's save does.
await a.from("profiles").upsert({ services: ["netflix", "disney"], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
const { data: edited } = await a.from("profiles").select("services, setup_done_at").single();
check(JSON.stringify(edited?.services) === '["netflix","disney"]' && Boolean(edited?.setup_done_at), `Settings change saved (${edited?.services?.join(", ")}) and setup still marked done`);

// Scenario 2: fill to five, then a sixth is refused by the database.
await a.from("favorites").insert(six.slice(3, 5).map((m) => ({ movie_id: m.id })));
const { error: sixthError } = await a.from("favorites").insert({ movie_id: six[5].id });
const { count } = await a.from("favorites").select("*", { count: "exact", head: true });
check(Boolean(sixthError) && count === 5, `sixth favorite refused (${sixthError?.message ?? "no error"}); still ${count} saved`);

// Another viewer sees none of it.
const { data: bProfile } = await b.from("profiles").select("user_id");
const { data: bFavs } = await b.from("favorites").select("movie_id").in("movie_id", six.map((m) => m.id));
check((bProfile ?? []).length === 0 && (bFavs ?? []).length === 0, "account B can't see account A's profile or favorites");

// Clean up, as Delete account does.
await a.from("favorites").delete().neq("movie_id", "");
await a.from("profiles").delete().not("user_id", "is", null);
const { count: left } = await a.from("favorites").select("*", { count: "exact", head: true });
const { data: leftProfile } = await a.from("profiles").select("user_id");
check(left === 0 && (leftProfile ?? []).length === 0, "Delete account's queries remove the profile and favorites");

console.log(failures ? `\n${failures} failed` : "\nAll passed");
