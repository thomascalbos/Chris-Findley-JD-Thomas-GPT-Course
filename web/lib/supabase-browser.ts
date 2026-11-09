import { createBrowserClient } from "@supabase/ssr";

// Supabase client for the browser. Login sessions are kept in cookies so the
// server (proxy.ts and server components) sees the same viewer.
export function getSupabaseBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
