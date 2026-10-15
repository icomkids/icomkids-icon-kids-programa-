import {brazilDay} from './model.ts';
import {realDate,validId} from './contracts.ts';
import type {AdminEntry} from './administrative.ts';
import type {Payable} from './payables.ts';
export type RepasseRecord={sale_id:string;origin_id:string;stock_id:string;manager_id:string|null;manager_name:string;manager_cents:number;payable_id:string|null;active:boolean;created_by:string;updated_at:string};
export type RepasseSale=AdminEntry&{repasse?:RepasseRecord};
export type RepasseInput={enabled:boolean;sale_cents:number;buyer_name:string;buyer_phone:string;entry_date:string;received_cents:number;payment_method:'PIX'|'DINHEIRO'|'CARTAO';account_id:string|null;manager_id:string|null;manager_cents:number};
export type CommissionRow={repasse:RepasseRecord;sale:AdminEntry;payable:Payable|null};
export function repasseInput(raw:unknown):RepasseInput|null{
 if(raw===null||raw===undefined)return null;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Confira os dados do repasse.');
 const b=raw as Record<string,unknown>;
 if(b.enabled===false)return null;
 if(b.enabled!==true)throw new Error('Informe se o carro já foi repassado.');
 const money=(v:unknown,positive=false)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<(positive?1:0)||v>1000000000)throw new Error('Confira os valores do repasse.');return v;};
 const sale=money(b.sale_cents,true),received=money(b.received_cents),fee=money(b.manager_cents);
 if(received>sale)throw new Error('O recebido do repasse não pode superar a revenda.');
 const buyer=typeof b.buyer_name==='string'?b.buyer_name.trim():'',phone=typeof b.buyer_phone==='string'?b.buyer_phone.trim():'';
 if(buyer.length<2||buyer.length>160||phone.length>30)throw new Error('Informe para quem o carro foi repassado. O telefone é opcional.');
 if(typeof b.entry_date!=='string'||!realDate(b.entry_date)||b.entry_date<'2000-01-01'||b.entry_date>'2100-12-31')throw new Error('Confira a data do repasse.');
 if(!['PIX','DINHEIRO','CARTAO'].includes(String(b.payment_method)))throw new Error('Confira a forma de recebimento do repasse.');
 if(received>0&&(typeof b.account_id!=='string'||!validId(b.account_id)))throw new Error('Escolha em qual conta entrou o dinheiro do repasse.');
 if(fee>0&&(typeof b.manager_id!=='string'||!validId(b.manager_id)))throw new Error('Selecione o gerente que recebe esta comissão.');
 return {enabled:true,sale_cents:sale,buyer_name:buyer,buyer_phone:phone,entry_date:b.entry_date,received_cents:received,payment_method:b.payment_method as RepasseInput['payment_method'],account_id:received>0?String(b.account_id):null,manager_id:fee>0?String(b.manager_id):null,manager_cents:fee};
}
export function repasseResult(purchase:number,sale:number,preparation=0,manager=0){return {entry:purchase,resale:sale,gross:sale-purchase,preparation,manager,net:sale-purchase-preparation-manager};}
export function commissionSummary(rows:CommissionRow[],month:string){const active=rows.filter(r=>r.repasse.active&&r.sale.active&&r.sale.status==='REALIZADO'&&r.sale.entry_date<=brazilDay()&&r.sale.entry_date.startsWith(month));const sum=(list:CommissionRow[])=>list.reduce((n,r)=>n+Number(r.repasse.manager_cents),0);const paid=active.filter(r=>r.payable?.active&&r.payable.status==='PAGO');return {total:sum(active),paid:sum(paid),pending:sum(active.filter(r=>!paid.includes(r))),count:active.length};}
