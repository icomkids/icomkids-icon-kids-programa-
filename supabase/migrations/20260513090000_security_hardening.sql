-- Icon Kids — endurecimento de seguranca pos-auditoria.
--
-- Cinco mudancas isoladas e nao-destrutivas:
--   1. Buckets storage: substitui SELECT broad por SELECT restrito a
--      staff/owner. URLs publicas continuam funcionando porque os
--      buckets sao `public = true` (Supabase serve direto, sem RLS).
--      Apenas o `list` da Storage API fica fechado pra anon.
--   2. View `sessions_with_timing` passa de SECURITY DEFINER pra
--      SECURITY INVOKER (respeita RLS do caller).
--   3. Revoga EXECUTE de SECURITY DEFINER em funcoes internas que nao
--      precisam ser chamadas via REST. Mantem pra triggers e RPCs
--      legitimos (loyalty + commissions usados pelo frontend).
--   4. Remove a funcao `setup_dispatch_cron` (ja foi executada uma vez
--      pra ligar o cron; nao precisa mais existir publica). Vira
--      somente owner manual via SQL Editor se precisar reagendar.

-- ============================================================================
-- 1. Storage: restringir LIST nos buckets publicos
-- ============================================================================

drop policy if exists "child_photos_public_read" on storage.objects;
create policy "child_photos_staff_list" on storage.objects for select
  using (
    bucket_id = 'child-photos'
    and public.auth_user_role() in ('staff', 'owner')
  );

drop policy if exists "media_storage_public_read" on storage.objects;
create policy "media_storage_owner_list" on storage.objects for select
  using (
    bucket_id = 'media'
    and public.auth_user_role() = 'owner'
  );

-- ============================================================================
-- 2. View sessions_with_timing -> SECURITY INVOKER
-- ============================================================================

alter view public.sessions_with_timing set (security_invoker = on);

-- ============================================================================
-- 3. Revogar EXECUTE de funcoes SECURITY DEFINER internas
-- ============================================================================

-- Trigger functions (rodam como postgres internamente, nao precisam de grant
-- pra anon/authenticated):
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.tg_set_updated_at() from anon, authenticated;
revoke execute on function public.enqueue_session_end_messages() from anon, authenticated;
revoke execute on function public.enqueue_birthday_messages_for_today() from anon, authenticated;

-- Funcao auxiliar de RLS (chamada de dentro das policies, nao precisa
-- ser exposta como RPC):
revoke execute on function public.auth_user_role() from anon, authenticated;

-- Loyalty: mantem authenticated (chamado pelo painel), revoga anon:
revoke execute on function public.award_loyalty_points(uuid, integer, text, uuid, uuid) from anon;
revoke execute on function public.redeem_loyalty_reward(uuid, uuid) from anon;
revoke execute on function public.ensure_loyalty_account(uuid) from anon, authenticated;

-- Commissions: mantem authenticated, revoga anon:
revoke execute on function public.staff_commissions_for_period(timestamptz, timestamptz) from anon;

-- ============================================================================
-- 4. Setup cron: remove a funcao publica. O cron ja esta ativo. Se
--    precisar reagendar, basta rodar o codigo da funcao manualmente no
--    SQL Editor como owner.
-- ============================================================================

drop function if exists public.setup_dispatch_cron(text, text);
