-- Run as postgres in a trusted SQL editor. All writes are in a subtransaction
-- deliberately rolled back by EX001. It uses one EXISTING confirmed ADHONEP
-- member; creates no Auth user, sends no email, and leaves no test contact.
do $test$
declare actor uuid; actor_email text; role_before text; payload jsonb; saved uuid; repeated uuid; rolled_back boolean := false;
begin
  select u.id, lower(u.email), p.role::text into strict actor, actor_email, role_before
    from auth.users u join public.adh_profiles p on p.id=u.id
    where u.email_confirmed_at is not null and p.role='super_admin'
    order by p.created_at limit 1;
  payload := jsonb_build_object('full_name','Teste transacional Expansão','company_name','Teste sem publicação','job_title','Diretor','city','Taubaté','email',actor_email,'whatsapp','(12) 99999-1234','whatsapp_normalized','12999991234','instagram','teste','business_sector','Tecnologia','business_sector_other','','main_product_service','Verificação automatizada sem publicação','average_ticket','501_2000','networking_goals',jsonb_build_array('Fazer parcerias'),'desired_connections',jsonb_build_array('Parceiros'),'marketing_opt_in',false,'business_description','Registro temporário: rollback obrigatório.');
  begin
    execute 'set local role service_role';
    saved := public.adh_save_expansion_registration(actor,actor_email,payload);
    assert exists(select 1 from public.adh_leads where id=saved and user_id=actor and marketing_opt_in=false and source_page='adhonep_expansao_form'), 'Persistence/identity/consent failed';
    repeated := public.adh_save_expansion_registration(actor,actor_email,payload);
    assert saved=repeated, 'Idempotency failed';
    assert (select role::text from public.adh_profiles where id=actor)=role_before, 'Existing role changed';
    assert not exists(select 1 from public.adh_notification_subscriptions where email=actor_email and active), 'Marketing opt out failed';
    begin
      perform public.adh_save_expansion_registration(actor,actor_email,payload||'{"city":"São Paulo"}'::jsonb);
      raise exception 'Rate limit did not reject update' using errcode='EX002';
    exception when raise_exception then
      if sqlerrm <> 'Please wait before updating' then raise; end if;
    end;
    assert not has_function_privilege('anon','public.adh_save_expansion_registration(uuid,text,jsonb)','execute'), 'Anonymous RPC access';
    assert not has_function_privilege('authenticated','public.adh_save_expansion_registration(uuid,text,jsonb)','execute'), 'Untrusted actor could call RPC';
    assert not has_column_privilege('authenticated','public.adh_leads','user_id','update'), 'Owner reassignment allowed';
    -- Exercise the same RLS used by the browser, not just the service bypass.
    execute 'reset role';
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    assert exists(select 1 from public.adh_leads where id=saved), 'Member/admin cannot read own contact';
    update public.adh_leads set status='qualified' where id=saved;
    assert (select status from public.adh_leads where id=saved)='qualified', 'Admin cannot update status';
    execute 'reset role';
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
    execute 'set local role authenticated';
    assert not exists(select 1 from public.adh_leads where id=saved), 'Contact visible to unrelated account';
    raise exception 'Rollback successful probe' using errcode='EX001';
  exception when sqlstate 'EX001' then rolled_back := true;
  end;
  assert rolled_back, 'Probe did not roll back';
  assert not exists(select 1 from public.adh_leads where name='Teste transacional Expansão'), 'Test data leaked';
end $test$;
select 'PASS: persistence, association, idempotency, opt-out, rate limit, role preservation, RPC permissions, rollback' as expansion_check;
