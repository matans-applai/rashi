-- =====================================================================
-- Storage policies for the `request-files` bucket.
-- Run AFTER creating the bucket in Supabase Studio (Storage → New bucket,
-- name: `request-files`, Public bucket: off).
-- =====================================================================

drop policy if exists "users read own files"   on storage.objects;
drop policy if exists "users upload own files" on storage.objects;

-- Files are stored under `<user_id>/<request_id>/<filename>`,
-- so the first folder segment is the owner.
create policy "users read own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'request-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users upload own files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'request-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
