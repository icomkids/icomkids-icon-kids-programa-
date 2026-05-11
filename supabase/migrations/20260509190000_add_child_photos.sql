-- Icon Kids — bucket public 'child-photos' para a foto tirada via webcam no
-- momento do cadastro. Leitura publica (telao precisa renderizar mesmo sem
-- login). Escrita: staff e owner (atendentes do parque).

insert into storage.buckets (id, name, public)
values ('child-photos', 'child-photos', true)
on conflict (id) do nothing;

drop policy if exists "child_photos_staff_insert" on storage.objects;
create policy "child_photos_staff_insert" on storage.objects for insert
  with check (
    bucket_id = 'child-photos'
    and public.auth_user_role() in ('staff', 'owner')
  );

drop policy if exists "child_photos_staff_update" on storage.objects;
create policy "child_photos_staff_update" on storage.objects for update
  using (
    bucket_id = 'child-photos'
    and public.auth_user_role() in ('staff', 'owner')
  );

drop policy if exists "child_photos_staff_delete" on storage.objects;
create policy "child_photos_staff_delete" on storage.objects for delete
  using (
    bucket_id = 'child-photos'
    and public.auth_user_role() in ('staff', 'owner')
  );

drop policy if exists "child_photos_public_read" on storage.objects;
create policy "child_photos_public_read" on storage.objects for select
  using (bucket_id = 'child-photos');
