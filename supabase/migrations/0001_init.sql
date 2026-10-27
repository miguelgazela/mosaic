-- 0001_init: schema milanote (shared Supabase project — touches only schema milanote + bucket milanote-files)
begin;

create schema if not exists milanote;
grant usage on schema milanote to authenticated;

do $$ begin
  create type milanote.element_type as enum ('note','image','file','link','todo','column','board','swatch');
exception when duplicate_object then null; end $$;

create or replace function milanote.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- members (allow-list) ------------------------------------------------------
create table if not exists milanote.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function milanote.is_member() returns boolean
language sql stable security definer set search_path = milanote, pg_temp as $$
  select exists (select 1 from milanote.members where user_id = auth.uid());
$$;
revoke all on function milanote.is_member() from public;
grant execute on function milanote.is_member() to authenticated;

-- boards --------------------------------------------------------------------
create table if not exists milanote.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_board_id uuid references milanote.boards(id) on delete cascade,
  is_home boolean not null default false,
  title text not null default 'Untitled board',
  icon text,
  color text,
  viewport jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists boards_one_home on milanote.boards (owner_id) where is_home;
create index if not exists boards_parent on milanote.boards (parent_board_id);
drop trigger if exists boards_updated_at on milanote.boards;
create trigger boards_updated_at before update on milanote.boards
  for each row execute function milanote.set_updated_at();

-- elements ------------------------------------------------------------------
create table if not exists milanote.elements (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references milanote.boards(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type milanote.element_type not null,
  parent_id uuid references milanote.elements(id) on delete cascade,
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 240,
  height double precision,
  z text not null default 'a0',
  sort_key text,
  color text,
  content jsonb not null default '{}'::jsonb,
  plain_text text not null default '',
  search tsvector generated always as (to_tsvector('simple', coalesce(plain_text, ''))) stored,
  client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists elements_board on milanote.elements (board_id) where deleted_at is null;
create index if not exists elements_parent on milanote.elements (parent_id);
create index if not exists elements_search on milanote.elements using gin (search);
create index if not exists elements_todo on milanote.elements (type) where type = 'todo';
drop trigger if exists elements_updated_at on milanote.elements;
create trigger elements_updated_at before update on milanote.elements
  for each row execute function milanote.set_updated_at();

-- connections ---------------------------------------------------------------
create table if not exists milanote.connections (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references milanote.boards(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_element_id uuid references milanote.elements(id) on delete cascade,
  to_element_id uuid references milanote.elements(id) on delete cascade,
  from_point jsonb,
  to_point jsonb,
  style jsonb not null default '{"curve":"curved","dash":false,"head":"end","color":"#2b2a28"}'::jsonb,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists connections_board on milanote.connections (board_id) where deleted_at is null;
drop trigger if exists connections_updated_at on milanote.connections;
create trigger connections_updated_at before update on milanote.connections
  for each row execute function milanote.set_updated_at();

-- shares --------------------------------------------------------------------
create table if not exists milanote.shares (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references milanote.boards(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  include_subboards boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- RLS -----------------------------------------------------------------------
alter table milanote.members enable row level security;
drop policy if exists members_select_self on milanote.members;
create policy members_select_self on milanote.members for select to authenticated
  using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['boards','elements','connections','shares'] loop
    execute format('alter table milanote.%I enable row level security', t);
    execute format('drop policy if exists %I on milanote.%I', t || '_owner', t);
    execute format(
      'create policy %I on milanote.%I for all to authenticated
         using (owner_id = auth.uid() and milanote.is_member())
         with check (owner_id = auth.uid() and milanote.is_member())',
      t || '_owner', t);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema milanote to authenticated;
revoke insert, update, delete on milanote.members from authenticated;

-- RPCs ----------------------------------------------------------------------
create or replace function milanote.ensure_home() returns uuid
language plpgsql security invoker set search_path = milanote, pg_temp as $$
declare hid uuid;
begin
  if not milanote.is_member() then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select id into hid from milanote.boards where owner_id = auth.uid() and is_home;
  if hid is null then
    insert into milanote.boards (is_home, title) values (true, 'Home')
      on conflict (owner_id) where is_home do nothing
      returning id into hid;
    if hid is null then
      select id into hid from milanote.boards where owner_id = auth.uid() and is_home;
    end if;
  end if;
  return hid;
end $$;

create or replace function milanote.board_path(board uuid) returns jsonb
language sql stable security invoker set search_path = milanote, pg_temp as $$
  with recursive p as (
    select id, parent_board_id, title, icon, 0 as depth from milanote.boards where id = board
    union all
    select b.id, b.parent_board_id, b.title, b.icon, p.depth + 1
      from milanote.boards b join p on b.id = p.parent_board_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'icon', icon) order by depth desc), '[]'::jsonb)
  from p;
$$;

grant execute on function milanote.ensure_home() to authenticated;
grant execute on function milanote.board_path(uuid) to authenticated;

-- Storage -------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('milanote-files', 'milanote-files', false, 10485760)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = false;

do $$
declare op text;
begin
  foreach op in array array['select','insert','update','delete'] loop
    execute format('drop policy if exists %I on storage.objects', 'milanote_files_' || op);
  end loop;
end $$;

create policy milanote_files_select on storage.objects for select to authenticated
  using (bucket_id = 'milanote-files' and (storage.foldername(name))[1] = auth.uid()::text and milanote.is_member());
create policy milanote_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'milanote-files' and (storage.foldername(name))[1] = auth.uid()::text and milanote.is_member());
create policy milanote_files_update on storage.objects for update to authenticated
  using (bucket_id = 'milanote-files' and (storage.foldername(name))[1] = auth.uid()::text and milanote.is_member())
  with check (bucket_id = 'milanote-files' and (storage.foldername(name))[1] = auth.uid()::text and milanote.is_member());
create policy milanote_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'milanote-files' and (storage.foldername(name))[1] = auth.uid()::text and milanote.is_member());

-- Realtime ------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['boards','elements','connections'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'milanote' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table milanote.%I', t);
    end if;
  end loop;
end $$;

commit;
