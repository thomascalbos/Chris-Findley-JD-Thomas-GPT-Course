// CM-01 scenario 2: account A can see only A's favorites, never B's.
// Uses only the public key, logging in as two test accounts created in the
// Supabase dashboard. Run from web/: node --env-file=.env.local scripts/check-rls.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const accounts = {
  A: { email: process.env.TEST_A_EMAIL!, password: process.env.TEST_A_PASSWORD!, movie: "lighthouse-bakery" },
  B: { email: process.env.TEST_B_EMAIL!, password: process.env.TEST_B_PASSWORD!, movie: "signal-lost" },
};

async function logIn(name: "A" | "B") {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword(accounts[name]);
  if (error) throw new Error(`Couldn't log in as ${name}: ${error.message}`);
  return { client, userId: data.user.id };
}

const a = await logIn("A");
const b = await logIn("B");

// Each account saves its own favorite (ignore "already saved" on reruns).
for (const [name, { client }] of [["A", a], ["B", b]] as const) {
  const { error } = await client
    .from("favorites")
    .upsert({ movie_id: accounts[name].movie }, { ignoreDuplicates: true });
  if (error) throw new Error(`${name} couldn't save a favorite: ${error.message}`);
}

const { data: seenByA, error } = await a.client.from("favorites").select("user_id, movie_id");
if (error) throw new Error(error.message);

// A also tries to write a favorite into B's account; RLS should refuse it.
const forged = await a.client.from("favorites").insert({ user_id: b.userId, movie_id: "paper-planets" });

const onlyOwn = seenByA.length > 0 && seenByA.every((f) => f.user_id === a.userId);
console.log("A sees:", seenByA.map((f) => f.movie_id));
console.log(onlyOwn ? "PASS: A sees only A's favorites" : "FAIL: A can see someone else's favorites");
console.log(forged.error ? "PASS: A can't write into B's favorites" : "FAIL: A wrote into B's favorites");
process.exit(onlyOwn && forged.error ? 0 : 1);
