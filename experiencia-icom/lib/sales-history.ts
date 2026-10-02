import type {Experience} from './experience.ts';
import {qualitySummary,monthBR} from './quality.ts';
export function saleDate(value:unknown,today=monthBR(new Date().toISOString())+'-'+new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',day:'2-digit'}).format(new Date())) {
 const date=String(value||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>today||date<'1900-01-01')throw new Error('Informe uma data de venda válida, até hoje.');
 return date;
}
export function salesHistory(rows:Experience[]){
 const groups=new Map<string,{month:string;id:string;name:string;rows:Experience[]}>();
 for(const r of rows){if(r.is_demo||r.status==='arquivada'||!/^\d{4}-\d{2}-\d{2}$/.test(r.purchase_date||''))continue;const month=r.purchase_date.slice(0,7),key=month+':'+r.salesperson_id;const group=groups.get(key)||{month,id:r.salesperson_id,name:r.salespeople.name,rows:[]};if(!group.rows.some(x=>x.id===r.id))group.rows.push(r);groups.set(key,group);}
 return [...groups.values()].map(g=>({...g,sales:g.rows.length,responses:g.rows.filter(r=>r.completed_at).length,quality:qualitySummary(g.rows)})).sort((a,b)=>b.month.localeCompare(a.month)||b.sales-a.sales||a.name.localeCompare(b.name,'pt-BR'));
}
