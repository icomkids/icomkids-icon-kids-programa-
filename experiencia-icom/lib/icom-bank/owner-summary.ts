import {financialOverview} from './financial-overview.ts';
import {prolaboreSummary,type ProlaboreRecord} from './prolabore.ts';
import {brazilDay} from './model.ts';
import type {CashEntry} from './cash.ts';
import type {WealthRecord} from './personal-wealth.ts';

// Presentation breakdown only. The established cash and profit calculations stay intact.
export function ownerSummary(rows:CashEntry[],wealth:WealthRecord[],prolabore:ProlaboreRecord[],propertyLedgerIds:readonly string[],period:string,today=brazilDay()){
 const original=financialOverview(rows,wealth,period,today),linked=new Set(propertyLedgerIds);
 const propertyCosts=rows.filter(r=>linked.has(r.id)&&r.active&&r.status==='REALIZADO'&&r.scope==='PESSOAL'&&['PESSOAL','MENSAL'].includes(r.kind)&&r.entry_date<=today&&r.entry_date.startsWith(period)).reduce((n,r)=>n+Number(r.amount_cents||0),0);
 const personalCosts=original.personal-propertyCosts,pay=prolaboreSummary(prolabore,period,today);
 const registered=prolabore.filter(r=>r.status!=='CANCELADO'&&r.reference_month.startsWith(period)&&r.reference_month<=today.slice(0,7)).reduce((n,r)=>n+Number(r.amount_cents),0);
 return {original,propertyCosts,propertyIncome:original.otherIncome,propertyResult:original.otherIncome-propertyCosts,personalCosts,prolaboreRegistered:registered,prolaboreReceived:pay.received,personalBalance:pay.received-personalCosts,personalPlannedBalance:registered-personalCosts,hasPlanned:pay.pending>0};
}
