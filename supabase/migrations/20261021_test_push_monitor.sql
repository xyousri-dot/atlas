-- Apply ONLY to atlas-test (manikkusokwysmdfhxtu). Additive; keeps old records.
begin;
do $$ begin
 if to_regclass('atlas_private.admin_emails') is null then raise exception 'atlas-test admin prerequisite missing'; end if;
end $$;
alter table public.atlas_push_devices add column if not exists disabled_at timestamptz;
create table if not exists public.atlas_push_outbox (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid references public.atlas_push_devices(id) on delete set null,
 delivery_key text not null,
 payload jsonb not null,
 receipt_token uuid not null default gen_random_uuid(),
 state text not null default 'queued' check(state in ('queued','sending','accepted','failed','unknown','gone','cancelled')),
 attempts int not null default 0,
 created_at timestamptz not null default now(),
 attempted_at timestamptz,
 accepted_at timestamptz,
 received_at timestamptz,
 opened_at timestamptz,
 display_error_at timestamptz,
 next_attempt_at timestamptz default now(),
 error_code text,
 unique(device_id,delivery_key)
);
alter table public.atlas_push_outbox enable row level security;
revoke all on public.atlas_push_outbox from public,anon,authenticated;
grant all on public.atlas_push_outbox to service_role;
create index if not exists atlas_push_outbox_due on public.atlas_push_outbox(next_attempt_at) where state in ('queued','failed');
-- Existing claims have no outcome/receipt information. Preserve them honestly
-- as unknown, and don't resend yesterday's unrecorded message body.
insert into public.atlas_push_outbox(owner_id,device_id,delivery_key,payload,state,attempts,created_at,attempted_at,next_attempt_at,error_code)
select d.owner_id,c.device_id,c.delivery_key,'{}'::jsonb,'unknown',1,c.created_at,c.created_at,null,'legacy-no-receipt'
from public.atlas_push_deliveries c join public.atlas_push_devices d on d.id=c.device_id
on conflict(device_id,delivery_key) do nothing;

