-- Run only on atlas-test. No images, names, numbers or readings stored here.
begin;
create table public.atlas_test_scan_calls(owner_id uuid not null references auth.users(id) on delete cascade,request_id text not null,created_at timestamptz not null default now(),primary key(owner_id,request_id));
alter table public.atlas_test_scan_calls enable row level security;
revoke all on public.atlas_test_scan_calls from public,anon,authenticated;
create function public.atlas_test_reserve_scan(p_owner uuid,p_request text) returns text language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(1820261018);
 if exists(select 1 from public.atlas_test_scan_calls where owner_id=p_owner and request_id=p_request) then return 'duplicate'; end if;
 if (select count(*) from public.atlas_test_scan_calls where created_at>=date_trunc('day',now()))>=20 or (select count(*) from public.atlas_test_scan_calls where owner_id=p_owner and created_at>now()-interval '1 minute')>=3 then return 'limit'; end if;
 insert into public.atlas_test_scan_calls(owner_id,request_id) values(p_owner,p_request);
 return 'allowed';
end;$$;
revoke all on function public.atlas_test_reserve_scan(uuid,text) from public,anon,authenticated;
grant execute on function public.atlas_test_reserve_scan(uuid,text) to service_role;
commit;
