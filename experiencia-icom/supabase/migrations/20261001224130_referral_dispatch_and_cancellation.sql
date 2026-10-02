create table public.experience_reminder_auth(id integer primary key check(id=1),secret_hash text not null);
alter table public.experience_reminder_auth enable row level security;
revoke all on public.experience_reminder_auth from public,anon,authenticated;
grant select on public.experience_reminder_auth to service_role;
do $$ declare secret text; begin
 secret:=encode(extensions.gen_random_bytes(32),'hex');
 perform vault.create_secret(secret,'experience_referral_cron','Internal referral reminder dispatcher');
 insert into public.experience_reminder_auth values(1,encode(extensions.digest(secret,'sha256'),'hex'));
end $$;
create function public.experience_reminder_authorize(p_secret text) returns boolean language sql stable security invoker set search_path='' as $$ select coalesce((select secret_hash=encode(extensions.digest(p_secret,'sha256'),'hex') from public.experience_reminder_auth where id=1),false); $$;
create function public.experience_referral_cancel(p_token uuid) returns void language plpgsql security invoker set search_path='' as $$
declare e public.customer_experiences;
begin
 select * into e from public.customer_experiences where token=p_token and status<>'arquivada' and (expires_at is null or expires_at>now()) for update;
 if e.id is null then raise exception 'Experience unavailable'; end if;
 update public.experience_referral_reminders set status='cancelled' where experience_id=e.id and status='pending';
end $$;
create function public.experience_referral_claim(p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.experience_referral_reminders; e public.customer_experiences; customer public.customers;
begin
 select * into r from public.experience_referral_reminders where id=p_id for update;
 if r.id is null or r.status<>'pending' or r.due_at>now() then return null; end if;
 select * into e from public.customer_experiences where id=r.experience_id for update;
 if r.expires_at<now() or (e.expires_at is not null and e.expires_at<now()) then update public.experience_referral_reminders set status='expired' where id=p_id; return null; end if;
 if e.id is null or e.is_demo or e.completed_at is null or e.status='arquivada' or exists(select 1 from public.experience_referrals where experience_id=e.id) or not exists(select 1 from public.experience_responses where experience_id=e.id and answers->>'referral_choice'='Sim, mais tarde' and answers->>'referral_reminder'='Sim, pode me lembrar pelo WhatsApp') then update public.experience_referral_reminders set status='cancelled' where id=p_id; return null; end if;
 select * into customer from public.customers where id=e.customer_id;
 update public.experience_referral_reminders set status='sending',attempted_at=clock_timestamp() where id=p_id;
 return jsonb_build_object('id',r.id,'salesperson_id',e.salesperson_id,'token',e.token,'name',customer.name,'phone',customer.phone);
end $$;
create function public.experience_referral_result(p_id uuid,p_status text,p_provider text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_status is null or p_status not in ('accepted','failed','unknown') or (p_status='accepted' and coalesce(p_provider,'')='') then raise exception 'Invalid delivery result'; end if;
 update public.experience_referral_reminders set status=p_status,provider_id=left(p_provider,500),accepted_at=case when p_status='accepted' then clock_timestamp() else null end where id=p_id and status='sending';
end $$;
create or replace function public.experience_referral_add(p_token uuid,p_name text,p_phone text,p_permission boolean) returns void language plpgsql security invoker set search_path='' as $$
declare e public.customer_experiences;
begin
 select * into e from public.customer_experiences where token=p_token for update;
 if e.id is null or e.completed_at is null or e.status='arquivada' or (e.expires_at is not null and e.expires_at<now()) then raise exception 'Experience unavailable'; end if;
 if not exists(select 1 from public.experience_responses where experience_id=e.id and answers->>'referral_choice' in ('Sim, indicar agora','Sim, mais tarde')) then raise exception 'Referral not requested'; end if;
 if p_name is null or p_phone is null or p_permission is distinct from true or length(trim(p_name)) not between 2 and 120 or p_phone !~ '^55[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' then raise exception 'Invalid referral'; end if;
 insert into public.experience_referrals(experience_id,name,phone,permission_confirmed) values(e.id,trim(p_name),p_phone,true) on conflict(experience_id) do nothing;
 update public.experience_referral_reminders set status='cancelled' where experience_id=e.id and status='pending';
end $$;
revoke all on function public.experience_reminder_authorize(text),public.experience_referral_cancel(uuid),public.experience_referral_claim(uuid),public.experience_referral_result(uuid,text,text) from public,anon,authenticated;
grant execute on function public.experience_reminder_authorize(text),public.experience_referral_cancel(uuid),public.experience_referral_claim(uuid),public.experience_referral_result(uuid,text,text) to service_role;
