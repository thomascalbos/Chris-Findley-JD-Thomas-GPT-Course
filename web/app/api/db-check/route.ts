import { getSupabase } from "@/lib/supabase";

// CM-01 scenario 1: proves the deployed app can read the movies table.
// Visit /api/db-check on the live site; it reports how many movies it read.
export async function GET() {
  try {
    const { data, count, error } = await getSupabase()
      .from("movies")
      .select("id, title", { count: "exact" })
      .order("title")
      .limit(3);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, movies: count, sample: data?.map((m) => m.title) });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
