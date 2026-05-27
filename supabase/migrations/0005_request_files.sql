-- =====================================================================
-- request_files: metadata table for uploaded documents.
-- Files are stored in Supabase Storage (bucket: request-files).
-- This table tracks metadata and links files to requests + users.
-- =====================================================================

create table if not exists public.request_files (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid references public.requests(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  file_name     text not null,
  storage_path  text not null,
  file_type     text,
  file_size     bigint,
  uploaded_at   timestamptz not null default now()
);

create index if not exists request_files_request_id_idx
  on public.request_files (request_id);

create index if not exists request_files_user_id_idx
  on public.request_files (user_id);

alter table public.request_files enable row level security;

create policy "users read own files metadata"
  on public.request_files for select
  using (auth.uid() = user_id);

create policy "users insert own files metadata"
  on public.request_files for insert
  with check (auth.uid() = user_id);

create policy "users delete own files metadata"
  on public.request_files for delete
  using (auth.uid() = user_id);

-- Also add a delete policy for storage objects (was missing in 0002).
drop policy if exists "users delete own files" on storage.objects;
create policy "users delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'request-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
