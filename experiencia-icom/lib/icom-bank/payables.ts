import {validId,realDate} from './contracts.ts';
import {brazilDay} from './model.ts';
import type {AdminEntry} from './administrative.ts';
import type {StockRow} from './stock.ts';
export const payableMethods=['PIX','DINHEIRO','CARTAO','TRANSFERENCIA','BOLETO'] as const;
export const payableLabels={IPVA:'IPVA',MULTAS:'Multas',QUITACAO:'Quitação'};
export type Payable={id:string;stock_id:string;kind:keyof typeof payableLabels;amount_cents:number;bank:string;due_date:string|null;notes:string;active:boolean;status:'PENDENTE'|'PAGO';paid_at:string|null;method:string|null;ledger_entry_id:string|null;receipt_id:string|null;created_at:string;updated_at:string};
export type PayableFile={id:string;payable_id:string;object_path:string;mime_type:string;size_bytes:number;status:'RESERVADO'|'ANEXADO';created_at:string};
export type PayableHistory={id:string;previous:Partial<Payable>|null;next:Partial<Payable>&{action?:string;reason?:string};created_at:string};
export type PayablesData={rows:Payable[];stock:StockRow[];entries:AdminEntry[]};
export function payableState(p:Payable,stock?:StockRow,today=brazilDay()){
 if(!p.active||!stock?.active)return 'Arquivado';
 if(p.status==='PAGO')return 'Pago';
 if(stock.status==='PREVISTO')return 'Origem prevista';
 if(!p.due_date)return 'Sem vencimento';
 if(p.due_date<today)return 'Vencido';
 return p.due_date===today?'Vence hoje':'Pendente';
}
function id(value:unknown){if(typeof value!=='string'||!validId(value))throw new Error('Reabra a conta e confira os dados.');return value;}
function version(value:unknown){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('Atualize a lista antes de salvar.');return value;}
function date(value:unknown){if(typeof value!=='string'||!realDate(value)||value<'2000-01-01'||value>'2100-12-31')throw new Error('Confira a data informada.');return value;}
export function payableInput(body:Record<string,unknown>,today=brazilDay()){
 const p_id=id(body.id),p_expected=version(body.expected_updated_at);
 if(body.action==='schedule'){
  if(typeof body.notes!=='string'||body.notes.trim().length>2000)throw new Error('Use até 2.000 caracteres nas observações.');
  return {action:'schedule' as const,args:{p_id,p_expected,p_due:body.due_date===null||body.due_date===''?null:date(body.due_date),p_notes:body.notes.trim()}};
 }
 if(body.action==='pay'){
  const p_paid=date(body.paid_at);if(p_paid>today)throw new Error('A data do pagamento não pode ser futura.');
  if(!payableMethods.includes(body.method as typeof payableMethods[number])||body.confirmed!==true)throw new Error('Confira a forma de pagamento e confirme que o pagamento já foi realizado.');
  return {action:'pay' as const,args:{p_id,p_expected,p_request:id(body.request_id),p_paid,p_method:String(body.method),p_receipt:body.receipt_id===null||body.receipt_id===undefined?null:id(body.receipt_id),p_existing:body.existing_id===null||body.existing_id===undefined?null:id(body.existing_id)}};
 }
 if(body.action==='reverse'){
  if(typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.trim().length>1000)throw new Error('Informe o motivo da correção (3 a 1.000 caracteres).');
  return {action:'reverse' as const,args:{p_id,p_expected,p_reason:body.reason.trim()}};
 }
 throw new Error('Escolha uma ação válida.');
}
export function payableExisting(p:Payable,s:StockRow,entries:AdminEntry[],rows:Payable[]){
 const linked=new Set(rows.map(x=>x.ledger_entry_id).filter(Boolean));
 return entries.filter(e=>e.active&&e.kind==='CUSTO'&&e.scope==='LOJA'&&e.status==='REALIZADO'&&!e.details.stock_id&&Number(e.amount_cents)===Number(p.amount_cents)&&e.entry_date>=s.entry_date&&e.entry_date<=brazilDay()&&payableMethods.includes(e.details.payment_method as typeof payableMethods[number])&&!linked.has(e.id));
}
export function payableStats(rows:Payable[],stock:StockRow[],month:string,today=brazilDay()){
 const stocks=new Map(stock.map(s=>[s.id,s]));
 const active=rows.filter(p=>p.active&&stocks.get(p.stock_id)?.active&&stocks.get(p.stock_id)?.status!=='PREVISTO');
 const pending=active.filter(p=>p.status==='PENDENTE'),sum=(list:Payable[])=>list.reduce((n,p)=>n+Number(p.amount_cents),0);
 return {pending:sum(pending),overdue:sum(pending.filter(p=>p.due_date&&p.due_date<today)),dueMonth:sum(pending.filter(p=>p.due_date?.startsWith(month))),noDate:pending.filter(p=>!p.due_date).length,paidMonth:sum(active.filter(p=>p.status==='PAGO'&&p.paid_at?.startsWith(month))),planned:rows.filter(p=>p.active&&stocks.get(p.stock_id)?.active&&stocks.get(p.stock_id)?.status==='PREVISTO').length};
}
