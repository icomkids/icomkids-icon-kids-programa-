-- Extend only the existing sale metadata allowlist. Existing owner authorization,
-- transaction locks, costs, cash reservations and deletion protections remain unchanged.
do $sale_metadata$
declare definition text;updated text;
begin
 definition:=pg_get_functiondef('public.icom_bank_save_admin_entry(jsonb,timestamptz)'::regprocedure);
 if definition like '%when ''VENDA'' then array[''customer_name''%' then return;end if;
 updated:=replace(definition,'when ''VENDA'' then array[','when ''VENDA'' then array[''customer_name'',''customer_cpf'',''customer_phone'',''customer_email'',');
 if updated=definition then raise exception 'Sale metadata migration: expected allowlist not found';end if;
 execute updated;
end $sale_metadata$;
