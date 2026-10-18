-- DRAFT ONLY. Not applied. Requires the existing owner-isolated public.atlas table.
begin;
create table public.atlas_push_devices (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 endpoint text unique not null,
 subscription jsonb not null,
 language text not null default 'fr' check(language in ('fr','nl','ar')),
 created_at timestamptz not null default now()
);
create table public.atlas_push_deliveries (
 device_id uuid not null references public.atlas_push_devices(id) on delete cascade,
 delivery_key text not null,
 created_at timestamptz not null default now(),
 primary key(device_id,delivery_key)
);
alter table public.atlas_push_devices enable row level security;
alter table public.atlas_push_deliveries enable row level security;
revoke all on public.atlas_push_devices,public.atlas_push_deliveries from anon,authenticated;
-- All access through the authenticated Edge Function, never a direct client insert.
grant all on public.atlas_push_devices,public.atlas_push_deliveries to service_role;
commit;
