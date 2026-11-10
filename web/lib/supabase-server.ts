import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Viewer } from "@/app/account";
import type { SearchHit } from "@/app/catalog";
import type { ServiceId } from "@/app/movies";

// Supabase client for server components and route handlers. It reads the
// viewer's login session from cookies, so database calls run as that viewer.
export async function getSupabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server components can't set cookies. proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

// The logged-in viewer and what they've saved (CM-07), or null when logged out.
export async function getViewer(): Promise<Viewer | null> {
  // Checking the login reads the clock (token expiry), so render per request.
  await connection();
  const db = await getSupabaseServer();
  const { data } = await db.auth.getClaims();
  const email = data?.claims.email as string | undefined;
  if (!email) return null;

  // Row-level security limits both reads to this viewer's own rows.
  const [profile, favorites] = await Promise.all([
    db.from("profiles").select("services, setup_done_at").maybeSingle(),
    db.from("favorites").select("created_at, movies (id, title, year, rating, poster)").order("created_at"),
  ]);
  if (profile.error) throw profile.error;
  if (favorites.error) throw favorites.error;
  return {
    email,
    services: (profile.data?.services ?? []) as ServiceId[],
    favorites: favorites.data.map((f) => f.movies as unknown as SearchHit),
    setupDone: Boolean(profile.data?.setup_done_at),
  };
}
