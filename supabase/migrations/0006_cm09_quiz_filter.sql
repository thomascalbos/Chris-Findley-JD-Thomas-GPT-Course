-- CM-09: The quiz on the real catalog
-- Run once in the Supabase SQL editor, after 0005.
--
-- quiz_movies returns the movies that fit a set of quiz answers. The quiz
-- counts them as the viewer answers (CM-09); the recommendation ranks them
-- (CM-10). Each filter matches a rule in web/app/engine.ts, and an answer
-- that's missing from f doesn't filter at all. The app builds f in
-- web/app/quiz-filter.ts:
--
--   genres      any of these genres            ["Comedy", "Adventure"]
--   maxRuntime  shorter than this many minutes 120
--   mood        this mood tag                  "Light and funny"
--   ratings     one of these US ratings        ["PG", "PG-13"]
--   minScore    at least this audience score   3.5
--   minYear     released this year or later    2016
--   maxYear     released this year or earlier  2015
--   attention   this attention level           "easy"
--   services    included or free on one of these (rentals don't count)

create or replace function public.quiz_movies(f jsonb)
returns setof public.movies
language sql
stable
set search_path = ''
as $$
  select m.*
  from public.movies m
  where (f->'genres' is null or m.genres && array(select jsonb_array_elements_text(f->'genres')))
    and (f->'maxRuntime' is null or m.runtime < (f->>'maxRuntime')::int)
    and (f->'mood' is null or (f->>'mood') = any (m.moods))
    and (f->'ratings' is null or m.rating = any (array(select jsonb_array_elements_text(f->'ratings'))))
    and (f->'minScore' is null or m.score >= (f->>'minScore')::numeric)
    and (f->'minYear' is null or m.year >= (f->>'minYear')::int)
    and (f->'maxYear' is null or m.year <= (f->>'maxYear')::int)
    and (f->'attention' is null or m.attention = f->>'attention')
    and (f->'services' is null or exists (
      select 1
      from public.movie_availability a
      where a.movie_id = m.id
        and a.type <> 'rent'
        and a.service = any (array(select jsonb_array_elements_text(f->'services')))
    ));
$$;

-- Logged-in viewers only, like the quiz itself.
revoke execute on function public.quiz_movies(jsonb) from public, anon;
grant execute on function public.quiz_movies(jsonb) to authenticated;
