-- CM-06: Movie search
-- Run once in the Supabase SQL editor.
--
-- Title search that tolerates a one-letter typo ("Matrx" finds The Matrix),
-- using Postgres's built-in trigram matching (pg_trgm).

create extension if not exists pg_trgm with schema extensions;

create index if not exists movies_title_trgm
  on public.movies using gin (title extensions.gin_trgm_ops);

-- Returns up to max_results movies, best match first: titles that start with
-- the search, then titles that contain it, then near-misses by spelling.
-- Ties go to the better-known movie (more TMDB votes).
create or replace function public.search_movies(q text, max_results int default 20)
returns table (id text, title text, year int, rating text, poster text)
language sql
stable
set search_path = ''
as $$
  with s as (
    -- The trimmed search, plus a copy with % and _ escaped so they match literally.
    select trim(q) as t,
           replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') as lit
  )
  select m.id, m.title, m.year, m.rating, m.poster
  from public.movies m, s
  where length(s.t) >= 2
    and (
      m.title ilike '%' || s.lit || '%'
      or extensions.word_similarity(s.t, m.title) >= 0.45
    )
  order by
    (m.title ilike s.lit || '%') desc,
    (m.title ilike '%' || s.lit || '%') desc,
    extensions.word_similarity(s.t, m.title) desc,
    m.vote_count desc nulls last
  limit least(greatest(max_results, 1), 50);
$$;

-- Logged-in viewers only, like every page that uses it.
revoke execute on function public.search_movies(text, int) from public, anon;
grant execute on function public.search_movies(text, int) to authenticated;
