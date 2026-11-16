-- CM-04: Weekly data refresh
-- Run once in the Supabase SQL editor, after 0006.
--
-- Every Monday a GitHub Actions workflow (.github/workflows/weekly-refresh.yml)
-- runs web/scripts/refresh-availability.mts, which asks TMDB for each movie's
-- current US streaming services, updates movie_availability, and stamps
-- movies.checked_at. Each service a movie gains or loses is recorded here with
-- its date. Alerts (CM-15) will read these rows to know when a movie joins a
-- viewer's service.

create table public.availability_changes (
  id           bigint generated always as identity primary key,
  movie_id     text not null references public.movies (id) on delete cascade,
  service      text not null check (service in ('netflix', 'prime', 'paramount', 'disney', 'hulu', 'apple', 'hbo', 'tubi')),
  type         text not null check (type in ('subscription', 'free', 'rent')),
  change       text not null check (change in ('added', 'removed')),
  changed_at   timestamptz not null default now()
);

create index availability_changes_movie_idx on public.availability_changes (movie_id, changed_at desc);
create index availability_changes_changed_at_idx on public.availability_changes (changed_at desc);

-- Only the refresh (secret key) reads and writes this for now. Row-level
-- security with no policies keeps it closed to the public key; CM-15 can add
-- a read policy if alerts need one.
alter table public.availability_changes enable row level security;

-- See 0003: new tables need an explicit grant for the secret key.
grant select, insert, update, delete on public.availability_changes to service_role;
