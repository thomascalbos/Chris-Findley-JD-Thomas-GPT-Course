-- CM-07: Account setup
-- Run once in the Supabase SQL editor, after 0004.
--
-- Saves each viewer's streaming services and whether they've finished (or
-- skipped) setup, and caps favorites at five in the database itself.

create table public.profiles (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  services       text[] not null default '{}'
                 check (services <@ array['netflix', 'prime', 'paramount', 'disney', 'hulu', 'apple', 'hbo', 'tubi']),
  setup_done_at  timestamptz,  -- null until setup is finished or skipped; then setup isn't shown again
  updated_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Viewers read their own profile"
  on public.profiles for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Viewers create their own profile"
  on public.profiles for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Viewers update their own profile"
  on public.profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Delete account (CM-08) clears the profile; the login itself stays (see CM-03).
create policy "Viewers delete their own profile"
  on public.profiles for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- Five favorites at most, even if the app is bypassed.
create function public.favorites_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.favorites where user_id = new.user_id) >= 5 then
    raise exception 'A viewer can save at most 5 favorites' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger favorites_limit
  before insert on public.favorites
  for each row execute function public.favorites_limit();
