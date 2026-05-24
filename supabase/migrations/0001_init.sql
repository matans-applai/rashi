-- =====================================================================
-- Rashi Foundation Legal Intake POC — initial schema
-- Apply via Supabase SQL Editor, or via `supabase db push` if using CLI.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- requests: one row per engagement request a Rashi employee opens.
-- ---------------------------------------------------------------------
create table if not exists public.requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  user_email    text,
  department    text,
  description   text not null,
  supplier_name text,
  amount        numeric,
  file_paths    text[] not null default '{}',
  outcome       text,         -- general_terms | insurance_required | legal_review | missing_info (supplier_registration may exist in legacy POC rows)
  status        text not null default 'classified', -- draft | classified | sent_to_legal | completed
  reasoning     text,
  tags          text[],
  legal_intake  jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists requests_user_id_created_at_idx
  on public.requests (user_id, created_at desc);

alter table public.requests enable row level security;

drop policy if exists "users read own requests"   on public.requests;
drop policy if exists "users insert own requests" on public.requests;
drop policy if exists "users update own requests" on public.requests;

create policy "users read own requests"
  on public.requests for select
  using (auth.uid() = user_id);

create policy "users insert own requests"
  on public.requests for insert
  with check (auth.uid() = user_id);

create policy "users update own requests"
  on public.requests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- suppliers: demo supplier registry, used by the classifier to know if a
-- referenced supplier is registered in the 2026 registry.
-- (The Vite app also ships a hard-coded copy in src/lib/suppliers.ts so
--  the rules work even before this table is populated. The table is here
--  so you can later move supplier data fully into Supabase.)
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  status     text not null check (status in ('registered','not_registered','unknown')),
  category   text,
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

drop policy if exists "anyone authenticated can read suppliers" on public.suppliers;
create policy "anyone authenticated can read suppliers"
  on public.suppliers for select
  to authenticated
  using (true);
