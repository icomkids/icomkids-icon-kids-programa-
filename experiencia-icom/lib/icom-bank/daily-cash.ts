import {adminInput,adminStats,type AdminEntry} from './administrative.ts';
import {cashPosition,type CashEntry} from './cash.ts';
import {realDate,validId} from './contracts.ts';
import {brazilDay} from './model.ts';

export type CashMetrics={opening_gross:number;opening_available:number;income:number;expenses:number;personal:number;gross:number;investor:number;capital:number;costs:number;review:number;available:number};
export type CashCheck={id:string;check_date:string;observed_cents:number;difference_cents:number;notes:string;metrics:CashMetrics;ledger_revision:string;actor_name:string;created_at:string};
export type DailyContext={entries:CashEntry[];revision:string};
export type DailyCashData={date:string;context:DailyContext;history:CashCheck[]};
export function cashDay(value:unknown,today=brazilDay()):string{
 if(typeof value!=='string'||!realDate(value)||value<'2000-01-01'||value>today)throw new Error('Escolha uma data válida, até hoje.');return value;
}
export function previousCashDay(day:string){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10);}
export function dailyCash(rows:CashEntry[],day:string):CashMetrics{
 const opening=cashPosition(rows,previousCashDay(day)),closing=cashPosition(rows,day),daily=adminStats(rows,day);
 return {opening_gross:opening.gross,opening_available:opening.available,income:daily.income,expenses:daily.expenses,personal:daily.personal,gross:closing.gross,investor:closing.investor,capital:closing.capital,costs:closing.costs,review:closing.review,available:closing.available};
}
const text=(value:unknown,max:number)=>{if(typeof value!=='string'||value.length>max)throw new Error('Confira os textos informados.');return value.trim();};
export function checkInput(body:Record<string,unknown>,today=brazilDay()){
 const id=text(body.id,36),date=cashDay(body.date,today),revision=text(body.revision,32),notes=text(body.notes,2000),observed=body.observed_cents;
 if(!validId(id)||!/^[a-f0-9]{32}$/.test(revision)||typeof observed!=='number'||!Number.isSafeInteger(observed)||Math.abs(observed)>1_000_000_000_000)throw new Error('Informe o saldo total conferido em reais.');
 return {id,date,revision,notes,observed_cents:observed};
}
export function withdrawalInput(body:Record<string,unknown>,today=brazilDay()){
 const id=text(body.id,36),date=cashDay(body.date,today),recipient=text(body.recipient,110),reason=text(body.reason,1200),method=text(body.method,20),purpose=text(body.purpose,20),sale_id=typeof body.sale_id==='string'?body.sale_id:'';
 if(recipient.length<2||reason.length<2||!['PIX','TRANSFERENCIA','DINHEIRO'].includes(method)||!['LOJA','PESSOAL','INVESTIDOR'].includes(purpose)||body.confirmed!==true||typeof body.amount_cents!=='number'||body.amount_cents<=0)throw new Error('Informe destinatário, motivo, valor positivo e confirme a saída já realizada.');
 if(purpose==='INVESTIDOR'&&!validId(sale_id))throw new Error('Selecione a venda para devolver a reserva do investidor.');
 const details:AdminEntry['details']={payment_method:method,notes:`Destinatário: ${recipient}\nMotivo: ${reason}`};
 if(purpose==='INVESTIDOR'){details.sale_cost_id=sale_id;details.settlement_part='INVESTIDOR';}
 return adminInput({id,expected_updated_at:null,kind:purpose==='PESSOAL'?'PESSOAL':'CUSTO',scope:purpose==='PESSOAL'?'PESSOAL':'LOJA',entry_date:date,description:`${method==='PIX'?'Pix':method==='DINHEIRO'?'Retirada':'Transferência'} · ${recipient}`,category:purpose==='INVESTIDOR'?'Devolução ao investidor':'Retirada / Pix',status:'REALIZADO',amount_cents:body.amount_cents,details});
}
