-- TEST PROJECT ONLY. No customer-data access or account mutations.
begin;
create schema if not exists atlas_private;
revoke all on schema atlas_private from public, anon, authenticated;
create table atlas_private.admin_emails (
  email text primary key check (email = lower(email))
);
alter table atlas_private.admin_emails enable row level security;
revoke all on atlas_private.admin_emails from public, anon, authenticated;
create function public.atlas_admin_accounts() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (
    select 1 from auth.users u join atlas_private.admin_emails a
      on a.email = lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  ) then raise exception 'Admin access required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total', (select count(*) from auth.users where email is not null),
    'signed_in_7_days', (select count(*) from auth.users where email is not null and last_sign_in_at >= now() - interval '7 days'),
    'accounts', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select u.id, u.email, u.created_at, u.last_sign_in_at,
        (u.email_confirmed_at is not null) as verified,
        (select count(*) from public.atlas d where d.owner_id=u.id and d.path like 'vehicles/%') as cars,
        (select count(*) from public.atlas d where d.owner_id=u.id and d.path like 'rentals/%') as rentals
      from auth.users u where u.email is not null order by u.created_at desc, u.id limit 200
    ) x),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.atlas_admin_accounts() from public, anon;
grant execute on function public.atlas_admin_accounts() to authenticated;
notify pgrst, 'reload schema';
commit;
