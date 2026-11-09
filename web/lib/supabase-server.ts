import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

// The logged-in viewer's email, or null when logged out.
export async function getViewerEmail() {
  const { data } = await (await getSupabaseServer()).auth.getClaims();
  return (data?.claims.email as string | undefined) ?? null;
}
