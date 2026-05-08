-- Icon Kids — Module 16 (NPS automatico)
-- Each session check-out generates an NPS survey, the customer rates 0-10
-- via a public link, results aggregate into the owner's dashboard.

-- Seed an NPS survey message template that the app uses on session checkout.
insert into public.message_templates (key, name, body) values (
  'nps_survey',
  'Pesquisa NPS pos check-out',
  E'Oi {{nome}}! Obrigado por trazer {{crianca}} ao iCOM Kids hoje 💙\n\nPode avaliar nossa experiencia em 1 minutinho? De 0 a 10, quanto recomendaria pra um amigo?\n\n👉 {{link}}'
) on conflict (key) do nothing;

create type public.nps_classification as enum ('detractor', 'passive', 'promoter');

create table public.nps_surveys (
  id uuid primary key default gen_random_uuid(),
  /** Random opaque token used in the public response URL. */
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  session_id uuid references public.sessions(id) on delete set null,
  /** Snapshot of identifying info so the survey survives session/guardian deletes. */
  guardian_name text,
  guardian_phone text,
  child_name text,
  /** 0..10. NULL until the customer responds. */
  score smallint check (score is null or (score >= 0 and score <= 10)),
  /** Computed from score: 0-6 detractor, 7-8 passive, 9-10 promoter. */
  classification public.nps_classification,
  comment text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index nps_surveys_responded_idx on public.nps_surveys(responded_at desc nulls last);
create index nps_surveys_score_idx on public.nps_surveys(score)
  where score is not null;
create index nps_surveys_session_idx on public.nps_surveys(session_id)
  where session_id is not null;

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.nps_surveys enable row level security;

-- Owner / staff can read and manage everything.
create policy "nps_staff_owner_all" on public.nps_surveys for all
  using (public.auth_user_role() in ('staff', 'owner'))
  with check (public.auth_user_role() in ('staff', 'owner'));

-- The public page reads a survey by token via the RPC below — no direct
-- table access needed for anonymous users.

-- ============================================================================
-- RPC: get_nps_by_token (public read of one survey by its token)
-- ============================================================================

create or replace function public.get_nps_by_token(p_token text)
returns table (
  id uuid,
  child_name text,
  guardian_name text,
  score smallint,
  comment text,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, child_name, guardian_name, score, comment, responded_at
    from public.nps_surveys
   where token = p_token
$$;

grant execute on function public.get_nps_by_token(text) to anon, authenticated;

-- ============================================================================
-- RPC: submit_nps_response — public, sets score + classification + comment.
-- ============================================================================

create or replace function public.submit_nps_response(
  p_token text,
  p_score smallint,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.nps_classification;
  v_existing record;
begin
  if p_score is null or p_score < 0 or p_score > 10 then
    raise exception 'score must be between 0 and 10';
  end if;

  select id, responded_at into v_existing
    from public.nps_surveys where token = p_token
   for update;

  if not found then
    raise exception 'survey not found';
  end if;

  if v_existing.responded_at is not null then
    raise exception 'this survey was already answered';
  end if;

  v_class := case
    when p_score >= 9 then 'promoter'::public.nps_classification
    when p_score >= 7 then 'passive'::public.nps_classification
    else 'detractor'::public.nps_classification
  end;

  update public.nps_surveys
     set score = p_score,
         classification = v_class,
         comment = p_comment,
         responded_at = now()
   where token = p_token;
end;
$$;

grant execute on function public.submit_nps_response(text, smallint, text) to anon, authenticated;

-- Realtime so the owner dashboard updates as responses arrive.
alter publication supabase_realtime add table public.nps_surveys;
