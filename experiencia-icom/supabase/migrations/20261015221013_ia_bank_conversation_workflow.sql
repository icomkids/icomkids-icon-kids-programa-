create function icom_bank_internal.conversation_message(p_id uuid,p_claim uuid) returns public.icom_bank_whatsapp_inbox language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;b public.icom_bank_whatsapp_bot;begin
 if current_user<>'service_role' then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 select * into m from public.icom_bank_whatsapp_inbox where id=p_id for update;
 select * into b from public.icom_bank_whatsapp_bot where id=1 and enabled and status='PRONTO' and owner_id=m.owner_id;
 if m.id is null or b.id is null or m.claim_id is distinct from p_claim or not(m.sender=any(b.allowed_phones)) or m.status not in('PROCESSANDO','RESOLVIDO','LANCADO') or not exists(select 1 from public.icom_bank_user_access where user_id=m.owner_id and active and role='OWNER') or (select count(*) from public.icom_bank_user_access where active and role='OWNER')<>1 then raise exception 'BANK_FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('conversation:'||m.owner_id::text||':'||m.sender,0));return m;
end $$;
revoke all on function icom_bank_internal.conversation_message(uuid,uuid) from public,anon,authenticated;
grant execute on function icom_bank_internal.conversation_message(uuid,uuid) to service_role;
-- Conversation data is private and isolated by the verified owner AND sender.
create table icom_bank_internal.whatsapp_conversations(owner_id uuid not null references auth.users(id),sender text not null,memory jsonb not null default '{}'::jsonb check(jsonb_typeof(memory)='object' and octet_length(memory::text)<=16000),updated_at timestamptz not null default now(),primary key(owner_id,sender));
create table icom_bank_internal.whatsapp_action_batches(id uuid primary key references public.icom_bank_whatsapp_inbox(id),owner_id uuid not null references auth.users(id),sender text not null,actions jsonb not null check(jsonb_typeof(actions)='array' and jsonb_array_length(actions) between 1 and 5 and octet_length(actions::text)<=80000),source text not null check(length(source)<=12000),summary text not null check(length(summary)<=6000),status text not null check(status in('PENDENTE','EDITANDO','CONFIRMADO','CANCELADO','SUBSTITUIDO','EXPIRADO')),version uuid not null default gen_random_uuid(),results jsonb,expires_at timestamptz not null default now()+interval '30 minutes',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table icom_bank_internal.whatsapp_conversations enable row level security;
alter table icom_bank_internal.whatsapp_action_batches enable row level security;
revoke all on icom_bank_internal.whatsapp_conversations,icom_bank_internal.whatsapp_action_batches from public,anon,authenticated;
grant select,insert,update on icom_bank_internal.whatsapp_conversations,icom_bank_internal.whatsapp_action_batches to service_role;
create unique index whatsapp_actions_one_pending on icom_bank_internal.whatsapp_action_batches(owner_id,sender) where status in('PENDENTE','EDITANDO');
create index whatsapp_actions_recent on icom_bank_internal.whatsapp_action_batches(owner_id,sender,created_at desc);
create function public.icom_bank_conversation_context(p_id uuid,p_claim uuid) returns jsonb language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;mem jsonb;pending jsonb;company text;begin
 m:=icom_bank_internal.conversation_message(p_id,p_claim);
 update icom_bank_internal.whatsapp_action_batches set status='EXPIRADO',updated_at=clock_timestamp() where owner_id=m.owner_id and sender=m.sender and status in('PENDENTE','EDITANDO') and expires_at<=clock_timestamp();
 select memory into mem from icom_bank_internal.whatsapp_conversations where owner_id=m.owner_id and sender=m.sender and updated_at>clock_timestamp()-interval '2 hours';
 select to_jsonb(d) into pending from icom_bank_internal.whatsapp_action_batches d where owner_id=m.owner_id and sender=m.sender and status in('PENDENTE','EDITANDO') and created_at<=m.created_at order by created_at desc limit 1;
 select company_name into company from public.icom_bank_system_settings limit 1;
 return jsonb_build_object('memory',coalesce(mem,'{}'::jsonb),'pending',pending,'companies',jsonb_build_array(jsonb_build_object('id','local','name',coalesce(nullif(company,''),'Empresa cadastrada'),'aliases',jsonb_build_array(coalesce(company,''),'ICOM','ICOM Motors','empresa','loja'))));
end $$;
create function public.icom_bank_conversation_remember(p_id uuid,p_claim uuid,p_memory jsonb) returns void language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;begin
 m:=icom_bank_internal.conversation_message(p_id,p_claim);
 if jsonb_typeof(p_memory) is distinct from 'object' or octet_length(p_memory::text)>16000 then raise exception 'BANK_CONVERSATION_INVALID';end if;
 insert into icom_bank_internal.whatsapp_conversations(owner_id,sender,memory) values(m.owner_id,m.sender,p_memory) on conflict(owner_id,sender) do update set memory=excluded.memory,updated_at=clock_timestamp();
end $$;
create function public.icom_bank_conversation_prepare(p_id uuid,p_claim uuid,p_actions jsonb,p_source text,p_summary text) returns jsonb language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;d icom_bank_internal.whatsapp_action_batches;a jsonb;op text;begin
 m:=icom_bank_internal.conversation_message(p_id,p_claim);select * into d from icom_bank_internal.whatsapp_action_batches where id=m.id;
 if found then return to_jsonb(d);end if;
 if m.status<>'PROCESSANDO' or jsonb_typeof(p_actions) is distinct from 'array' or jsonb_array_length(p_actions) not between 1 and 5 or p_source is null or length(p_source)>12000 or p_summary is null or length(p_summary)>6000 then raise exception 'BANK_CONVERSATION_INVALID';end if;
 for a in select value from jsonb_array_elements(p_actions) loop
 op:=a->>'operation';
 if coalesce(op,'') not in('LANCAMENTO','CONTA_PAGAR','CONTA_RECEBER','PAGAR_CONTA','RECEBER_CONTA','AGENDA') or jsonb_typeof(a->'args') is distinct from 'object' then raise exception 'BANK_CONVERSATION_OPERATION';end if;
 if op in('LANCAMENTO','CONTA_PAGAR','CONTA_RECEBER','AGENDA') and (a->'args'->>'p_expected' is not null or coalesce(a->'args'->'p_payload'->>'id','')!~'^[a-f0-9-]{36}$') then raise exception 'BANK_CONVERSATION_INVALID';end if;
 if op='LANCAMENTO' and (coalesce(a->'args'->'p_payload'->>'kind','') not in('PESSOAL','CUSTO','ENTRADA','VENDA','RETORNO','TROCA','MENSAL') or (a->'args'->'p_payload'->'details') ?| array['sale_cost_id','settlement_part'] or coalesce(a->'args'->'p_payload'->>'category','') in('Retirada / Pix','Devolução ao investidor','Aporte de capital','Saldo inicial de conta')) then raise exception 'BANK_CONVERSATION_OPERATION';end if;
 if op in('PAGAR_CONTA','RECEBER_CONTA') and (a->'args'->>'p_existing' is not null or a->'args'->>'p_expected' is null or a->'args'->>'p_request' is null) then raise exception 'BANK_CONVERSATION_INVALID';end if;
 end loop;
 update icom_bank_internal.whatsapp_action_batches set status='SUBSTITUIDO',updated_at=clock_timestamp() where owner_id=m.owner_id and sender=m.sender and status in('PENDENTE','EDITANDO');
 insert into icom_bank_internal.whatsapp_action_batches(id,owner_id,sender,actions,source,summary,status) values(m.id,m.owner_id,m.sender,p_actions,p_source,p_summary,'PENDENTE') returning * into d;
 update public.icom_bank_whatsapp_inbox set status='RESOLVIDO',reply=p_summary,updated_at=clock_timestamp() where id=m.id;return to_jsonb(d);
end $$;
create function public.icom_bank_conversation_edit(p_id uuid,p_claim uuid,p_draft uuid,p_version uuid,p_cancel boolean) returns void language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;d icom_bank_internal.whatsapp_action_batches;begin
 m:=icom_bank_internal.conversation_message(p_id,p_claim);select * into d from icom_bank_internal.whatsapp_action_batches where id=p_draft and owner_id=m.owner_id and sender=m.sender and version=p_version and status in('PENDENTE','EDITANDO') and expires_at>clock_timestamp() for update;
 if not found then raise exception 'BANK_CONVERSATION_EXPIRED';end if;
 update icom_bank_internal.whatsapp_action_batches set status=case when p_cancel then 'CANCELADO' else 'EDITANDO' end,updated_at=clock_timestamp() where id=d.id;
 update public.icom_bank_whatsapp_inbox set status='RESOLVIDO',updated_at=clock_timestamp() where id=m.id;
end $$;
create function public.icom_bank_conversation_confirm(p_id uuid,p_claim uuid,p_draft uuid,p_version uuid,p_auto boolean default false) returns jsonb language plpgsql set search_path='' as $$
declare m public.icom_bank_whatsapp_inbox;d icom_bank_internal.whatsapp_action_batches;a jsonb;op text;v jsonb;outcomes jsonb:='[]';sub text;claims text;message text:='';part text;idx int:=0;begin
 m:=icom_bank_internal.conversation_message(p_id,p_claim);select * into d from icom_bank_internal.whatsapp_action_batches where id=p_draft and owner_id=m.owner_id and sender=m.sender for update;
 if not found or d.version is distinct from p_version then raise exception 'BANK_CONVERSATION_EXPIRED';end if;
 if d.status='CONFIRMADO' then return d.results;end if;
 if d.status<>'PENDENTE' or d.expires_at<=clock_timestamp() then raise exception 'BANK_CONVERSATION_EXPIRED';end if;
 if coalesce(p_auto,false) then
 if m.id<>d.id or exists(select 1 from jsonb_array_elements(d.actions) x where x->>'operation' is distinct from 'LANCAMENTO' or coalesce(x->'args'->'p_payload'->>'kind','') not in('PESSOAL','CUSTO') or x->'args'->'p_payload'->>'status' is distinct from 'REALIZADO') then raise exception 'BANK_CONVERSATION_CONFIRMATION';end if;
 elsif m.id=d.id or not exists(select 1 from public.icom_bank_whatsapp_inbox where id=d.id and reply_status='ACEITO') then raise exception 'BANK_CONVERSATION_CONFIRMATION';end if;
 sub:=current_setting('request.jwt.claim.sub',true);claims:=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claim.sub',m.owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',m.owner_id,'role','authenticated')::text,true);
 for a in select value from jsonb_array_elements(d.actions) loop
 idx:=idx+1;op:=a->>'operation';
 begin
 if op='AGENDA' then v:=public.icom_bank_save_agenda(a->'args'->'p_payload',null);
 elsif op='CONTA_PAGAR' then v:=public.icom_bank_save_expense(a->'args'->'p_payload',null);
 elsif op='CONTA_RECEBER' then v:=public.icom_bank_save_receivable(a->'args'->'p_payload',null);
 else v:=public.icom_bank_account_post(op,a->'args',(a->>'account_id')::uuid);end if;
 outcomes:=outcomes||jsonb_build_array(jsonb_build_object('index',idx,'ok',true,'operation',op,'result',v));
 part:='✓ Registrado · '||coalesce(a->>'destination',op)||': '||coalesce((select string_agg(x->>'value',' · ' order by ord) from jsonb_array_elements(a->'summary') with ordinality z(x,ord) where x->>'label' in('Despesa','Descrição','Conta','Compromisso','Compromisso de pagamento','Valor','Valor efetivamente registrado','Valor por mês','Data','Primeiro vencimento','Horário')),a->>'destination',op)||case when op='AGENDA' then ' · lembrete salvo; não envia convite nem paga contas.' else '' end;
 exception when others then
 outcomes:=outcomes||jsonb_build_array(jsonb_build_object('index',idx,'ok',false,'operation',op,'code',sqlstate));
 part:='Não registrado · item '||idx::text||': confira o registro no painel; os demais itens têm resultados separados.';
 end;
 message:=message||case when message='' then '' else E'\n' end||part;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(sub,''),true);perform set_config('request.jwt.claims',coalesce(claims,''),true);
 update icom_bank_internal.whatsapp_action_batches set status='CONFIRMADO',results=outcomes,updated_at=clock_timestamp() where id=d.id;
 update public.icom_bank_whatsapp_inbox set status='LANCADO',reply=left(message,3800),updated_at=clock_timestamp() where id=m.id;
 return outcomes;
