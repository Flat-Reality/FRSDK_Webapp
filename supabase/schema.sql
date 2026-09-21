-- AnyChannel alpha schema for a NEW, separate Supabase project.
-- Run once in the Supabase SQL Editor. Do not run against flatreality.eu's project.
-- No customer channels, FR categories, billing entitlements or public delivery are created here.

create table if not exists public.anychannel_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  organization text not null check (char_length(organization) between 1 and 120),
  plan text not null default 'cloud_trial' check (plan in ('cloud_trial', 'cloud', 'expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.anychannel_transmissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  excerpt text not null default 'Draft in progress.' check (char_length(excerpt) between 1 and 320),
  content jsonb not null default '{"blocks":[]}'::jsonb check (jsonb_typeof(content->'blocks') = 'array'),
  cover_url text,
  cover_path text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug),
  check (status = 'draft' or published_at is not null)
);

create index if not exists anychannel_transmissions_owner_updated_idx
  on public.anychannel_transmissions (owner_id, updated_at desc);

create table if not exists public.anychannel_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  size_bytes bigint not null check (size_bytes between 1 and 6291456),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  created_at timestamptz not null default now(),
  check (split_part(object_path, '/', 1) = owner_id::text)
);

alter table public.anychannel_profiles enable row level security;
alter table public.anychannel_transmissions enable row level security;
alter table public.anychannel_media enable row level security;

-- Explicit grants are required on newer Supabase projects; grants never replace RLS.
revoke all on public.anychannel_profiles from anon, authenticated;
revoke all on public.anychannel_transmissions from anon, authenticated;
revoke all on public.anychannel_media from anon, authenticated;
grant select on public.anychannel_profiles to authenticated;
grant insert (owner_id, name, organization) on public.anychannel_profiles to authenticated;
grant update (name, organization) on public.anychannel_profiles to authenticated;
grant select, insert, update, delete on public.anychannel_transmissions to authenticated;
grant select, insert on public.anychannel_media to authenticated;

create policy "Read own AnyChannel profile" on public.anychannel_profiles
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Create own AnyChannel profile" on public.anychannel_profiles
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Update own AnyChannel profile" on public.anychannel_profiles
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Read own AnyChannel transmissions" on public.anychannel_transmissions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Create own AnyChannel transmissions" on public.anychannel_transmissions
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Update own AnyChannel transmissions" on public.anychannel_transmissions
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Delete own AnyChannel transmissions" on public.anychannel_transmissions
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Read own AnyChannel media records" on public.anychannel_media
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Record own AnyChannel media" on public.anychannel_media
  for insert to authenticated with check (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anychannel-media', 'anychannel-media', true, 6291456,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "Upload only to own AnyChannel media folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'anychannel-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Read own AnyChannel media objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'anychannel-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Remove own AnyChannel media objects" on storage.objects
  for delete to authenticated
  using (bucket_id = 'anychannel-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
