'use client'

// Movie search and details on the real catalog (CM-06). Account setup (CM-07)
// and Alerts (CM-15) reuse MovieSearch with their own action.

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getMovie, posterAt, searchMovies, type CatalogMovie, type SearchHit } from "./catalog";
import { availabilityLabel, fmtRuntime, watchOptions } from "./engine";
import { serviceById, type ServiceId } from "./movies";
import { Panel, SecondaryButton, inputClass } from "./ui";

type Status = "idle" | "loading" | "done" | "error";

export function MovieSearch({ onSelect, actionLabel = "Details", label = "Search for a movie" }: {
  onSelect: (hit: SearchHit) => void;
  actionLabel?: string;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const latest = useRef(0); // ignores replies to searches the viewer has already typed past

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++latest.current;
    const timer = setTimeout(() => {
      setStatus("loading");
      searchMovies(q).then(
        (found) => { if (id === latest.current) { setHits(found); setStatus("done"); } },
        () => { if (id === latest.current) setStatus("error"); },
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const short = query.trim().length < 2;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block font-medium">{label}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length < 2) { latest.current++; setStatus("idle"); setHits([]); } }}
          placeholder="Type part of a title"
          autoComplete="off"
          className={inputClass}
        />
      </label>
      <p role="status" className="text-[14px] text-plum">
        {short ? "" : status === "loading" ? "Searching…" : status === "error" ? "Search isn't working right now. Try again in a moment." : status === "done" && hits.length === 0 ? "No movies match" : ""}
      </p>
      {!short && hits.length > 0 && (
        <ul className="max-h-96 space-y-1 overflow-y-auto">
          {hits.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m)}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-1 text-left hover:bg-sand"
              >
                <Thumb hit={m} />
                <span className="flex-1">
                  {m.title} <span className="text-[13px] text-plum">({m.year})</span>
                </span>
                <span className="text-[14px] font-medium">{actionLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thumb({ hit }: { hit: SearchHit }) {
  if (!hit.poster) return <span aria-hidden className="h-12 w-8 shrink-0 rounded bg-teal/15" />;
  // TMDB's CDN already serves this size, so Vercel doesn't need to resize it.
  return <Image src={posterAt(hit.poster, "w92")} alt="" width={32} height={48} unoptimized className="h-12 w-8 shrink-0 rounded object-cover" />;
}

export function MovieDetails({ id, services, onClose, children }: {
  id: string;
  services: ServiceId[];
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [movie, setMovie] = useState<CatalogMovie | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getMovie(id).then((m) => { if (live) setMovie(m); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={movie?.title ?? "Movie details"} className="fixed inset-0 z-40 overflow-y-auto bg-teal/60 p-4" onClick={onClose}>
      <div className="mx-auto my-8 max-w-3xl rounded-2xl bg-ivory" onClick={(e) => e.stopPropagation()}>
        {!movie ? (
          <Panel className="space-y-4">
            <p className="text-plum">{failed ? "Couldn't load this movie. Try again in a moment." : "Loading…"}</p>
            <SecondaryButton onClick={onClose} autoFocus>Close</SecondaryButton>
          </Panel>
        ) : (
          <Panel className="grid gap-5 sm:grid-cols-[12rem_1fr]">
            {movie.poster ? (
              <Image src={posterAt(movie.poster, "w342")} alt={`Poster for ${movie.title}`} width={192} height={288} unoptimized className="aspect-[2/3] w-full max-w-48 rounded-xl object-cover" />
            ) : (
              <div aria-hidden className="aspect-[2/3] w-full max-w-48 rounded-xl bg-teal/15" />
            )}
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl leading-tight md:text-3xl">{movie.title}</h2>
                <p className="text-[14px] text-plum">
                  {movie.year} · {fmtRuntime(movie.runtime)} · Rated {movie.rating} · {movie.genres.join(", ")}
                  <br />
                  <span className="font-medium">{movie.score === null ? "Not enough ratings yet" : `★ ${movie.score.toFixed(1)} / 5`}</span> audience score
                </p>
              </div>
              <p>{movie.synopsis}</p>
              <div>
                <p className="mb-1.5 text-[14px] font-medium">Where to watch (US)</p>
                {movie.availability.length === 0 ? (
                  <p className="text-[14px] text-plum">Not on any of our eight services right now.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {watchOptions(movie, services).map((a) => (
                      <li key={a.service + a.type} className="flex flex-wrap items-center gap-x-2 text-[14px]">
                        <span className="font-medium">{serviceById(a.service).name}</span>
                        <span className="text-plum">· {availabilityLabel(a)}</span>
                        {services.includes(a.service) && a.type !== "rent" && (
                          <span className="rounded-full bg-cream px-2 text-[13px] font-medium">Your service</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-[13px] text-plum">
                  Availability checked {new Date(movie.checkedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}. Streaming data from JustWatch.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {children}
                <SecondaryButton onClick={onClose} autoFocus>Close</SecondaryButton>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

// Home's "Look up a movie" panel: search, then open a movie's details.
export function MovieLookup({ services }: { services: ServiceId[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Panel>
      <h2 className="mb-3 font-display text-[22px]">Look up a movie</h2>
      <MovieSearch onSelect={(m) => setOpenId(m.id)} label="Search our catalog" />
      {openId && <MovieDetails id={openId} services={services} onClose={() => setOpenId(null)} />}
    </Panel>
  );
}
