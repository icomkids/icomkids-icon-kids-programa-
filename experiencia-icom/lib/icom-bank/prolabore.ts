import {validId,realDate} from './contracts.ts';
import {brazilDay} from './model.ts';
import {monthlyDueDates} from './payables.ts';

export type ProlaboreRecord={id:string;owner_id:string;reference_month:string;paid_at:string|null;due_date?:string;series_id?:string|null;sequence_number?:number;months_count?:number;amount_cents:number;source_account_id:string;target_account_id:string;notes:string;status:'PREVISTO'|'REALIZADO'|'CANCELADO';created_at:string;updated_at:string};
export function prolaboreInput(b:Record<string,unknown>,today=brazilDay()){
 const text=(key:string,max:number)=>{const v=b[key];if(typeof v!=='string'||v.length>max)throw new Error('Confira os dados do pró-labore.');return v.trim();};
 const id=text('id',36),reference_month=text('reference_month',7),paid_at=text('paid_at',10),source_account_id=text('source_account_id',36),target_account_id=text('target_account_id',36),notes=text('notes',1000),amount_cents=b.amount_cents;
 if(!validId(id)||!validId(source_account_id)||!validId(target_account_id)||source_account_id===target_account_id)throw new Error('Escolha uma conta PJ de origem e uma conta PF de destino.');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(reference_month)||reference_month<'2000-01'||reference_month>today.slice(0,7)||!realDate(paid_at)||paid_at<'2000-01-01'||paid_at>today)throw new Error('Informe o mês e a data da transferência, até hoje.');
 if(typeof amount_cents!=='number'||!Number.isSafeInteger(amount_cents)||amount_cents<=0||amount_cents>1_000_000_000||b.confirmed!==true)throw new Error('Informe o valor recebido na PF e confirme que a transferência já aconteceu.');
 return {id,reference_month,paid_at,amount_cents,source_account_id,target_account_id,notes};
}
export function prolaboreSummary(rows:ProlaboreRecord[],period:string,today=brazilDay()){
 const done=rows.filter(r=>r.status==='REALIZADO'&&r.paid_at!==null&&r.paid_at<=today);
 const selected=done.filter(r=>r.paid_at?.startsWith(period)),planned=rows.filter(r=>r.status==='PREVISTO'&&prolaboreDate(r).startsWith(period));
 return {received:selected.reduce((n,r)=>n+Number(r.amount_cents),0),count:selected.length,total:done.reduce((n,r)=>n+Number(r.amount_cents),0),planned:planned.reduce((n,r)=>n+Number(r.amount_cents),0),pending:planned.length};
}
export const prolaboreDate=(r:ProlaboreRecord)=>r.paid_at||r.due_date||'';
const recordId=(v:unknown)=>{if(typeof v!=='string'||!validId(v))throw new Error('Reabra o pró-labore para continuar.');return v;};
const version=(v:unknown)=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw new Error('Atualize a lista antes de alterar.');return v;};
function template(b:Record<string,unknown>){
 const source_account_id=recordId(b.source_account_id),target_account_id=recordId(b.target_account_id),amount_cents=b.amount_cents,notes=b.notes;
 if(source_account_id===target_account_id||typeof amount_cents!=='number'||!Number.isSafeInteger(amount_cents)||amount_cents<=0||amount_cents>1_000_000_000||typeof notes!=='string'||notes.length>1000)throw new Error('Confira valor, conta PJ de origem e conta PF de destino.');
 return {source_account_id,target_account_id,amount_cents,notes:notes.trim()};
}
export function prolaboreScheduleInput(b:Record<string,unknown>,today=brazilDay()){
 const id=recordId(b.id),first_due=b.first_due,reference_month=b.reference_month,months=b.months;
 if(typeof first_due!=='string'||!realDate(first_due)||first_due<'2000-01-01'||first_due>'2100-12-31'||typeof reference_month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(reference_month)||reference_month<'2000-01'||reference_month>'2100-12'||typeof months!=='number'||!Number.isInteger(months)||months<1||months>60||typeof b.first_received!=='boolean')throw new Error('Informe a primeira data, o mês de referência e entre 1 e 60 meses.');
 const dates=monthlyDueDates(first_due,months);if((dates.at(-1)||'')>'2100-12-31'||(monthlyDueDates(reference_month+'-01',months).at(-1)||'')>'2100-12-31')throw new Error('A recorrência deve terminar até 2100.');
 const paid_at=b.first_received?b.paid_at:null;if(b.first_received&&(typeof paid_at!=='string'||!realDate(paid_at)||paid_at<'2000-01-01'||paid_at>today))throw new Error('Informe quando o primeiro pró-labore foi recebido, até hoje.');
 return {id,...template(b),first_due,reference_month,months,first_received:b.first_received,paid_at};
}
export function prolaboreReceiveInput(b:Record<string,unknown>,today=brazilDay()){
 if(b.confirmed!==true||typeof b.paid_at!=='string'||!realDate(b.paid_at)||b.paid_at<'2000-01-01'||b.paid_at>today)throw new Error('Confirme a transferência realizada e informe a data até hoje.');
 return {p_id:recordId(b.id),p_expected:version(b.expected_updated_at),p_paid:b.paid_at};
}
export function prolaboreEditInput(b:Record<string,unknown>){return {p_id:recordId(b.id),p_expected:version(b.expected_updated_at),p_payload:template(b)};}
