-- Icon Kids — Feedback survey v2 (NPS + qualificacao de leads iCOM Motos)
--
-- Mudancas:
-- 1. Limpa dados antigos de teste do nps_surveys.
-- 2. Adiciona colunas: stars (1-5), guardian_email, q_last_car_purchase,
--    q_intends_trade, q_offers_optin.
-- 3. RPC submit_feedback_response que aceita os novos campos.
-- 4. Atualiza get_nps_by_token pra devolver os campos novos.
-- 5. Atualiza template do WhatsApp e cria template do email com HTML
--    bonito nas cores iCOM Kids.

-- ============================================================================
-- 1. Limpa dados antigos
-- ============================================================================

truncate table public.nps_surveys restart identity cascade;

-- ============================================================================
-- 2. Novas colunas
-- ============================================================================

alter table public.nps_surveys
  add column if not exists stars smallint
    check (stars is null or (stars between 1 and 5)),
  add column if not exists guardian_email text,
  add column if not exists q_last_car_purchase text
    check (q_last_car_purchase is null or q_last_car_purchase in (
      'lt_1y', '1_3y', 'gt_3y', 'no_car'
    )),
  add column if not exists q_intends_trade text
    check (q_intends_trade is null or q_intends_trade in ('yes', 'maybe', 'no')),
  add column if not exists q_offers_optin text
    check (q_offers_optin is null or q_offers_optin in ('whatsapp', 'email', 'no'));

create index if not exists nps_surveys_stars_idx on public.nps_surveys(stars)
  where stars is not null;
create index if not exists nps_surveys_intends_trade_idx
  on public.nps_surveys(q_intends_trade)
  where q_intends_trade is not null;

-- ============================================================================
-- 3. RPC: submit_feedback_response
-- ============================================================================

