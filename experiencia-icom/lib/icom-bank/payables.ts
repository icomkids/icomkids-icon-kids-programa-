import {validId,realDate} from './contracts.ts';
import {brazilDay} from './model.ts';
import type {AdminEntry} from './administrative.ts';
import type {StockRow} from './stock.ts';
export const payableMethods=['PIX','DINHEIRO','CARTAO','TRANSFERENCIA','BOLETO'] as const;
export const payableLabels={IPVA:'IPVA',MULTAS:'Multas',QUITACAO:'Quitação',DESPESA:'Conta'};
export const payablePeople={BRUNO:'Bruno',GISELA:'Gisela',AMBOS:'Bruno e Gisela'};
export type Payable={id:string;stock_id:string|null;kind:keyof typeof payableLabels;scope?:'LOJA'|'PESSOAL';person?:keyof typeof payablePeople;title?:string;category?:string;series_id?:string|null;series_index?:number|null;series_count?:number;amount_cents:number;bank:string;due_date:string|null;notes:string;active:boolean;status:'PENDENTE'|'PAGO';paid_at:string|null;method:string|null;ledger_entry_id:string|null;receipt_id:string|null;created_at:string;updated_at:string};
export type PayableFile={id:string;payable_id:string;object_path:string;mime_type:string;size_bytes:number;status:'RESERVADO'|'ANEXADO';created_at:string};
export type PayableHistory={id:string;previous:Partial<Payable>|null;next:Partial<Payable>&{action?:string;reason?:string};created_at:string};
export type PayablesData={rows:Payable[];stock:StockRow[];entries:AdminEntry[]};
export function payableState(p:Payable,stock?:StockRow,today=brazilDay()){
 if(!p.active||p.stock_id&&!stock?.active)return 'Arquivado';
 if(p.status==='PAGO')return 'Pago';
 if(p.stock_id&&stock?.status==='PREVISTO')return 'Origem prevista';
 if(!p.due_date)return 'Sem vencimento';
 if(p.due_date<today)return 'Vencido';
 return p.due_date===today?'Vence hoje':'Pendente';
}
function id(value:unknown){if(typeof value!=='string'||!validId(value))throw new Error('Reabra a conta e confira os dados.');return value;}
function version(value:unknown){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('Atualize a lista antes de salvar.');return value;}
function date(value:unknown){if(typeof value!=='string'||!realDate(value)||value<'2000-01-01'||value>'2100-12-31')throw new Error('Confira a data informada.');return value;}
export function payableInput(body:Record<string,unknown>,today=brazilDay()){
 if(body.action==='expense')return {action:'expense' as const,args:expenseInput(body)};
 const p_id=id(body.id),p_expected=version(body.expected_updated_at);
 if(body.action==='archive'){
  if(typeof body.active!=='boolean')throw new Error('Confira a conta antes de arquivar ou restaurar.');
  return {action:'archive' as const,args:{p_id,p_expected,p_active:body.active}};
 }
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
export function payableExisting(p:Payable,s:StockRow|undefined,entries:AdminEntry[],rows:Payable[]){
 const linked=new Set(rows.map(x=>x.ledger_entry_id).filter(Boolean));
 const scope=p.scope||'LOJA',kinds=scope==='PESSOAL'?['PESSOAL','MENSAL']:['CUSTO','MENSAL'];
 return entries.filter(e=>e.active&&kinds.includes(e.kind)&&e.scope===scope&&e.status==='REALIZADO'&&!e.details.stock_id&&Number(e.amount_cents)===Number(p.amount_cents)&&e.entry_date>=(s?.entry_date||'2000-01-01')&&e.entry_date<=brazilDay()&&payableMethods.includes(e.details.payment_method as typeof payableMethods[number])&&!linked.has(e.id));
}
export function payableStats(rows:Payable[],stock:StockRow[],month:string,today=brazilDay()){
 const stocks=new Map(stock.map(s=>[s.id,s]));
 const active=rows.filter(p=>p.active&&(!p.stock_id||stocks.get(p.stock_id)?.active&&stocks.get(p.stock_id)?.status!=='PREVISTO'));
 const pending=active.filter(p=>p.status==='PENDENTE'),sum=(list:Payable[])=>list.reduce((n,p)=>n+Number(p.amount_cents),0);
 return {pending:sum(pending),overdue:sum(pending.filter(p=>p.due_date&&p.due_date<today)),dueMonth:sum(pending.filter(p=>p.due_date?.startsWith(month))),noDate:pending.filter(p=>!p.due_date).length,paidMonth:sum(active.filter(p=>p.status==='PAGO'&&p.paid_at?.startsWith(month))),planned:rows.filter(p=>p.active&&p.stock_id&&stocks.get(p.stock_id)?.active&&stocks.get(p.stock_id)?.status==='PREVISTO').length};
}
export function addPayableDays(day:string,count:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);}
export function monthlyDueDates(first:string,count:number){
 date(first);if(!Number.isInteger(count)||count<1||count>60)throw new Error('Escolha entre 1 e 60 meses.');
 const [y,m,day]=first.split('-').map(Number);
 return Array.from({length:count},(_,i)=>{const d=new Date(Date.UTC(y,m-1+i,1,12)),last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));const due=d.toISOString().slice(0,10);date(due);return due;});
}
export function expenseInput(body:Record<string,unknown>){
 const title=typeof body.title==='string'?body.title.trim():'',notes=typeof body.notes==='string'?body.notes.trim():'',category=typeof body.category==='string'?body.category.trim():'';
 const scope=typeof body.scope==='string'?body.scope:'',person=scope==='LOJA'?'AMBOS':body.person;
 if(typeof body.scope!=='string'||typeof person!=='string'||body.notes!==undefined&&typeof body.notes!=='string'||body.category!==undefined&&typeof body.category!=='string'||!['LOJA','PESSOAL'].includes(scope)||!Object.keys(payablePeople).includes(person)||title.length<2||title.length>160||category.length>80||notes.length>2000||typeof body.amount_cents!=='number'||!Number.isSafeInteger(body.amount_cents)||body.amount_cents<1||body.amount_cents>1000000000||typeof body.months!=='number')throw new Error('Confira descrição, valor, área e quantidade de meses.');
 const due_date=date(body.due_date);monthlyDueDates(due_date,body.months);
 const p_expected=body.expected_updated_at===null?null:version(body.expected_updated_at);
 if(p_expected&&body.months!==1)throw new Error('Edite somente esta conta; os demais meses são preservados.');
 return {p_expected,p_payload:{id:id(body.id),scope,person,title,category,notes,amount_cents:body.amount_cents,due_date,months:body.months}};
}
export type AgendaView='attention'|'overdue'|'today'|'week'|'month'|'day'|'all'|'paid'|'archived';
export function agendaMatches(p:Payable,s:StockRow|undefined,view:AgendaView,month:string,selectedDay:string,today=brazilDay()){
 const state=payableState(p,s,today);
 if(view==='archived')return state==='Arquivado';
 if(state==='Arquivado')return false;
 if(view==='paid')return p.status==='PAGO'&&!!p.paid_at?.startsWith(month);
 if(view==='all')return true;
 if(p.status==='PAGO')return false;
 if(view==='overdue')return state==='Vencido';
 if(view==='today')return state!=='Origem prevista'&&p.due_date===today;
 if(view==='week')return state!=='Origem prevista'&&!!p.due_date&&p.due_date>today&&p.due_date<=addPayableDays(today,7);
 if(view==='month')return !!p.due_date?.startsWith(month);
 if(view==='day')return p.due_date===selectedDay;
 return !p.due_date||p.due_date<=addPayableDays(today,7);
}
export function agendaStats(rows:Payable[],stock:StockRow[],month:string,today=brazilDay()){
 const stocks=new Map(stock.map(s=>[s.id,s])),active=rows.filter(p=>p.active&&p.status==='PENDENTE'&&(!p.stock_id||stocks.get(p.stock_id)?.active&&stocks.get(p.stock_id)?.status!=='PREVISTO'));
 const sum=(items:Payable[])=>items.reduce((n,p)=>n+Number(p.amount_cents),0),select=(view:AgendaView)=>active.filter(p=>agendaMatches(p,p.stock_id?stocks.get(p.stock_id):undefined,view,month,today,today));
 const monthly=select('month');return {overdue:{amount:sum(select('overdue')),count:select('overdue').length},today:{amount:sum(select('today')),count:select('today').length},week:{amount:sum(select('week')),count:select('week').length},month:{amount:sum(monthly),count:monthly.length},store:sum(monthly.filter(p=>p.scope!=='PESSOAL')),personal:sum(monthly.filter(p=>p.scope==='PESSOAL')),noDate:active.filter(p=>!p.due_date).length};
}
