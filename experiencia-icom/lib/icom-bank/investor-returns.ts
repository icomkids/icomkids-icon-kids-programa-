import {saleCash,capitalOwnerLabel,type CashEntry} from './cash.ts';
import {brazilDay} from './model.ts';
export function investorReturns(entries:CashEntry[],today=brazilDay()){
 const sales=entries.filter(e=>e.active&&e.kind==='VENDA'&&e.scope==='LOJA'&&e.status==='REALIZADO'&&e.entry_date<=today&&e.details.sale_owner==='INVESTIDOR');
 const pending=sales.map(sale=>({sale,cash:saleCash(sale,entries,today)})).filter(r=>r.cash.investor>0&&!r.cash.reviewNeeded);
 const groups=new Map<string,{id:string;name:string;type:string;total:number;rows:typeof pending}>();
 for(const row of pending){const d=row.sale.details,type=capitalOwnerLabel(d),name=d.investor_name||'Responsável não informado',key=type+':'+(d.investor_id||name.normalize('NFD').replace(/\p{M}/gu,'').trim().toLowerCase());const group=groups.get(key)||{id:key,name,type,total:0,rows:[]};group.total+=row.cash.investor;group.rows.push(row);groups.set(key,group);}
 const byId=new Map(entries.filter(e=>e.kind==='VENDA').map(e=>[e.id,e]));
 const history=entries.filter(e=>e.kind==='CUSTO'&&e.scope==='LOJA'&&e.status==='REALIZADO'&&e.entry_date<=today&&e.details.settlement_part==='INVESTIDOR'&&e.details.sale_cost_id).map(entry=>({entry,sale:byId.get(entry.details.sale_cost_id!)})).sort((a,b)=>b.entry.entry_date.localeCompare(a.entry.entry_date)||b.entry.created_at.localeCompare(a.entry.created_at));
 return {groups:[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),total:pending.reduce((n,r)=>n+r.cash.investor,0),count:pending.length,history};
}
