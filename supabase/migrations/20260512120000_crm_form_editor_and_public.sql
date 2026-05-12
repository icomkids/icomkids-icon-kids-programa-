-- Icon Kids — CRM v2
--
-- 1. Seed default config do form (labels editaveis das 3 perguntas iCOM
--    Motos) em system_settings (uma key/value JSON unico).
-- 2. RPC submit_public_feedback: insere uma nova survey + responde de
--    uma vez. Pra formulario publico em /avaliacao (sem token).

-- ============================================================================
-- 1. Form config padrao
-- ============================================================================

insert into public.system_settings (key, value) values (
  'feedback_form_config',
  jsonb_build_object(
    'q_last_car_label', 'Ha quanto tempo voce comprou seu carro atual?',
    'q_intends_label', 'Pretende trocar de carro nos proximos 12 meses?',
    'q_offers_label', 'Posso te mandar ofertas exclusivas da iCOM Motos sobre carros pra familia?'
  )
) on conflict (key) do nothing;

-- ============================================================================
-- 2. RPC publica pra inserir + responder em um shot
-- ============================================================================

create or replace function public.submit_public_feedback(
  p_guardian_name text,
  p_guardian_phone text,
  p_guardian_email text,
  p_child_name text,
  p_stars smallint,
  p_comment text default null,
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
  v_score smallint;
  v_class public.nps_classification;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'stars must be between 1 and 5';
  end if;
  if p_guardian_name is null or length(trim(p_guardian_name)) = 0 then
    raise exception 'guardian_name is required';
  end if;

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

  insert into public.nps_surveys (
    guardian_name, guardian_phone, guardian_email, child_name,
    stars, score, classification, comment,
    q_last_car_purchase, q_intends_trade, q_offers_optin,
    responded_at
  ) values (
    trim(p_guardian_name),
    nullif(trim(coalesce(p_guardian_phone, '')), ''),
    nullif(trim(coalesce(p_guardian_email, '')), ''),
    nullif(trim(coalesce(p_child_name, '')), ''),
    p_stars, v_score, v_class, p_comment,
    p_q_last_car_purchase, p_q_intends_trade, p_q_offers_optin,
    now()
  );
end;
$$;

grant execute on function public.submit_public_feedback(
  text, text, text, text, smallint, text, text, text, text
) to anon, authenticated;
