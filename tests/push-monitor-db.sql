-- atlas-test only. All fixtures are rolled back, never sent to a device.
begin;
do $$
declare owner uuid;device uuid;job uuid;token uuid;claimed jsonb;report jsonb;
begin
 if not exists(select 1 from cron.job where active and command like '%manikkusokwysmdfhxtu.supabase.co/functions/v1/atlas-push%' and command like '%atlas_push_outbox%') then raise exception 'Retry scheduler missing';end if;
 select u.id into owner from auth.users u join atlas_private.admin_emails a on a.email=lower(u.email) where u.email_confirmed_at is not null limit 1;
 if owner is null then raise exception 'Confirmed test admin prerequisite';end if;
 if has_table_privilege('authenticated','public.atlas_push_outbox','SELECT') or has_function_privilege('authenticated','public.atlas_push_claim(uuid)','EXECUTE') or has_function_privilege('anon','public.atlas_admin_push()','EXECUTE') then raise exception 'Privilege isolation failed';end if;
 insert into public.atlas_push_devices(owner_id,endpoint,subscription) values(owner,'https://web.push.apple.com/FICTITIOUS-SQL-TEST-'||gen_random_uuid(),'{}') returning id into device;
 job:=public.atlas_push_enqueue(owner,device,'TEST-SQL-ROLLBACK','{"body":"FICTITIOUS TEST"}'::jsonb);
 if public.atlas_push_enqueue(owner,device,'TEST-SQL-ROLLBACK','{}')<>job then raise exception 'Duplicate enqueue';end if;
 claimed:=public.atlas_push_claim(job);token:=(claimed->>'receipt_token')::uuid;
 if claimed->>'state'<>'sending' or public.atlas_push_claim(job) is not null then raise exception 'Claim serialization';end if;
 perform public.atlas_push_result(job,99,'accepted');
 if (select state from public.atlas_push_outbox where id=job)<>'sending' then raise exception 'Stale attempt overwrite';end if;
 perform public.atlas_push_result(job,1,'failed','503');
 if public.atlas_push_claim(job) is not null then raise exception 'Backoff ignored';end if;
 update public.atlas_push_outbox set next_attempt_at=now()-interval '1 second' where id=job;
 if public.atlas_push_claim(job)->>'attempts'<>'2' then raise exception 'Retry not claimed';end if;
 perform public.atlas_push_result(job,2,'accepted');
 if public.atlas_push_claim(job) is not null then raise exception 'Accepted was blindly resent';end if;
 if public.atlas_push_ack(job,gen_random_uuid(),'received') then raise exception 'Invalid receipt accepted';end if;
 if not public.atlas_push_ack(job,token,'received') or not public.atlas_push_ack(job,token,'opened') then raise exception 'Receipt missing';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.atlas_admin_push();raise exception 'Non-admin admitted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 if public.atlas_admin_push_retry(job) then raise exception 'Received alert resent';end if;
 report:=public.atlas_admin_push();
 if not exists(select 1 from jsonb_array_elements(report->'items') x where x->>'id'=job::text and x->>'status'='opened') then raise exception 'Admin receipt status missing';end if;
 -- Ambiguous attempt remains visible; deliberate retry is rate-limited.
 update public.atlas_push_outbox set received_at=null,opened_at=null,state='unknown',attempted_at=now()-interval '11 minutes' where id=job;
 if not public.atlas_admin_push_retry(job) or public.atlas_admin_push_retry(job) then raise exception 'Manual retry is not idempotent';end if;
 if public.atlas_push_claim(job)->>'attempts'<>'3' then raise exception 'Third claim failed';end if;
 perform public.atlas_push_result(job,3,'failed','429');
 update public.atlas_push_outbox set next_attempt_at=now()-interval '1 second',attempted_at=now()-interval '11 minutes' where id=job;
 if public.atlas_push_claim(job) is not null or public.atlas_admin_push_retry(job) then raise exception 'Retry limit ignored';end if;
 if report::text like '%receipt_token%' or report::text like '%subscription%' then raise exception 'Admin report leaked capability';end if;
 job:=public.atlas_push_enqueue(owner,device,'TEST-SQL-EXPIRED','{"body":"FICTITIOUS"}');
 perform public.atlas_push_claim(job);perform public.atlas_push_result(job,1,'gone','410');
 if (select disabled_at from public.atlas_push_devices where id=device) is null then raise exception 'Expired device not disabled';end if;
end $$;
select 'PASS: database claims, retry/backoff/limit, receipts, admin isolation; fixtures rolled back' as verification;
rollback;
