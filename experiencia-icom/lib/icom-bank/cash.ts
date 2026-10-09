import {adminSaleSettlement,adminStats,saleProfit,type AdminEntry} from './administrative.ts';

export const tradeDestinations={REPASSE:'Repasse',LOJA:'Loja · ICOM Motors',INVESTIDOR:'Investidor'} as const;
export type CashEntry=AdminEntry&{cash_account_id?:string;cash_account_purpose?:'MOVIMENTO'|'SALDO_INICIAL'|'RENDA_PESSOAL';cash_source_id?:string|null;cash_cost_source_id?:string|null;cash_cost_part?:'CUSTOS'|'DEBITOS'|null;cash_stock_origin_id?:string|null};
export type SaleCash={id:string;received:number;investor:number;capital:number;costs:number;review:number;reviewNeeded:boolean;available:number;loss:number;lossAdjustment:number;profit:number;returned:number;costPaid:number};
const amount=(e:AdminEntry)=>Number(e.amount_cents||0);
export function sameTradeInvestor(d:AdminEntry['details']):boolean{
 if(d.sale_owner!=='INVESTIDOR'||!d.trade_in||d.trade_destination!=='INVESTIDOR')return false;
 if(d.investor_id&&d.trade_investor_id)return d.investor_id===d.trade_investor_id;
 return !!d.investor_name?.trim()&&d.trade_investor_name?.trim().toLocaleLowerCase('pt-BR')===d.investor_name.trim().toLocaleLowerCase('pt-BR');
}
function collected(sale:CashEntry,active:CashEntry[],seen=new Set<string>()):number{
 if(seen.has(sale.id))return 0;seen.add(sale.id);
 const direct=amount(sale)+active.filter(e=>e.kind==='ENTRADA'&&e.cash_source_id===sale.id).reduce((n,e)=>n+amount(e),0);
 if(sale.details.sale_owner!=='INVESTIDOR')return direct;
 // If the trade remains for resale, its collected capital belongs to the
 // original investor operation. Forward it once, never duplicate a cash entry.
 return direct+active.filter(e=>e.kind==='VENDA'&&e.cash_stock_origin_id===sale.id&&e.details.sale_owner==='LOJA').reduce((n,e)=>n+Math.min(Number(e.details.purchase_cents||0),collected(e,active,seen)),0);
}
// Investor sales retain the already-calculated net store profit. All remaining
// proceeds belong to the investor; expenses paid on their behalf reduce that return.
export function saleCash(sale:AdminEntry,rows:CashEntry[],cutoff='2100-12-31'):SaleCash{
 const active=rows.filter(e=>e.active&&e.status==='REALIZADO'&&e.entry_date<=cutoff);
 const realised=sale.active&&sale.status==='REALIZADO'&&sale.entry_date<=cutoff;
 const payments=active.filter(e=>e.kind==='ENTRADA'&&e.cash_source_id===sale.id);
 const received=realised?collected(sale,active):payments.reduce((n,e)=>n+amount(e),0);
 const out=active.filter(e=>e.kind==='CUSTO'&&e.details.sale_cost_id===sale.id);
 const returned=out.filter(e=>e.details.settlement_part==='INVESTIDOR').reduce((n,e)=>n+amount(e),0);
 const capitalPaid=out.filter(e=>e.details.settlement_part==='CAPITAL').reduce((n,e)=>n+amount(e),0);
 const costPaid=active.filter(e=>e.kind==='CUSTO'&&(e.details.sale_cost_id===sale.id&&e.details.settlement_part==='CUSTOS'||e.cash_cost_source_id===sale.id&&e.cash_cost_part==='CUSTOS')).reduce((n,e)=>n+amount(e),0);
 const debtPaid=active.filter(e=>e.kind==='CUSTO'&&e.cash_cost_source_id===sale.id&&e.cash_cost_part==='DEBITOS').reduce((n,e)=>n+amount(e),0);
 const d=sale.details,profit=saleProfit(sale),base={id:sale.id,received,investor:0,capital:0,costs:0,review:0,reviewNeeded:false,available:0,loss:0,lossAdjustment:0,profit,returned,costPaid};
 if(!realised)return base;
 const unknown=!['LOJA','INVESTIDOR'].includes(d.sale_owner||'')||d.sale_owner==='INVESTIDOR'&&!d.investor_name||d.trade_in===undefined||d.trade_in&&!d.trade_destination;
 if(unknown)return {...base,review:Math.max(0,received-returned-capitalPaid),reviewNeeded:true};
 const repasse=d.sale_mode==='REPASSE',investor=d.sale_owner==='INVESTIDOR';
 const originId=(sale as CashEntry).cash_stock_origin_id;
 const capitalForwarded=repasse&&originId&&active.some(e=>e.id===originId&&e.kind==='VENDA'&&e.details.sale_owner==='INVESTIDOR');
 const trade=adminSaleSettlement(Number(d.sale_cents||0),d);
 const sameInvestor=sameTradeInvestor(d);
 const principal=investor?Math.max(0,Number(d.sale_cents||0)-profit-(sameInvestor?trade.credit:0)-costPaid-(sameInvestor?debtPaid:0)):repasse?Math.max(0,Number(d.purchase_cents||0)):0;
 const principalPaid=investor?returned:capitalPaid;
 const debtReserve=investor&&sameInvestor?0:Math.max(0,trade.debt-debtPaid);
 const held=capitalForwarded?0:Math.min(Math.max(0,received-principalPaid-(investor?costPaid+debtPaid+debtReserve:0)),Math.max(0,principal-principalPaid));
 const costTarget=(repasse?Math.max(0,Number(d.vehicle_cost_cents||0)+Number(d.commission_cents||0)-costPaid):0)+debtReserve;
 const forwarded=capitalForwarded?Math.min(received,principal):0;
 const budget=received-principalPaid-held-costPaid-debtPaid-forwarded;
 const costs=Math.min(Math.max(0,budget),costTarget);
 const loss=(repasse||investor)&&received>=(investor&&!sameInvestor?Number(d.sale_cents||0):trade.remaining)?Math.min(0,profit):0;
 const lossAdjustment=loss<0?loss-Math.min(0,budget):0;
 return {...base,investor:investor?held:0,capital:repasse?held:0,costs,available:budget-costs+lossAdjustment,loss,lossAdjustment};
}
export function cashPosition(rows:CashEntry[],cutoff='2100-12-31'){
 const active=rows.filter(e=>e.active&&e.status==='REALIZADO'&&e.entry_date<=cutoff),stats=adminStats(active,'');
 const sales=active.filter(e=>e.kind==='VENDA').map(e=>saleCash(e,rows,cutoff));
 const sum=(key:'investor'|'capital'|'costs'|'review'|'loss')=>sales.reduce((n,s)=>n+s[key],0);
 const investor=sum('investor'),capital=sum('capital'),costs=sum('costs'),review=sum('review'),loss=sum('loss');
 return {gross:stats.combined,investor,capital,costs,review,loss,available:stats.combined-investor-capital-costs-review+sales.reduce((n,s)=>n+s.lossAdjustment,0),sales,reviewCount:sales.filter(s=>s.reviewNeeded).length};
}
