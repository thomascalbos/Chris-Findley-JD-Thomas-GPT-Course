'use client'

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Heading, Panel, PrimaryButton, TextButton, inputClass } from "../ui";

// CM-03: log in with a link emailed to you. No passwords. Only emails on the
// approved list can log in. The link lands on /auth/callback, which finishes the login.
export default function LoginForm() {
  const params = useSearchParams();
  const deleted = params.get("deleted") === "1";
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") === "link" ? "That link didn't work" : null);
  const [busy, setBusy] = useState(false);

  async function sendLink(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    // Only approved emails can log in: accounts are added ahead of time
    // (scripts/add-users.mts or the Supabase dashboard), never created here.
    const address = sentTo ?? email.trim();
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      setError(
        error.code === "otp_disabled"
          ? "That email isn't on the CineMatch guest list. Ask the team to add you."
          : error.status === 429
            ? "Too many login emails requested. Wait a minute, then try again."
            : "We couldn't send a login link to that email. Check it and try again.",
      );
      return;
    }
    setSentTo(address);
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <p className="mb-8 font-display text-2xl md:text-[28px]">
        Cine<span className="text-brick">Match</span>
      </p>
      {deleted && !sentTo && (
        <p role="status" className="mb-6 rounded-2xl border border-brick/30 bg-sand p-4">
          Your account&apos;s saved data has been deleted, and you&apos;re logged out. You can still log in with the same email; you&apos;ll start with an empty account.
        </p>
      )}
      {!sentTo ? (
        <>
          <Heading eyebrow="Log in" title="Log in with your email" subtitle="We'll email you a login link. No password needed. CineMatch is invite-only for now." />
          <Panel>
            <form onSubmit={sendLink} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[15px] font-medium">Email</span>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </label>
              {error && <p role="alert" className="text-brick">{error === "That link didn't work" ? `${error}. It may have expired or already been used, or it was opened in a different browser. Request a new one below.` : error}</p>}
              <PrimaryButton type="submit" disabled={busy || !email.trim()}>{busy ? "Sending…" : "Email me a login link"}</PrimaryButton>
            </form>
          </Panel>
        </>
      ) : (
        <>
          <Heading eyebrow="Log in" title="Check your email" subtitle={`We sent a login link to ${sentTo}. Open it in this browser within 10 minutes.`} />
          <Panel className="space-y-3">
            {error && <p role="alert" className="text-brick">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextButton type="button" disabled={busy} onClick={() => sendLink()}>{busy ? "Sending…" : "Send a new link"}</TextButton>
              <TextButton type="button" disabled={busy} onClick={() => { setSentTo(null); setError(null); }}>Use a different email</TextButton>
            </div>
          </Panel>
        </>
      )}
    </main>
  );
}
