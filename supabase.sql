-- Run once in Supabase: SQL Editor > New query > paste ALL of this > Run.
-- Safe to run again later. It sets up:
--   1. the clients table (one row per customer)
--   2. an admins list, so only people YOU add can change records
--   3. get_card(slug): the only way the public can read, one card at a time
--   4. row-level security so nobody can list all clients or write without being an admin

-- 1. clients ----------------------------------------------------------------
create table if not exists public.clients (
  slug        text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.clients enable row level security;

-- 2. admins -----------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;   -- no policies: the API can never read or edit this list

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- 3. public read, one card at a time -------------------------------------------
create or replace function public.get_card(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select data from public.clients where slug = p_slug limit 1;
$$;
revoke all on function public.get_card(text) from public;
grant execute on function public.get_card(text) to anon, authenticated;

-- 4. row-level security: only admins touch the table directly ------------------
drop policy if exists "public can read cards" on public.clients;
drop policy if exists "admin can insert"      on public.clients;
drop policy if exists "admin can update"      on public.clients;
drop policy if exists "admin can delete"      on public.clients;
drop policy if exists "admins read"           on public.clients;
drop policy if exists "admins insert"         on public.clients;
drop policy if exists "admins update"         on public.clients;
drop policy if exists "admins delete"         on public.clients;

create policy "admins read"   on public.clients for select to authenticated using (public.is_admin());
create policy "admins insert" on public.clients for insert to authenticated with check (public.is_admin());
create policy "admins update" on public.clients for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete" on public.clients for delete to authenticated using (public.is_admin());

-- ============================================================================
-- AFTER running the block above, do these two steps once:
--
-- A) Dashboard > Authentication > Users > Add user: your email and a password (tick Auto Confirm).
--    Dashboard > Authentication > Sign In / Providers > Email: turn OFF "Allow new users to sign up".
--
-- B) Make that user an admin. New query, change the email, Run:
--
--    insert into public.admins (user_id)
--    select id from auth.users where email = 'you@example.com'
--    on conflict do nothing;
--
-- Without step B you can sign in but every save is refused. That is on purpose.
-- ============================================================================
