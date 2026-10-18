create table public.atlas_scan_calls (
  owner_id uuid not null,
  request_id text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, request_id)
);

alter table public.atlas_scan_calls enable row level security;
revoke all on public.atlas_scan_calls from public, anon, authenticated;

create function public.atlas_reserve_scan(p_owner uuid, p_request text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(1820261019);
  if exists(select 1 from public.atlas_scan_calls where owner_id=p_owner and request_id=p_request) then return 'duplicate'; end if;
  if (select count(*) from public.atlas_scan_calls where created_at > now()-interval '1 day') >= 1000 then return 'limit'; end if;
  if (select count(*) from public.atlas_scan_calls where owner_id=p_owner and created_at > now()-interval '1 day') >= 100 then return 'limit'; end if;
  if (select count(*) from public.atlas_scan_calls where owner_id=p_owner and created_at > now()-interval '1 minute') >= 5 then return 'limit'; end if;
  insert into public.atlas_scan_calls(owner_id,request_id) values(p_owner,p_request);
  return 'allowed';
end;
$$;

revoke all on function public.atlas_reserve_scan(uuid,text) from public, anon, authenticated;
grant execute on function public.atlas_reserve_scan(uuid,text) to service_role;
