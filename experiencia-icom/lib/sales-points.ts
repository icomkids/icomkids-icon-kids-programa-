import type {Experience} from './experience.ts';
export type SaleClosing={experience_id:string;lead_source:'store'|'own'|'internet';inspection_sold:boolean;full_return:boolean;full_documentation:boolean;feedback_video:boolean;created_at:string};
export const commercialItems=[['inspection_sold','Você vendeu o cautelar?'],['full_return','O retorno foi cheio?'],['full_documentation','A documentação foi cheia?'],['feedback_video','Gravou o vídeo de feedback do cliente para as redes sociais?']] as const;
export const sellerPointFields=['salesperson_rating','transparency_rating'] as const;
export const managerPointFields=['delivery_rating','store_cleanliness_rating','vehicle_cleanliness_rating','manager_rating'] as const;
export function closingParams(body:Record<string,unknown>){
 if(!['store','own','internet'].includes(String(body.lead_source))||commercialItems.some(([key])=>typeof body[key]!=='boolean'))throw new Error('Responda todos os itens do fechamento.');
 return {p_source:body.lead_source,p_inspection:body.inspection_sold,p_return:body.full_return,p_documentation:body.full_documentation,p_video:body.feedback_video};
}
export function experiencePoints(row:Experience){
 if(row.is_demo||row.status==='arquivada')return {seller:0,manager:0,commercial:0,ratings:0};
 const answers=row.completed_at?row.experience_responses[0]?.answers||{}:{};
 const valid=(key:string)=>typeof answers[key]==='number'&&Number.isInteger(answers[key])&&Number(answers[key])>=1&&Number(answers[key])<=5;
 const total=(fields:readonly string[])=>fields.reduce((n,k)=>n+(valid(k)?Number(answers[k]):0),0);
 const closing=row.experience_sale_closings?.[0];
 return {seller:total(sellerPointFields),manager:total(managerPointFields),commercial:closing?1+commercialItems.filter(([k])=>closing[k]).length:0,ratings:sellerPointFields.filter(valid).length};
}
export function pointsRanking(rows:Experience[]){
 const sellers=new Map<string,{id:string;name:string;quality:number;commercial:number;ratings:number;responses:number;pending:number}>();let manager=0;
 for(const r of rows){if(r.is_demo||r.status==='arquivada')continue;const p=experiencePoints(r);manager+=p.manager;const entry=sellers.get(r.salesperson_id)||{id:r.salesperson_id,name:r.salespeople.name,quality:0,commercial:0,ratings:0,responses:0,pending:0};entry.quality+=p.seller;entry.commercial+=p.commercial;entry.ratings+=p.ratings;entry.responses+=p.ratings?1:0;entry.pending+=r.seller_closing_required&&!r.experience_sale_closings?.length?1:0;sellers.set(entry.id,entry);}
 return {manager,sellers:[...sellers.values()].sort((a,b)=>b.quality-a.quality||a.name.localeCompare(b.name,'pt-BR'))};
}
