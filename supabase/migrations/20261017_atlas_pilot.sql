-- Pilot: each account owns its own agency data. No shared staff access yet.
-- Intentionally fails if an atlas table already exists: inspect before migrating.
begin;
create table public.atlas (
  owner_id uuid not null default auth.uid() references auth.users(id),
  path text not null check (path ~ '^(settings|vehicles|rentals|clients|expenses)/[^/]+$'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (owner_id, path)
);
alter table public.atlas enable row level security;
revoke all on public.atlas from anon;
revoke all on public.atlas from authenticated;
grant select, insert, update, delete on public.atlas to authenticated;
create policy atlas_select_own on public.atlas for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy atlas_insert_own on public.atlas for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy atlas_update_own on public.atlas for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy atlas_delete_own on public.atlas for delete to authenticated
  using ((select auth.uid()) = owner_id);
notify pgrst, 'reload schema';
commit;
