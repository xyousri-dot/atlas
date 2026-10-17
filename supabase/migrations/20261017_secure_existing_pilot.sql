-- Existing pilot: 39 rows, exactly one account observed before migration.
-- Fail rather than guess ownership if the account count has changed.
begin;
lock table public.atlas in access exclusive mode;
do $$ begin
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Expected exactly one existing pilot account; inspect ownership first';
  end if;
end $$;
alter table public.atlas add column owner_id uuid references auth.users(id);
update public.atlas set owner_id = (select id from auth.users);
alter table public.atlas alter column owner_id set default auth.uid();
alter table public.atlas alter column owner_id set not null;
alter table public.atlas drop constraint atlas_pkey;
alter table public.atlas add primary key (owner_id, path);
alter table public.atlas enable row level security;
drop policy if exists "atlas lezen" on public.atlas;
drop policy if exists "atlas toevoegen" on public.atlas;
drop policy if exists "atlas wijzigen" on public.atlas;
drop policy if exists "atlas wissen" on public.atlas;
revoke all on public.atlas from anon;
revoke all on public.atlas from authenticated;
grant select, insert, update, delete on public.atlas to authenticated;
create policy atlas_select_own on public.atlas for select to authenticated using ((select auth.uid()) = owner_id);
create policy atlas_insert_own on public.atlas for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy atlas_update_own on public.atlas for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy atlas_delete_own on public.atlas for delete to authenticated using ((select auth.uid()) = owner_id);
notify pgrst, 'reload schema';
commit;