end $$;
revoke all on function public.icom_bank_conversation_context(uuid,uuid),public.icom_bank_conversation_remember(uuid,uuid,jsonb),public.icom_bank_conversation_prepare(uuid,uuid,jsonb,text,text),public.icom_bank_conversation_edit(uuid,uuid,uuid,uuid,boolean),public.icom_bank_conversation_confirm(uuid,uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.icom_bank_conversation_context(uuid,uuid),public.icom_bank_conversation_remember(uuid,uuid,jsonb),public.icom_bank_conversation_prepare(uuid,uuid,jsonb,text,text),public.icom_bank_conversation_edit(uuid,uuid,uuid,uuid,boolean),public.icom_bank_conversation_confirm(uuid,uuid,uuid,uuid,boolean) to service_role;
notify pgrst,'reload schema';

-- Add only version/link fields needed for atomic existing-title settlement; keep the original authorization.
do $$declare s text;begin
 s:=pg_get_functiondef('public.icom_bank_whatsapp_read_rows(uuid,uuid,text)'::regprocedure);
 if position('id,stock_id,kind,scope,person,title,amount_cents,due_date,active,status,paid_at,created_at' in s)=0 then raise exception 'BANK_READ_SCHEMA_CHANGED';end if;
 s:=replace(s,'id,stock_id,kind,scope,person,title,amount_cents,due_date,active,status,paid_at,created_at','id,stock_id,kind,scope,person,title,amount_cents,due_date,active,status,paid_at,created_at,updated_at,ledger_entry_id');
 s:=replace(s,'id,source_entry_id,title,payer,kind,bank,amount_cents,received_cents,due_date,active','id,source_entry_id,title,payer,kind,bank,amount_cents,received_cents,due_date,active,updated_at');
 s:=replace(s,'when ''icom_bank_receivables'' then','when ''icom_bank_receipts'' then ''id,receivable_id,ledger_entry_id,amount_cents,received_at,method,active'' when ''icom_bank_receivables'' then');execute s;
end $$;
notify pgrst,'reload schema';
