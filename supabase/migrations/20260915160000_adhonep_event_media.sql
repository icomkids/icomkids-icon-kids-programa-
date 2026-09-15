insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adhonep-event-media', 'adhonep-event-media', true, 6291456, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "adhonep_event_media_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'adhonep-event-media' and (adh_private.is_super_admin() or exists (select 1 from public.adh_chapter_admins ca where ca.user_id = (select auth.uid()))));
create policy "adhonep_event_media_admin_update" on storage.objects for update to authenticated
using (bucket_id = 'adhonep-event-media' and (adh_private.is_super_admin() or exists (select 1 from public.adh_chapter_admins ca where ca.user_id = (select auth.uid()))))
with check (bucket_id = 'adhonep-event-media' and (adh_private.is_super_admin() or exists (select 1 from public.adh_chapter_admins ca where ca.user_id = (select auth.uid()))));
create policy "adhonep_event_media_admin_delete" on storage.objects for delete to authenticated
using (bucket_id = 'adhonep-event-media' and (adh_private.is_super_admin() or exists (select 1 from public.adh_chapter_admins ca where ca.user_id = (select auth.uid()))));
