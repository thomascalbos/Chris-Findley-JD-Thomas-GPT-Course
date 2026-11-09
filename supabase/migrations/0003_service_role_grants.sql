-- CM-02: let the secret key write to the tables.
-- With "automatically expose new tables" off, new tables get no privileges for
-- any API role, including service_role (the secret key). Row-level security
-- doesn't apply to service_role, but table privileges still do, so the import
-- got "permission denied". Every future table needs a service_role grant too.

grant select, insert, update, delete on public.movies, public.movie_availability, public.favorites to service_role;
