-- CM-01: Database setup
-- Run once in the Supabase SQL editor (or with `supabase db push`).
-- Creates the movie catalog and the first piece of viewer data (favorites),
-- with row-level security so each viewer can read and change only their own data.

-- Movies --------------------------------------------------------------------
-- Columns follow the Movie type in web/app/movies.ts. CM-02 fills this table
-- from TMDB; until then it holds the demo's sample movies (is_sample = true).

create table public.movies (
  id           text primary key,              -- slug, e.g. "lighthouse-bakery"; CM-02 may switch to TMDB ids
  tmdb_id      integer unique,                -- null for sample movies
  title        text not null,
  year         integer not null,
  runtime      integer not null,              -- minutes
  rating       text not null check (rating in ('G', 'PG', 'PG-13', 'R')),
  score        numeric(2, 1),                 -- audience score out of 5; null = "Not enough ratings yet"
  genres       text[] not null default '{}',
  moods        text[] not null default '{}',
  attention    text not null check (attention in ('background', 'easy', 'absorbing')),
  intensity    smallint not null check (intensity between 1 and 3),
  synopsis     text not null default '',
  poster       text,                          -- poster URL or demo palette index
  is_sample    boolean not null default false,
  checked_at   timestamptz not null default now(), -- when availability was last checked (CM-04)
  created_at   timestamptz not null default now()
);

create table public.movie_availability (
  movie_id     text not null references public.movies (id) on delete cascade,
  service      text not null check (service in ('netflix', 'prime', 'paramount', 'disney', 'hulu', 'apple', 'hbo', 'tubi')),
  type         text not null check (type in ('subscription', 'free', 'rent')),
  primary key (movie_id, service, type)
);

-- The catalog is public: anyone, logged in or not, can read it. Nobody can
-- write to it through the public key; imports use the secret key, which
-- bypasses row-level security and never leaves Vercel/GitHub settings.
alter table public.movies enable row level security;
alter table public.movie_availability enable row level security;

create policy "Anyone can read movies"
  on public.movies for select
  to anon, authenticated
  using (true);

create policy "Anyone can read availability"
  on public.movie_availability for select
  to anon, authenticated
  using (true);

-- Favorites -----------------------------------------------------------------
-- Deleting a user (CM-08) deletes their favorites too.

create table public.favorites (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  movie_id     text not null references public.movies (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, movie_id)
);

alter table public.favorites enable row level security;

create policy "Viewers read their own favorites"
  on public.favorites for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Viewers add their own favorites"
  on public.favorites for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Viewers remove their own favorites"
  on public.favorites for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Access --------------------------------------------------------------------
-- The project doesn't auto-expose new tables, so each table is granted to the
-- public roles explicitly. Row-level security above still limits which rows.
-- Every future table needs its own grant here, or the app gets "permission denied".
-- The secret key (service_role) needs grants too; see 0003_service_role_grants.sql.

grant select on public.movies, public.movie_availability to anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
