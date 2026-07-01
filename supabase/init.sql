-- =============================================================================
-- One Home (dayta) — Consolidated init schema
-- Apply once to a fresh Supabase project:
--   psql "$DATABASE_URL" -f supabase/init.sql
-- Or via Supabase CLI:
--   supabase db push   (after copying this into supabase/migrations/0000_init.sql)
--
-- This is idempotent: safe to re-run. Storage buckets + storage.objects
-- policies live here too (run as the postgres role).
-- =============================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Helper: updated_at trigger ----------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- Tables
-- =============================================================================

-- ---------- items ----------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  purchase_date date,
  expiry_date date not null,
  reminder_days integer not null default 7,
  notes text,
  document_url text,
  details jsonb not null default '{}'::jsonb,
  details_complete boolean not null default false,
  visibility text not null default 'personal'
    check (visibility in ('personal','shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_user_id_idx on public.items(user_id);
create index if not exists items_expiry_date_idx on public.items(expiry_date);

-- ---------- documents ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size bigint not null default 0,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_item_id_idx on public.documents(item_id);
create index if not exists documents_user_id_idx on public.documents(user_id);

-- ---------- reminders ----------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id uuid references public.items(id) on delete set null,
  title text not null,
  reminder_type text not null default 'Other',
  reminder_date date not null,
  notes text,
  notify_days_before integer not null default 1,
  recurrence text not null default 'none',
  recurrence_custom_days integer,
  ends_type text not null default 'never',
  ends_after_count integer,
  ends_on_date date,
  status text not null default 'active',
  snoozed_until date,
  completed_at timestamptz,
  visibility text not null default 'personal'
    check (visibility in ('personal','shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reminders_user_date on public.reminders(user_id, reminder_date);

-- ---------- reminder_completions ----------
create table if not exists public.reminder_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_type text not null check (source_type in ('reminder','item')),
  source_id uuid not null,
  title text not null,
  reminder_type text not null,
  original_date date not null,
  recurrence text not null default 'none',
  completed_at timestamptz not null default now()
);
create index if not exists reminder_completions_user_idx
  on public.reminder_completions(user_id, completed_at desc);
create index if not exists reminder_completions_source_idx
  on public.reminder_completions(source_type, source_id);

-- ---------- shares ----------
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  resource_type text not null check (resource_type in ('item','reminder')),
  resource_id uuid not null,
  member_user_id uuid not null,
  role text not null default 'viewer' check (role in ('viewer','editor')),
  created_at timestamptz not null default now(),
  unique (resource_type, resource_id, member_user_id)
);
create index if not exists shares_resource_idx on public.shares(resource_type, resource_id);
create index if not exists shares_member_idx
  on public.shares(member_user_id, resource_type, resource_id);

-- ---------- share_invites ----------
create table if not exists public.share_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  resource_type text not null check (resource_type in ('item','reminder')),
  resource_id uuid not null,
  role text not null default 'viewer' check (role in ('viewer','editor')),
  email text,
  token text not null unique,
  revoked boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists share_invites_owner_idx on public.share_invites(owner_id);
create index if not exists share_invites_resource_idx
  on public.share_invites(resource_type, resource_id);

-- ---------- backups ----------
create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  size bigint not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists backups_user_id_idx on public.backups(user_id);

-- =============================================================================
-- GRANTS  (required — PostgREST needs explicit privileges on public schema)
-- =============================================================================
grant select, insert, update, delete on public.items                to authenticated;
grant select, insert, update, delete on public.documents            to authenticated;
grant select, insert, update, delete on public.reminders            to authenticated;
grant select, insert, update, delete on public.reminder_completions to authenticated;
grant select, insert, update, delete on public.shares               to authenticated;
grant select, insert, update, delete on public.share_invites        to authenticated;
grant select, insert, update, delete on public.backups              to authenticated;

grant all on public.items, public.documents, public.reminders,
            public.reminder_completions, public.shares,
            public.share_invites, public.backups
  to service_role;

-- =============================================================================
-- Security definer helpers
-- =============================================================================
create or replace function public.has_share_access(
  _resource_type text,
  _resource_id uuid,
  _min_role text default 'viewer'
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shares s
    where s.resource_type = _resource_type
      and s.resource_id   = _resource_id
      and s.member_user_id = auth.uid()
      and (
        _min_role = 'viewer'
        or (_min_role = 'editor' and s.role = 'editor')
      )
  );
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.items                enable row level security;
alter table public.documents            enable row level security;
alter table public.reminders            enable row level security;
alter table public.reminder_completions enable row level security;
alter table public.shares               enable row level security;
alter table public.share_invites        enable row level security;
alter table public.backups              enable row level security;

-- ---------- items policies ----------
drop policy if exists "Items: users insert their own"          on public.items;
drop policy if exists "Items: owner or shared member can view" on public.items;
drop policy if exists "Items: owner or editor can update"      on public.items;
drop policy if exists "Items: only owner can delete"           on public.items;

create policy "Items: users insert their own" on public.items
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Items: owner or shared member can view" on public.items
  for select to authenticated
  using (
    auth.uid() = user_id
    or (visibility = 'shared' and public.has_share_access('item', id, 'viewer'))
  );

create policy "Items: owner or editor can update" on public.items
  for update to authenticated
  using (
    auth.uid() = user_id
    or (visibility = 'shared' and public.has_share_access('item', id, 'editor'))
  );

create policy "Items: only owner can delete" on public.items
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------- documents policies ----------
drop policy if exists "Owners can insert their documents" on public.documents;
drop policy if exists "Owners can view their documents"   on public.documents;
drop policy if exists "Owners can update their documents" on public.documents;
drop policy if exists "Owners can delete their documents" on public.documents;

create policy "Owners can insert their documents" on public.documents
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Owners can view their documents" on public.documents
  for select to authenticated
  using (
    auth.uid() = user_id
    or public.has_share_access('item', item_id, 'viewer')
  );

create policy "Owners can update their documents" on public.documents
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Owners can delete their documents" on public.documents
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------- reminders policies ----------
drop policy if exists "Reminders: users insert their own"          on public.reminders;
drop policy if exists "Reminders: owner or shared member can view" on public.reminders;
drop policy if exists "Reminders: owner or editor can update"      on public.reminders;
drop policy if exists "Reminders: only owner can delete"           on public.reminders;

create policy "Reminders: users insert their own" on public.reminders
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Reminders: owner or shared member can view" on public.reminders
  for select to authenticated
  using (
    auth.uid() = user_id
    or (visibility = 'shared' and public.has_share_access('reminder', id, 'viewer'))
  );

create policy "Reminders: owner or editor can update" on public.reminders
  for update to authenticated
  using (
    auth.uid() = user_id
    or (visibility = 'shared' and public.has_share_access('reminder', id, 'editor'))
  );

create policy "Reminders: only owner can delete" on public.reminders
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------- reminder_completions policies ----------
drop policy if exists "Completions: users manage their own" on public.reminder_completions;
create policy "Completions: users manage their own" on public.reminder_completions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- shares policies ----------
drop policy if exists "Shares: only owner can insert"      on public.shares;
drop policy if exists "Shares: owner or member can view"   on public.shares;
drop policy if exists "Shares: only owner can update"      on public.shares;
drop policy if exists "Shares: owner or member can delete" on public.shares;

create policy "Shares: only owner can insert" on public.shares
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "Shares: owner or member can view" on public.shares
  for select to authenticated
  using (auth.uid() = owner_id or auth.uid() = member_user_id);

create policy "Shares: only owner can update" on public.shares
  for update to authenticated
  using (auth.uid() = owner_id);

create policy "Shares: owner or member can delete" on public.shares
  for delete to authenticated
  using (auth.uid() = owner_id or auth.uid() = member_user_id);

-- ---------- share_invites policies ----------
drop policy if exists "Invites: owner can insert" on public.share_invites;
drop policy if exists "Invites: owner can view"   on public.share_invites;
drop policy if exists "Invites: owner can update" on public.share_invites;
drop policy if exists "Invites: owner can delete" on public.share_invites;

create policy "Invites: owner can insert" on public.share_invites
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "Invites: owner can view" on public.share_invites
  for select to authenticated using (auth.uid() = owner_id);
create policy "Invites: owner can update" on public.share_invites
  for update to authenticated using (auth.uid() = owner_id);
create policy "Invites: owner can delete" on public.share_invites
  for delete to authenticated using (auth.uid() = owner_id);

-- ---------- backups policies ----------
drop policy if exists "Users manage their own backups" on public.backups;
create policy "Users manage their own backups" on public.backups
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- Triggers (updated_at)
-- =============================================================================
drop trigger if exists update_items_updated_at     on public.items;
drop trigger if exists update_documents_updated_at on public.documents;
drop trigger if exists update_reminders_updated_at on public.reminders;

create trigger update_items_updated_at     before update on public.items
  for each row execute function public.update_updated_at_column();
create trigger update_documents_updated_at before update on public.documents
  for each row execute function public.update_updated_at_column();
create trigger update_reminders_updated_at before update on public.reminders
  for each row execute function public.update_updated_at_column();

-- =============================================================================
-- Storage bucket + storage.objects policies
-- (Buckets can also be created with scripts/setup-storage.ts via service role.)
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "Users upload their own document files"     on storage.objects;
drop policy if exists "Users read their own document files"       on storage.objects;
drop policy if exists "Users update their own document files"     on storage.objects;
drop policy if exists "Users delete their own document files"     on storage.objects;
drop policy if exists "Shared collaborators read document files"  on storage.objects;

create policy "Users upload their own document files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read their own document files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update their own document files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete their own document files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Shared collaborators read document files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = storage.objects.name
        and public.has_share_access('item', d.item_id, 'viewer')
    )
  );
