import {saleCost,saleProfit,type AdminEntry} from './administrative.ts';
import {brazilDay} from './model.ts';
const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
export function salesRows(rows:AdminEntry[],query='',month='',archived=false){
 const text=fold(query.trim());
 return rows.filter(r=>r.kind==='VENDA'&&r.active!==archived&&r.entry_date.startsWith(month)&&(!text||fold([r.details.customer_name,r.details.vehicle,r.details.plate,r.details.seller].filter(Boolean).join(' ')).includes(text))).sort((a,b)=>a.entry_date.localeCompare(b.entry_date)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
}
export function salesTotals(rows:AdminEntry[],today=brazilDay()){
 const realized=rows.filter(r=>r.kind==='VENDA'&&r.active&&r.status==='REALIZADO'&&r.entry_date<=today);
 return {count:realized.length,cost:realized.reduce((n,r)=>n+saleCost(r),0),sale:realized.reduce((n,r)=>n+Number(r.details.sale_cents||0),0),profit:realized.reduce((n,r)=>n+saleProfit(r),0)};
}
