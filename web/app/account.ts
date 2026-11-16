// What a viewer has saved to their account (CM-07): streaming services,
// up to five favorites, and whether they've been through setup.
// The server loads it (getViewer in lib/supabase-server.ts); the browser saves it.

import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { SearchHit } from "./catalog";
import type { ServiceId } from "./movies";

export const MAX_FAVORITES = 5;

export type Viewer = {
  email: string;
  services: ServiceId[];
  favorites: SearchHit[];
  setupDone: boolean; // finished or skipped setup, so it isn't shown again
};

// Saves setup in one go: services, favorites (replacing any saved before), and
// that setup is done. Old favorites are removed first so the five-favorite cap
// in the database counts only the new ones.
export async function saveSetup(services: ServiceId[], favoriteIds: string[]) {
  const db = getSupabaseBrowser();
  const { error: profileError } = await db
    .from("profiles")
    .upsert({ services, setup_done_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  if (profileError) throw profileError;

  const stale = db.from("favorites").delete();
  const { error: deleteError } = favoriteIds.length
    ? await stale.not("movie_id", "in", `(${favoriteIds.map((id) => `"${id}"`).join(",")})`)
    : await stale.neq("movie_id", "");
  if (deleteError) throw deleteError;

  // Insert only the new ones: the cap check runs before Postgres notices a
  // duplicate, so re-sending kept favorites would count against the five.
  const { data: kept, error: keptError } = await db.from("favorites").select("movie_id");
  if (keptError) throw keptError;
  const added = favoriteIds.filter((id) => !kept.some((k) => k.movie_id === id));
  if (added.length) {
    const { error } = await db.from("favorites").insert(added.map((movie_id) => ({ movie_id })));
    if (error) throw error;
  }
}

// Settings (CM-13): saves a new list of services. Leaves setup's status alone,
// so changing services before finishing setup doesn't skip it.
export async function saveServicesToAccount(services: ServiceId[]) {
  const { error } = await getSupabaseBrowser()
    .from("profiles")
    .upsert({ services, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

// Delete account (CM-08): removes everything saved, but keeps the login (see CM-03).
export async function deleteSavedData() {
  const db = getSupabaseBrowser();
  const { error: favoritesError } = await db.from("favorites").delete().neq("movie_id", "");
  if (favoritesError) throw favoritesError;
  const { error: profileError } = await db.from("profiles").delete().not("user_id", "is", null);
  if (profileError) throw profileError;
}
