import type {AdminEntry} from './administrative.ts';
import {saleOutstanding} from './receivables.ts';
import type {VehicleSpec} from './vehicle-catalog.ts';
export type SaleContractSeed={id:string;updated_at:string;price_cents:number;down_payment_cents:number;remaining_cents:number;sale_date:string;name:string;cpf:string;phone:string;email:string;plate:string;vehicle?:VehicleSpec};
export function saleContractSeed(sale:AdminEntry,received=0):SaleContractSeed{
 const pending=saleOutstanding(sale);if(!sale.active||sale.status!=='REALIZADO'||sale.details.payment_method!=='BOLETO_PROPRIO'||pending===null||!Number.isSafeInteger(received)||received<0||pending-received<=0)throw Error('Esta venda não tem saldo disponível para um contrato de boleto próprio.');
 const d=sale.details,remaining=pending-received,price=Number(d.sale_cents);return {id:sale.id,updated_at:sale.updated_at,price_cents:price,down_payment_cents:price-remaining,remaining_cents:remaining,sale_date:sale.entry_date,name:d.customer_name||'',cpf:d.customer_cpf||'',phone:d.customer_phone||'',email:d.customer_email||'',plate:d.plate||'',vehicle:d.vehicle_spec};
}
