-- Add explicit resale to an investor without changing existing profit/cash formulas.
do $patch$ declare c record;s text;a text;b text;begin
 for c in select conname from pg_constraint where conrelid='public.icom_bank_repasse_details'::regclass and contype='c' and pg_get_constraintdef(oid) like '%manager_id%' loop execute format('alter table public.icom_bank_repasse_details drop constraint %I',c.conname);end loop;
 alter table public.icom_bank_repasse_details add constraint bank_repasse_commission_recipient check((manager_cents=0 and manager_id is null) or (manager_cents>0 and (manager_id is null or length(trim(manager_name))>=2)));
 s:=pg_get_functiondef('icom_bank_internal.save_repasse_sale(jsonb,timestamptz,uuid,uuid,bigint)'::regprocedure);
 a:=$a$s.source_details->>'trade_destination' is distinct from 'REPASSE'$a$;if position(a in s)=0 then raise exception 'INV_REPASSE_SAVE_SOURCE';end if;
 s:=replace(s,a,$b$coalesce(s.source_details->>'trade_destination','') not in('REPASSE','INVESTIDOR')$b$);
 a:=$a$if s.sold_entry_id is not null and s.sold_entry_id<>v_id$a$;if position(a in s)=0 then raise exception 'INV_REPASSE_SAVE_SAME';end if;
 s:=replace(s,a,$b$if s.source_details->>'trade_destination'='INVESTIDOR' and icom_bank_internal.cash_same_investor(o.details) then raise exception 'BANK_REPASSE_SAME_INVESTOR';end if;
 if s.sold_entry_id is not null and s.sold_entry_id<>v_id$b$);
 a:=$a$if fee>0 then$a$;if position(a in s)=0 then raise exception 'INV_REPASSE_FEE';end if;
 s:=replace(s,a,'if fee>0 and p_manager is not null then');s:=replace(s,$a$if p_manager is null then raise exception 'BANK_REPASSE_MANAGER';end if;$a$,'');
 s:=replace(s,'elsif p_manager is not null then','elsif fee=0 and p_manager is not null then');
 s:=replace(s,'case when fee>0 then','case when fee>0 and p_manager is not null then');execute s;
 s:=pg_get_functiondef('icom_bank_internal.save_sale_trade_repasse(jsonb,timestamptz,uuid,jsonb)'::regprocedure);
 a:=$a$p_payload->'details'->>'trade_destination' is distinct from 'REPASSE'$a$;if position(a in s)=0 then raise exception 'INV_REPASSE_PARENT';end if;
 s:=replace(s,a,$b$coalesce(p_payload->'details'->>'trade_destination','') not in('REPASSE','INVESTIDOR')$b$);
 a:=$a$select * into r from public.icom_bank_repasse_details where stock_id=s.id and active for update;$a$;if position(a in s)=0 then raise exception 'INV_REPASSE_BUYER';end if;
 s:=replace(s,a,$b$if o.details->>'trade_destination'='INVESTIDOR' then
 if icom_bank_internal.cash_same_investor(o.details) then raise exception 'BANK_REPASSE_SAME_INVESTOR';end if;
 buyer:=trim(o.details->>'trade_investor_name');end if;
 select * into r from public.icom_bank_repasse_details where stock_id=s.id and active for update;$b$);execute s;
 s:=pg_get_functiondef('icom_bank_internal.sync_repasse_commission()'::regprocedure);
 s:=replace(s,$a$'Comissão de repasse · '||r.manager_name||' · '$a$,$b$'Comissão de repasse · '$b$);
 s:=replace(s,$a$'Gerente: '||r.manager_name||'. Repasse '$a$,$b$'Comissão do repasse '$b$);execute s;
end $patch$;
-- Existing stock guards still enforce status, purchase price, preparation cost,
-- date, plate and store ownership. Only a private, owner-created repasse record
-- can authorize an explicit resale of an investor-destined trade.
do $patch$ declare s text;a text;b text;f regprocedure;v text;permit text;begin
 foreach f in array array['icom_bank_internal.guard_stock_entry()'::regprocedure,'icom_bank_internal.guard_cash_ownership()'::regprocedure] loop
  v:=case when f='icom_bank_internal.guard_stock_entry()'::regprocedure then 's' else 'st' end;
  permit:='not exists(select 1 from public.icom_bank_repasse_details r where r.sale_id=new.id and r.stock_id='||v||'.id and r.origin_id='||v||'.origin_entry_id and r.created_by=auth.uid())';
  s:=pg_get_functiondef(f);
  a:=case when v='s' then 'if new.active and ' else 'if ' end||v||$a$.source_details->>'trade_destination'='INVESTIDOR' then raise exception 'BANK_CASH_STOCK';end if;$a$;
  if position(a in s)=0 then raise exception 'INV_REPASSE_STOCK_SOURCE %',f;end if;
  b:=replace(a,' then raise exception',' and '||permit||' then raise exception');s:=replace(s,a,b);
  a:='if new.active and new.kind=''VENDA'' and new.details ? ''sale_owner'' and (coalesce('||v||'.source_details->>''trade_destination'','''') not in(''LOJA'',''REPASSE'') or ('||v||'.source_details->>''trade_destination''=''REPASSE'') is distinct from (coalesce(new.details->>''sale_mode'',''NORMAL'')=''REPASSE'')) then raise exception ''BANK_CASH_STOCK'';end if;';
  if v='st' then a:=replace(a,'if new.active and new.kind','if new.kind');end if;
  if position(a in s)=0 then raise exception 'INV_REPASSE_STOCK_MODE %',f;end if;
  b:=replace(a,' then raise exception',' and '||permit||' then raise exception');s:=replace(s,a,b);execute s;
 end loop;
end $patch$;
notify pgrst,'reload schema';
