import {realDate,validId} from './contracts.ts';
import {brazilDay} from './model.ts';
import {adminSaleSettlement,type AdminEntry} from './administrative.ts';
import {addPayableDays,payableMethods,type AgendaView} from './payables.ts';
export const receivableKinds={CLIENTE:'Cliente',BANCO:'Financiamento · banco',CARTAO:'Cartão · operadora'};
export type Receivable={id:string;source_entry_id:string|null;title:string;payer:string;kind:keyof typeof receivableKinds;bank:string;amount_cents:number;received_cents:number;due_date:string|null;notes:string;active:boolean;created_at:string;updated_at:string};
export type Receipt={id:string;receivable_id:string;ledger_entry_id:string;amount_cents:number;received_at:string;method:string;active:boolean;reason:string;created_at:string;updated_at:string};
export type ReceivableHistory={id:string;receivable_id:string;previous:Partial<Receivable>|null;next:Partial<Receivable>&{action?:string;reason?:string};created_at:string};
export type ReceivablesData={rows:Receivable[];receipts:Receipt[];entries:AdminEntry[]};
const integer=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=1000000000;
export function saleOutstanding(e:AdminEntry):number|null{
 const d=e.details;
 if(e.kind!=='VENDA'||e.scope!=='LOJA'||typeof d.trade_in!=='boolean'||!integer(d.sale_cents)||!integer(e.amount_cents))return null;
 if(d.trade_in){if(!integer(d.trade_value_cents)||typeof d.trade_has_debts!=='boolean')return null;if(d.trade_has_debts&&(!integer(d.trade_ipva_cents)||!integer(d.trade_fines_cents)||typeof d.trade_has_payoff!=='boolean'||d.trade_has_payoff&&!integer(d.trade_payoff_cents)))return null;}
 try{const rest=adminSaleSettlement(Number(d.sale_cents),d).remaining;if(rest<Number(e.amount_cents))return null;return rest-(e.status==='REALIZADO'?Number(e.amount_cents):0);}catch{return null;}
}
export const receivableRemaining=(r:Receivable)=>Number(r.amount_cents)-Number(r.received_cents);
export function receivableState(r:Receivable,s?:AdminEntry,today=brazilDay()){
 if(!r.active||r.source_entry_id&&!s?.active)return 'Arquivada';
 if(r.source_entry_id&&s?.status!=='REALIZADO')return 'Origem prevista';
 if(receivableRemaining(r)<=0)return 'Recebida';
 if(!r.due_date)return 'Sem vencimento';
 if(r.due_date<today)return 'Em atraso';
 return r.due_date===today?'Vence hoje':Number(r.received_cents)>0?'Parcial':'Pendente';
}
export function receivableMatches(r:Receivable,s:AdminEntry|undefined,view:AgendaView,month:string,day:string,today=brazilDay(),receipts:Receipt[]=[]){
 const state=receivableState(r,s,today);
 if(view==='archived')return state==='Arquivada';
 if(state==='Arquivada')return false;
 if(view==='paid')return receipts.some(p=>p.active&&p.receivable_id===r.id&&p.received_at.startsWith(month));
 if(view==='all')return true;
 if(state==='Recebida')return false;
 if(view==='overdue')return state==='Em atraso';
 if(view==='today')return state!=='Origem prevista'&&r.due_date===today;
 if(view==='week')return state!=='Origem prevista'&&!!r.due_date&&r.due_date>today&&r.due_date<=addPayableDays(today,7);
 if(view==='month')return !!r.due_date?.startsWith(month);
 if(view==='day')return r.due_date===day;
 return !r.due_date||r.due_date<=addPayableDays(today,7);
}
export function receivableStats(rows:Receivable[],entries:AdminEntry[],receipts:Receipt[],month:string,today=brazilDay()){
 const sources=new Map(entries.map(e=>[e.id,e])),active=rows.filter(r=>r.active&&(!r.source_entry_id||sources.get(r.source_entry_id)?.active&&sources.get(r.source_entry_id)?.status==='REALIZADO'));
 const pending=active.filter(r=>receivableRemaining(r)>0),sum=(items:Receivable[])=>items.reduce((n,r)=>n+receivableRemaining(r),0),select=(view:AgendaView)=>pending.filter(r=>receivableMatches(r,r.source_entry_id?sources.get(r.source_entry_id):undefined,view,month,today,today));
 return {pending:sum(pending),overdue:{amount:sum(select('overdue')),count:select('overdue').length},today:{amount:sum(select('today')),count:select('today').length},week:{amount:sum(select('week')),count:select('week').length},month:{amount:sum(select('month')),count:select('month').length},noDate:pending.filter(r=>!r.due_date).length,receivedMonth:receipts.filter(p=>p.active&&p.received_at.startsWith(month)&&active.some(r=>r.id===p.receivable_id)).reduce((n,p)=>n+Number(p.amount_cents),0)};
}
const id=(v:unknown)=>{if(typeof v!=='string'||!validId(v))throw new Error('Reabra a conta e confira os dados.');return v;};
const version=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(v)||!Number.isFinite(Date.parse(v)))throw new Error('Atualize a lista antes de salvar.');return v;};
const date=(v:unknown)=>{if(typeof v!=='string'||!realDate(v)||v<'2000-01-01'||v>'2100-12-31')throw new Error('Confira a data informada.');return v;};
const text=(v:unknown,max:number)=>{if(v===undefined)return '';if(typeof v!=='string'||v.trim().length>max)throw new Error('Confira os textos da conta.');return v.trim();};
export function receivableInput(b:Record<string,unknown>,today=brazilDay()){
 const p_id=id(b.id);
 if(b.action==='save'){
  const title=text(b.title,160),payer=text(b.payer,160),kind=text(b.kind,20),bank=text(b.bank,120),notes=text(b.notes,2000),p_expected=b.expected_updated_at===null?null:version(b.expected_updated_at);
  if(title.length<2||!Object.keys(receivableKinds).includes(kind)||!integer(b.amount_cents)||!p_expected&&Number(b.amount_cents)<=0)throw new Error('Confira a descrição, o valor e quem paga.');
  const due_date=b.due_date===null?null:date(b.due_date);if(!p_expected&&due_date===null)throw new Error('Informe o vencimento desta conta.');
  return {action:'save' as const,args:{p_payload:{id:p_id,title,payer,kind,bank,notes,amount_cents:b.amount_cents,due_date},p_expected}};
 }
 const p_expected=version(b.expected_updated_at);
 if(b.action==='receive'){
  const p_date=date(b.received_at);if(p_date>today||!integer(b.amount_cents)||Number(b.amount_cents)<=0||b.confirmed!==true||!payableMethods.includes(b.method as typeof payableMethods[number]))throw new Error('Confira o valor, a data e confirme que o dinheiro já foi recebido.');
  return {action:'receive' as const,args:{p_id,p_expected,p_request:id(b.request_id),p_amount:b.amount_cents,p_date,p_method:String(b.method),p_existing:b.existing_id===null||b.existing_id===undefined?null:id(b.existing_id)}};
 }
 if(b.action==='reverse'){
  const p_reason=text(b.reason,1000);if(p_reason.length<3)throw new Error('Informe o motivo da correção.');
  return {action:'reverse' as const,args:{p_id,p_expected,p_receipt:id(b.receipt_id),p_reason}};
 }
 if(b.action==='archive'){
  if(typeof b.active!=='boolean')throw new Error('Confira a conta antes de arquivar ou restaurar.');
  return {action:'archive' as const,args:{p_id,p_expected,p_active:b.active}};
 }
 throw new Error('Escolha uma ação válida.');
}
export function receivableExisting(r:Receivable,s:AdminEntry|undefined,entries:AdminEntry[],receipts:Receipt[],today=brazilDay()){
 const linked=new Set(receipts.map(p=>p.ledger_entry_id));
 return entries.filter(e=>e.active&&e.kind==='ENTRADA'&&e.scope==='LOJA'&&e.status==='REALIZADO'&&Number(e.amount_cents)>0&&Number(e.amount_cents)<=receivableRemaining(r)&&e.entry_date>=(s?.entry_date||'2000-01-01')&&e.entry_date<=today&&payableMethods.includes(e.details.payment_method as typeof payableMethods[number])&&!linked.has(e.id));
}
