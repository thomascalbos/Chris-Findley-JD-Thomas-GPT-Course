import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// CM-03: the login link in the email lands here. Supabase adds a one-time
// ?code=, which is swapped for a login session (saved in cookies). Expired,
// reused, or tampered links go back to login with "That link didn't work".
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await (await getSupabaseServer()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
