-- CM-14: Similarity model
-- Run once in the Supabase SQL editor, after 0007.
--
-- web/scripts/similarity.mts fills these three tables from the catalog:
--   movie_clusters    about 60 groups of similar movies, each with a plain-language label
--   movie_similarity  each movie's fingerprint and the cluster it belongs to
--   movie_neighbors   each movie's most similar movies, ranked, with a 0-1 score
--
-- Links in movie_neighbors run both ways: if B is one of A's nearest movies, A
-- is also listed for B, so every movie can be reached by jumping from similar
-- movies. CM-10 uses them to pick and re-pick; CM-16 tests whether they help.

create table public.movie_clusters (
  id           smallint primary key,
  label        text not null,
  size         integer not null,
  examples     text[] not null default '{}',   -- a few of its best-known titles
  computed_at  timestamptz not null default now()
);

create table public.movie_similarity (
  movie_id     text primary key references public.movies (id) on delete cascade,
  cluster_id   smallint not null references public.movie_clusters (id),
  fingerprint  jsonb not null,                 -- {"keyword:dystopia": 0.21, "genre:Science Fiction": 0.18, ...}
  computed_at  timestamptz not null default now()
);

create table public.movie_neighbors (
  movie_id     text not null references public.movies (id) on delete cascade,
  neighbor_id  text not null references public.movies (id) on delete cascade,
  rank         smallint not null,              -- 1 = most similar
  score        real not null check (score between 0 and 1),
  primary key (movie_id, neighbor_id),
  check (movie_id <> neighbor_id)
);

create index movie_similarity_cluster_idx on public.movie_similarity (cluster_id);
create index movie_neighbors_rank_idx on public.movie_neighbors (movie_id, rank);

-- Logged-in viewers can read all three, like the quiz (CM-09). Only the secret
-- key, used by similarity.mts, can write.
alter table public.movie_clusters enable row level security;
alter table public.movie_similarity enable row level security;
alter table public.movie_neighbors enable row level security;

create policy "Logged-in viewers read clusters" on public.movie_clusters for select to authenticated using (true);
create policy "Logged-in viewers read similarity" on public.movie_similarity for select to authenticated using (true);
create policy "Logged-in viewers read neighbors" on public.movie_neighbors for select to authenticated using (true);

grant select on public.movie_clusters, public.movie_similarity, public.movie_neighbors to authenticated;
-- See 0003: new tables need an explicit grant for the secret key.
grant select, insert, update, delete on public.movie_clusters, public.movie_similarity, public.movie_neighbors to service_role;
