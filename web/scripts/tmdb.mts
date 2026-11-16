// Shared by the import (CM-02) and the weekly refresh (CM-04): calling TMDB,
// and turning its US watch providers into CineMatch's eight services.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TmdbError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error("Missing TMDB_READ_TOKEN");
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
    if (res.ok) return (await res.json()) as T;
    // Back off on rate limits and server errors; give up after 5 tries.
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 1000 * 2 ** attempt;
      await sleep(wait);
      continue;
    }
    throw new TmdbError(res.status, `TMDB ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
  }
}

// Watch providers ------------------------------------------------------------
// TMDB's streaming data comes from JustWatch. Only CineMatch's eight services
// count; channel versions (e.g. "Paramount Plus Apple TV Channel") count as the service.

type Provider = { provider_name: string };
export type UsProviders = { flatrate?: Provider[]; free?: Provider[]; ads?: Provider[]; rent?: Provider[] };
export type Availability = { service: string; type: "subscription" | "free" | "rent" };

const SUBSCRIPTION_SERVICES: [RegExp, string][] = [
  [/^Netflix/i, "netflix"],
  [/^Amazon Prime Video/i, "prime"],
  [/^Paramount(\+| Plus)/i, "paramount"],
  [/^Disney(\+| Plus)/i, "disney"],
  [/^Hulu/i, "hulu"],
  [/^Apple TV(\+| Plus)/i, "apple"],
  [/^(HBO )?Max\b/i, "hbo"],
];
const RENT_SERVICES: [RegExp, string][] = [
  [/^Amazon Video$/i, "prime"],
  [/^Apple TV( Store)?$/i, "apple"],
];

export function availability(us?: UsProviders): Availability[] {
  if (!us) return [];
  const out = new Map<string, Availability>();
  const add = (service: string, type: Availability["type"]) => out.set(`${service}:${type}`, { service, type });
  for (const p of us.flatrate ?? []) {
    const match = SUBSCRIPTION_SERVICES.find(([re]) => re.test(p.provider_name));
    if (match) add(match[1], "subscription");
  }
  for (const p of [...(us.free ?? []), ...(us.ads ?? [])]) {
    if (/^Tubi/i.test(p.provider_name)) add("tubi", "free");
  }
  for (const p of us.rent ?? []) {
    const match = RENT_SERVICES.find(([re]) => re.test(p.provider_name));
    if (match) add(match[1], "rent");
  }
  return [...out.values()];
}
