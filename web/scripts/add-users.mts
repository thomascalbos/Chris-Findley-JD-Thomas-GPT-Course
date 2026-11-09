// CM-03: adds emails to the approved list. Only listed emails can log in,
// because the login page never creates accounts. No email is sent; each person
// just logs in at /login with their address.
// Run from web/:  node --env-file=.env.local scripts/add-users.mts a@example.com b@example.com
// To remove someone, delete them in Supabase under Authentication → Users.
import { createClient } from "@supabase/supabase-js";

const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);
if (!emails.length) {
  console.error("List the emails to add, separated by spaces.");
  process.exit(1);
}

// Creating accounts needs the secret key, which stays on a team computer.
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

let failed = 0;
for (const email of emails) {
  const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (!error) console.log(`Added ${email}`);
  else if (error.code === "email_exists") console.log(`Already on the list: ${email}`);
  else {
    failed++;
    console.error(`Couldn't add ${email}: ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
