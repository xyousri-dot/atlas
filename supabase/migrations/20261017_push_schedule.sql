-- Replace <PUBLIC_ANON_JWT> with the project's PUBLIC legacy anon JWT.
-- Private dispatcher secret must already exist in Vault as atlas_phone_cron_secret.
-- No private keys belong in this file or the cron command.
select cron.schedule(
  'atlas-phone-pilot-hourly',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://mimpyfbitoiotxuqoymj.supabase.co/functions/v1/atlas-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','<PUBLIC_ANON_JWT>',
      'Authorization','Bearer <PUBLIC_ANON_JWT>',
      'x-atlas-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='atlas_phone_cron_secret' limit 1)
    ),
    body := '{"action":"dispatch"}'::jsonb,
    timeout_milliseconds := 10000
  ) where extract(hour from now() at time zone 'Africa/Casablanca')=9
    or exists(select 1 from public.atlas_push_devices where test_due_at<=now());
  $job$
);
