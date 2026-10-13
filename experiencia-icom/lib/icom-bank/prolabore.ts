import {validId,realDate} from './contracts.ts';
import {brazilDay} from './model.ts';

export type ProlaboreRecord={id:string;owner_id:string;reference_month:string;paid_at:string;amount_cents:number;source_account_id:string;target_account_id:string;notes:string;status:'REALIZADO'|'CANCELADO';created_at:string;updated_at:string};
export function prolaboreInput(b:Record<string,unknown>,today=brazilDay()){
 const text=(key:string,max:number)=>{const v=b[key];if(typeof v!=='string'||v.length>max)throw new Error('Confira os dados do pró-labore.');return v.trim();};
 const id=text('id',36),reference_month=text('reference_month',7),paid_at=text('paid_at',10),source_account_id=text('source_account_id',36),target_account_id=text('target_account_id',36),notes=text('notes',1000),amount_cents=b.amount_cents;
 if(!validId(id)||!validId(source_account_id)||!validId(target_account_id)||source_account_id===target_account_id)throw new Error('Escolha uma conta PJ de origem e uma conta PF de destino.');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(reference_month)||reference_month<'2000-01'||reference_month>today.slice(0,7)||!realDate(paid_at)||paid_at<'2000-01-01'||paid_at>today)throw new Error('Informe o mês e a data da transferência, até hoje.');
 if(typeof amount_cents!=='number'||!Number.isSafeInteger(amount_cents)||amount_cents<=0||amount_cents>1_000_000_000||b.confirmed!==true)throw new Error('Informe o valor recebido na PF e confirme que a transferência já aconteceu.');
 return {id,reference_month,paid_at,amount_cents,source_account_id,target_account_id,notes};
}
export function prolaboreSummary(rows:ProlaboreRecord[],period:string,today=brazilDay()){
 const done=rows.filter(r=>r.status==='REALIZADO'&&r.paid_at<=today);
 const selected=done.filter(r=>r.paid_at.startsWith(period));
 return {received:selected.reduce((n,r)=>n+Number(r.amount_cents),0),count:selected.length,total:done.reduce((n,r)=>n+Number(r.amount_cents),0)};
}
