import {adminStats,returnStore,saleProfit} from './administrative.ts';
import {cashPosition,type CashEntry} from './cash.ts';
import {brazilDay} from './model.ts';
import {wealthSummary,type WealthRecord} from './personal-wealth.ts';

export function financialOverview(rows:CashEntry[],wealth:WealthRecord[],period:string,today=brazilDay(),range?:{from:string;to:string}){
 const done=rows.filter(r=>r.active&&r.status==='REALIZADO'&&r.entry_date<=today),selected=done.filter(r=>range?r.entry_date>=range.from&&r.entry_date<=range.to:r.entry_date.startsWith(period));
 const sales=selected.filter(r=>r.kind==='VENDA'),soldStock=new Set(done.filter(r=>r.kind==='VENDA'&&r.details.stock_id).map(r=>r.details.stock_id));
 const saleIds=new Set(done.filter(r=>r.kind==='VENDA').map(r=>r.id));
 const amount=(r:CashEntry)=>Number(r.amount_cents||0);
 // Reuse the established sale profit. Purchase, vehicle costs and commission
 // are already deducted there; related cash settlements are not another expense.
 const expenses=selected.filter(r=>r.scope==='LOJA'&&['CUSTO','MENSAL'].includes(r.kind)&&!r.details.sale_cost_id&&!r.cash_cost_source_id&&!(r.details.stock_id&&soldStock.has(r.details.stock_id)));
 const other=selected.filter(r=>r.scope==='LOJA'&&r.kind==='ENTRADA'&&!r.cash_source_id);
 const earnings=sales.reduce((n,r)=>n+saleProfit(r),0)+selected.filter(r=>r.kind==='RETORNO').reduce((n,r)=>n+returnStore(r),0)+other.reduce((n,r)=>n+amount(r),0);
 const costs=expenses.reduce((n,r)=>n+amount(r),0),personal=adminStats(selected,period).personal,p=wealthSummary(wealth,period,today);
 const unlinked=selected.filter(r=>r.cash_source_id&&!saleIds.has(r.cash_source_id)).length;
 return {earnings,costs,personal,company:earnings-costs,real:earnings-costs-personal,otherIncome:p.income,total:earnings-costs-personal+p.income,wealth:p,cash:cashPosition(rows,today),sales:sales.length,unlinked,missing:selected.filter(r=>r.amount_cents===null&&r.kind==='MENSAL').length};
}
