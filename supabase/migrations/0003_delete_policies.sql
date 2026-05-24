-- Allow users to delete their own requests and their own uploaded files.

drop policy if exists "users delete own requests" on public.requests;
create policy "users delete own requests"
  on public.requests for delete
  using (auth.uid() = user_id);

drop policy if exists "users delete own files" on storage.objects;
create policy "users delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'request-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
