alter table public.adh_businesses
  add column if not exists slug text,
  add column if not exists short_description text,
  add column if not exists contact_email text,
  add column if not exists facebook_url text,
  add column if not exists linkedin_url text,
  add column if not exists youtube_url text,
  add column if not exists video_url text,
  add column if not exists paid_until date;

update public.adh_businesses
set slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) || '-' || substr(id::text, 1, 6)
where slug is null;

alter table public.adh_businesses alter column slug set not null;
create unique index if not exists adh_businesses_slug_key on public.adh_businesses(slug);
create index if not exists adh_businesses_marketplace_idx on public.adh_businesses(status, featured, segment, name);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'adhonep-business-media',
  'adhonep-business-media',
  true,
  31457280,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "adh media admin insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'adhonep-business-media'
  and exists (
    select 1 from public.adh_businesses b
    where b.id::text = (storage.foldername(name))[1]
      and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
  )
);

create policy "adh media admin select"
on storage.objects for select to authenticated
using (
  bucket_id = 'adhonep-business-media'
  and exists (
    select 1 from public.adh_businesses b
    where b.id::text = (storage.foldername(name))[1]
      and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
  )
);

create policy "adh media admin update"
on storage.objects for update to authenticated
using (
  bucket_id = 'adhonep-business-media'
  and exists (
    select 1 from public.adh_businesses b
    where b.id::text = (storage.foldername(name))[1]
      and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
  )
)
with check (
  bucket_id = 'adhonep-business-media'
  and exists (
    select 1 from public.adh_businesses b
    where b.id::text = (storage.foldername(name))[1]
      and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
  )
);

create policy "adh media admin delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'adhonep-business-media'
  and exists (
    select 1 from public.adh_businesses b
    where b.id::text = (storage.foldername(name))[1]
      and (b.owner_id = (select auth.uid()) or adh_private.manages_chapter(b.chapter_id))
  )
);
