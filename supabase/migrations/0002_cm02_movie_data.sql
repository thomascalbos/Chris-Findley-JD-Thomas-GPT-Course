-- CM-02: Movie data
-- Run once in the Supabase SQL editor, after 0001.
-- Adds the TMDB fields the import fills in. Real movies use ids like "tmdb-603"
-- (TMDB's own number), which never change, so favorites stay attached through
-- nightly refreshes (CM-04). The import deletes the sample movies once it finishes.

alter table public.movies
  add column release_date date,
  add column tmdb_genres  text[] not null default '{}',  -- TMDB's genre names, before mapping to the quiz's 12
  add column keywords     text[] not null default '{}',  -- TMDB keywords, used for tagging and later for similarity (CM-14)
  add column vote_count   integer,                       -- TMDB votes behind the audience score
  add column popularity   numeric;                       -- TMDB popularity, for well-known picks (CM-11)

-- The quiz filters on these; the catalog is small, but they keep queries quick.
create index movies_genres_idx on public.movies using gin (genres);
create index movie_availability_service_idx on public.movie_availability (service);
