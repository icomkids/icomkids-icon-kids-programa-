create index icom_bank_contracts_vehicle_customer_idx on public.icom_bank_contracts(vehicle_id, customer_id);
create index icom_bank_customers_creator_idx on public.icom_bank_customers(created_by);
