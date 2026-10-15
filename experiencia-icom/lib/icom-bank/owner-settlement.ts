// No policy means a historical sale: preserve its original allocation.
export type OwnerCostPolicy='FIXO'|'DESCONTAR_CUSTOS';
type Details={sale_owner?:string;owner_cost_policy?:string;purchase_cents?:number;vehicle_cost_cents?:number;commission_cents?:number;documentation_sold?:boolean;documentation_cost_cents?:number;inspection_sold?:boolean;inspection_cost_cents?:number};
export function ownerSettlement(d:Details){
 const purchase=Number(d.purchase_cents||0),costs=Number(d.vehicle_cost_cents||0)+Number(d.commission_cents||0);
 const policy=d.sale_owner==='INVESTIDOR'?d.owner_cost_policy:undefined;
 const explicit=policy==='FIXO'||policy==='DESCONTAR_CUSTOS';
 // Maintenance/preparation only. Seller and services remain store costs.
 const preparation=Math.max(0,Number(d.vehicle_cost_cents||0)-(d.documentation_sold?Number(d.documentation_cost_cents||0):0)-(d.inspection_sold?Number(d.inspection_cost_cents||0):0));
 const deduction=policy==='DESCONTAR_CUSTOS'?Math.min(purchase,preparation):0;
 return {explicit,policy,purchase,costs,preparation,deduction,owner:Math.max(0,purchase-deduction),target:explicit?Math.max(0,purchase-deduction):purchase+costs,total:purchase+costs-deduction};
}
