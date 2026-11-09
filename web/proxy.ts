import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// CM-03: logged-out visitors can open only these; everything else sends them to login.
// About carries the TMDB notice, /auth/callback finishes a login from the emailed
// link, and /api/db-check is CM-01's connection check.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/tutorial", "/about", "/api/db-check"];

// Runs before every page. It also refreshes the login session, so a viewer
// who comes back the next day is still logged in (scenario 2).
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  // The tutorial is intentionally account-free. Let it load even when a local
  // developer has not configured Supabase yet; it never reads or saves user data.
  if (path === "/tutorial" || path.startsWith("/tutorial/")) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // Public pages still work in a fresh local checkout. Protected pages lead
    // to login until the developer adds the CM-03 Supabase configuration.
    return isPublic ? NextResponse.next({ request }) : NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);
  const redirectTo = !loggedIn && !isPublic ? "/login" : loggedIn && path === "/login" ? "/" : null;
  if (redirectTo) {
    const redirect = NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export const config = {
  // Skip Next's own files and images so pages can load their CSS, JS, and icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