create or replace function public.atlas_push_enqueue(p_owner uuid,p_device uuid,p_key text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not exists(select 1 from public.atlas_push_devices where id=p_device and owner_id=p_owner) then raise exception 'device'; end if;
 insert into public.atlas_push_outbox(owner_id,device_id,delivery_key,payload) values(p_owner,p_device,p_key,p_payload)
 on conflict(device_id,delivery_key) do nothing returning id into result;
 if result is null then select id into result from public.atlas_push_outbox where device_id=p_device and delivery_key=p_key; end if;
 return result;
end $$;

create or replace function public.atlas_push_claim(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.atlas_push_outbox; sub jsonb;
begin
 -- Atomic claim: concurrent jobs cannot send the same attempt twice.
 update public.atlas_push_outbox set state='sending',attempts=attempts+1,attempted_at=now(),next_attempt_at=null
 where id=p_id and state in ('queued','failed') and attempts<3 and received_at is null and opened_at is null
 and next_attempt_at<=now() and device_id is not null returning * into q;
 if q.id is null then return null; end if;
 select subscription into sub from public.atlas_push_devices where id=q.device_id and owner_id=q.owner_id and disabled_at is null;
 if sub is null then update public.atlas_push_outbox set state='gone',error_code='device-missing' where id=p_id;return null;end if;
 return to_jsonb(q)||jsonb_build_object('subscription',sub);
end $$;

create or replace function public.atlas_push_result(p_id uuid,p_attempt int,p_state text,p_code text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_state not in ('accepted','failed','unknown','gone') then raise exception 'state';end if;
 update public.atlas_push_outbox set state=p_state,error_code=left(p_code,50),
 accepted_at=case when p_state='accepted' then now() else accepted_at end,
 next_attempt_at=case when p_state='failed' and attempts<3 then now()+case when attempts=1 then interval '1 minute' else interval '5 minutes' end else null end
 where id=p_id and attempts=p_attempt and state='sending';
 if p_state='gone' then update public.atlas_push_devices set disabled_at=now() where id=(select device_id from public.atlas_push_outbox where id=p_id and attempts=p_attempt and state='gone');end if;
end $$;

create or replace function public.atlas_push_due() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 update public.atlas_push_outbox set state='gone',error_code='device-removed',next_attempt_at=null where device_id is null and received_at is null and state in ('queued','sending','failed','accepted','unknown');
 -- A process that died after sending is uncertain, not safe to blindly retry.
 update public.atlas_push_outbox set state='unknown',error_code='interrupted',next_attempt_at=null where state='sending' and attempted_at<now()-interval '2 minutes';
 select coalesce(jsonb_agg(id),'[]'::jsonb) into result from (select id from public.atlas_push_outbox where state in ('queued','failed') and attempts<3 and next_attempt_at<=now() and received_at is null and opened_at is null order by next_attempt_at limit 50) q;
 return result;
end $$;

create or replace function public.atlas_push_ack(p_id uuid,p_token uuid,p_event text) returns boolean
language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if p_event not in ('received','opened','display-error') then return false;end if;
 update public.atlas_push_outbox set
 received_at=case when p_event in ('received','opened') then coalesce(received_at,now()) else received_at end,
 opened_at=case when p_event='opened' then coalesce(opened_at,now()) else opened_at end,
 display_error_at=case when p_event='display-error' then coalesce(display_error_at,now()) else display_error_at end,
 next_attempt_at=null
 where id=p_id and receipt_token=p_token and created_at>now()-interval '30 days';
 get diagnostics n=row_count;return n=1;
end $$;

create or replace function public.atlas_admin_push() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from auth.users u join atlas_private.admin_emails a on a.email=lower(u.email) where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'Admin access required' using errcode='42501';end if;
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb),'limited',true,
 'without_device',(select count(*) from auth.users u where not exists(select 1 from public.atlas_push_devices d where d.owner_id=u.id and d.disabled_at is null))) into result from (
 select q.id,u.email,q.delivery_key,q.created_at,q.attempts,q.accepted_at,q.received_at,q.opened_at,q.next_attempt_at,q.error_code,
 case when q.opened_at is not null then 'opened' when q.received_at is not null then 'received' when q.display_error_at is not null then 'display-error' when q.state='accepted' and q.accepted_at<now()-interval '10 minutes' then 'unconfirmed' else q.state end as status,
 (q.payload ? 'body' and q.device_id is not null and q.attempts<3 and q.received_at is null and q.opened_at is null and q.state in ('failed','unknown','accepted') and coalesce(q.attempted_at,q.created_at)<now()-interval '10 minutes') as can_retry
 from public.atlas_push_outbox q left join auth.users u on u.id=q.owner_id order by q.created_at desc limit 200
 ) x;
 return result;
end $$;

create or replace function public.atlas_admin_push_retry(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if not exists(select 1 from auth.users u join atlas_private.admin_emails a on a.email=lower(u.email) where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'Admin access required' using errcode='42501';end if;
 update public.atlas_push_outbox set state='queued',next_attempt_at=now() where id=p_id and payload ? 'body' and device_id is not null and attempts<3 and received_at is null and opened_at is null and state in ('failed','unknown','accepted') and coalesce(attempted_at,created_at)<now()-interval '10 minutes';
 get diagnostics n=row_count;return n=1;
end $$;

revoke all on function public.atlas_push_enqueue(uuid,uuid,text,jsonb),public.atlas_push_claim(uuid),public.atlas_push_result(uuid,int,text,text),public.atlas_push_due(),public.atlas_push_ack(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.atlas_push_enqueue(uuid,uuid,text,jsonb),public.atlas_push_claim(uuid),public.atlas_push_result(uuid,int,text,text),public.atlas_push_due(),public.atlas_push_ack(uuid,uuid,text) to service_role;
revoke all on function public.atlas_admin_push(),public.atlas_admin_push_retry(uuid) from public,anon;
grant execute on function public.atlas_admin_push(),public.atlas_admin_push_retry(uuid) to authenticated;

-- Keep the existing authenticated cron request and its Vault secret untouched.
-- Wake the same test job for retry work outside the 09:00 summary window.
do $$ declare j record;begin
 for j in select jobid,jobname,schedule,command from cron.job where command like '%manikkusokwysmdfhxtu.supabase.co/functions/v1/atlas-push%' and command not like '%atlas_push_outbox%' loop
 perform cron.schedule(j.jobname,j.schedule,regexp_replace(j.command,';\s*$','')||' or exists(select 1 from public.atlas_push_outbox where (state in (''queued'',''failed'') and next_attempt_at<=now()) or (state=''sending'' and attempted_at<now()-interval ''2 minutes''));');
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