create or replace function public.submit_feedback_response(
  p_token text,
  p_stars smallint,
  p_comment text default null,
  p_guardian_email text default null,
  p_q_last_car_purchase text default null,
  p_q_intends_trade text default null,
  p_q_offers_optin text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_score smallint;
  v_class public.nps_classification;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'stars must be between 1 and 5';
  end if;

  select id, responded_at into v_existing
    from public.nps_surveys
   where token = p_token
   for update;

  if not found then
    raise exception 'survey not found';
  end if;

  if v_existing.responded_at is not null then
    raise exception 'this survey was already answered';
  end if;

  -- Map stars -> score 0-10 e classification, pra dashboards de NPS
  -- continuarem funcionando.
  v_score := case p_stars
    when 1 then 0
    when 2 then 3
    when 3 then 6
    when 4 then 8
    when 5 then 10
  end;
  v_class := case
    when v_score >= 9 then 'promoter'::public.nps_classification
    when v_score >= 7 then 'passive'::public.nps_classification
    else 'detractor'::public.nps_classification
  end;

  update public.nps_surveys
     set stars = p_stars,
         score = v_score,
         classification = v_class,
         comment = p_comment,
         guardian_email = coalesce(p_guardian_email, guardian_email),
         q_last_car_purchase = p_q_last_car_purchase,
         q_intends_trade = p_q_intends_trade,
         q_offers_optin = p_q_offers_optin,
         responded_at = now()
   where token = p_token;
end;
$$;

grant execute on function public.submit_feedback_response(
  text, smallint, text, text, text, text, text
) to anon, authenticated;

-- ============================================================================
-- 4. Atualiza get_nps_by_token pra retornar os novos campos
-- ============================================================================

drop function if exists public.get_nps_by_token(text);

create or replace function public.get_nps_by_token(p_token text)
returns table (
  id uuid,
  child_name text,
  guardian_name text,
  guardian_email text,
  stars smallint,
  score smallint,
  comment text,
  q_last_car_purchase text,
  q_intends_trade text,
  q_offers_optin text,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, child_name, guardian_name, guardian_email, stars, score, comment,
         q_last_car_purchase, q_intends_trade, q_offers_optin, responded_at
    from public.nps_surveys
   where token = p_token
$$;

grant execute on function public.get_nps_by_token(text) to anon, authenticated;

-- ============================================================================
-- 5. Templates
-- ============================================================================

update public.message_templates
   set body = E'Oi {{nome}}! ✨ Obrigado por trazer {{crianca}} ao iCOM Kids hoje 💙\n\nFicamos felizes com a visita. Da pra avaliar a experiencia em 1 minutinho?\n\n👉 {{link}}\n\nSua resposta nos ajuda demais!'
 where key = 'nps_survey';

-- Email com cores e identidade iCOM Kids. Mantemos inline-styles pra
-- maxima compatibilidade com clientes de email (Gmail/Outlook/Apple Mail
-- ignoram CSS externo).
insert into public.message_templates (key, name, body) values (
  'email_feedback_survey',
  '[Email] Pesquisa pos-visita',
  E'<!doctype html>\n<html lang="pt-BR">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Obrigado pela visita, {{nome}}!</title>\n  </head>\n  <body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;color:#0f172a;">\n    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:32px 16px;">\n      <tr>\n        <td align="center">\n          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">\n            <!-- header gradient -->\n            <tr>\n              <td style="background:linear-gradient(135deg,#1E78DC 0%,#7B36BF 50%,#EA4D8E 100%);padding:32px 28px;text-align:center;">\n                <p style="margin:0;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">iCOM Kids</p>\n                <p style="margin:8px 0 0;color:#ffffff;font-size:28px;font-weight:900;line-height:1.1;">Obrigado pela visita,<br/>{{nome}}! 💙</p>\n              </td>\n            </tr>\n            <!-- body -->\n            <tr>\n              <td style="padding:32px 28px;">\n                <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#0f172a;">A visita de <strong>{{crianca}}</strong> chegou ao fim. A gente espera que tenha sido <strong>uma diversao em movimento</strong> 🛝🎈</p>\n                <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#0f172a;">Sua opiniao e o que faz a gente melhorar. <strong>Da pra responder em 1 minuto?</strong></p>\n                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">\n                  <tr>\n                    <td align="center" style="background:#1E78DC;border-radius:999px;">\n                      <a href="{{link}}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:0.5px;">Avaliar a experiencia →</a>\n                    </td>\n                  </tr>\n                </table>\n                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">Se o botao nao funcionar, copie e cole no navegador:<br/><a href="{{link}}" style="color:#1E78DC;word-break:break-all;">{{link}}</a></p>\n              </td>\n            </tr>\n            <!-- divider -->\n            <tr>\n              <td style="padding:0 28px;">\n                <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" />\n              </td>\n            </tr>\n            <!-- footer brand strip -->\n            <tr>\n              <td style="padding:24px 28px;text-align:center;">\n                <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">Diversao em movimento</p>\n                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px auto 0;">\n                  <tr>\n                    <td style="width:10px;height:10px;background:#1E78DC;border-radius:50%;margin:0 3px;"></td>\n                    <td style="width:8px;"></td>\n                    <td style="width:10px;height:10px;background:#3CB4E0;border-radius:50%;"></td>\n                    <td style="width:8px;"></td>\n                    <td style="width:10px;height:10px;background:#F39230;border-radius:50%;"></td>\n                    <td style="width:8px;"></td>\n                    <td style="width:10px;height:10px;background:#EA4D8E;border-radius:50%;"></td>\n                    <td style="width:8px;"></td>\n                    <td style="width:10px;height:10px;background:#A6CD3F;border-radius:50%;"></td>\n                  </tr>\n                </table>\n                <p style="margin:16px 0 0;color:#64748b;font-size:11px;">iCOM Kids · contato@icomkids.com.br</p>\n              </td>\n            </tr>\n          </table>\n        </td>\n      </tr>\n    </table>\n  </body>\n</html>'
) on conflict (key) do update set body = excluded.body, name = excluded.name;
