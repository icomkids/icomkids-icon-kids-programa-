alter table public.customer_experiences add column whatsapp_auto_enabled boolean not null default false;
alter table public.customer_experiences add column whatsapp_due_at timestamptz;
alter table public.customer_experiences add column whatsapp_expires_at timestamptz;
create index experience_whatsapp_due on public.customer_experiences(whatsapp_due_at) where whatsapp_auto_enabled and whatsapp_status='not_sent' and completed_at is null and not is_demo;
create function public.experience_seller_create_scheduled(p_user uuid,p_customer text,p_vehicle text,p_plate text,p_request uuid,p_phone text,p_due timestamptz default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_token uuid; v_existing boolean; begin
 if p_due is not null and (p_due<=now() or p_due>now()+interval '30 days') then raise exception 'Invalid schedule'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 v_existing:=exists(select 1 from public.customer_experiences where seller_request_id=p_request);
 v_token:=public.experience_seller_create_with_phone(p_user,p_customer,p_vehicle,p_plate,p_request,p_phone);
 if not v_existing then update public.customer_experiences set whatsapp_auto_enabled=true,whatsapp_due_at=coalesce(p_due,now()),whatsapp_expires_at=coalesce(p_due,now())+interval '7 days' where token=v_token; end if;
 return v_token;
end $$;
create or replace function public.experience_whatsapp_claim(p_user uuid,p_experience uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_seller uuid; affected integer; begin
 select salesperson_id into v_seller from public.experience_users where id=p_user and active and role='seller' for share;
 if v_seller is null then raise exception 'Unauthorized'; end if;
 update public.customer_experiences set whatsapp_status='sending',whatsapp_attempted_at=now(),updated_at=now() where id=p_experience and salesperson_id=v_seller and not is_demo and completed_at is null and status<>'arquivada' and whatsapp_status in ('not_sent','failed') and (whatsapp_due_at is null or whatsapp_due_at<=now());
 get diagnostics affected=row_count;
 if affected=1 then insert into public.experience_audit_logs(user_id,action,entity_id) values(p_user,'seller_whatsapp_started',p_experience::text); end if;
 return affected=1;
end $$;
revoke all on function public.experience_seller_create_scheduled(uuid,text,text,text,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.experience_seller_create_scheduled(uuid,text,text,text,uuid,text,timestamptz) to service_role;
select cron.alter_job(job_id:=jobid,schedule:='* * * * *') from cron.job where jobname='experience-referral-reminders';
