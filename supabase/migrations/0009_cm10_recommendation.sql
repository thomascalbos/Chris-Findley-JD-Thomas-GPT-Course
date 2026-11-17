-- CM-10: Recommendation and "Not this one"
-- Run once in the Supabase SQL editor, after 0008.
--
-- watched      movies a viewer has seen, and whether they liked them. CM-10 saves
--              them from the pick's Already watched button; CM-12 adds logging any
--              movie from search, the Watched list, and keeping them out of picks.
-- pick_events  every pick shown and what the viewer did with it, with the session's
--              random seed, so CM-16 can replay sessions and compare versions.

create table public.watched (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  movie_id    text not null references public.movies (id) on delete cascade,
  liked       boolean,                     -- null = didn't say
  source      text not null check (source in ('pick', 'search', 'history')),
  watched_at  timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create table public.pick_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id  uuid not null,                -- one quiz, from the first pick to the last
  seed        bigint not null,              -- the session's random seed
  step        smallint not null,            -- 1 = first pick, 2 = the pick after that, ...
  movie_id    text not null references public.movies (id) on delete cascade,
  action      text not null check (action in ('shown', 'not_this_one', 'already_watched', 'watch')),
  detail      text,                         -- the Not this one reason, liked/disliked, or the service
  jump        jsonb,                        -- how this pick was chosen: {"from": "tmdb-603", "band": "close", "score": 0.41}
  created_at  timestamptz not null default now()
);

create index pick_events_session_idx on public.pick_events (session_id, step);

-- Each viewer reads and writes only their own rows (like favorites, CM-01).
alter table public.watched enable row level security;
alter table public.pick_events enable row level security;

create policy "Viewers read their own watched" on public.watched for select to authenticated using (user_id = auth.uid());
create policy "Viewers add their own watched" on public.watched for insert to authenticated with check (user_id = auth.uid());
create policy "Viewers update their own watched" on public.watched for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Viewers delete their own watched" on public.watched for delete to authenticated using (user_id = auth.uid());

create policy "Viewers read their own pick events" on public.pick_events for select to authenticated using (user_id = auth.uid());
create policy "Viewers add their own pick events" on public.pick_events for insert to authenticated with check (user_id = auth.uid());
-- Delete account (CM-08) removes these too.
create policy "Viewers delete their own pick events" on public.pick_events for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.watched to authenticated;
grant select, insert, delete on public.pick_events to authenticated;
-- See 0003: new tables need an explicit grant for the secret key.
grant select, insert, update, delete on public.watched, public.pick_events to service_role;
