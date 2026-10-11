create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  url text not null default '',
  file_path text,
  file_name text,
  file_size bigint,
  file_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_documents_user_created_idx
  on public.business_documents (user_id, created_at desc);

alter table public.business_documents enable row level security;

drop policy if exists "business_documents_all_own" on public.business_documents;
create policy "business_documents_all_own"
  on public.business_documents for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "business_documents_update_own" on storage.objects;
create policy "business_documents_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'business-documents' and (storage.foldername(name))[1] = auth.uid()::text);
