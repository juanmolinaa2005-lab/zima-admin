-- Private bucket for My Business documents. Objects live under `<auth.uid()>/...`.
insert into storage.buckets (id, name, public, file_size_limit)
values ('business-documents', 'business-documents', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "business_documents_select_own" on storage.objects;
drop policy if exists "business_documents_insert_own" on storage.objects;
drop policy if exists "business_documents_delete_own" on storage.objects;

create policy "business_documents_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'business-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "business_documents_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'business-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "business_documents_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'business-documents' and (storage.foldername(name))[1] = auth.uid()::text);
