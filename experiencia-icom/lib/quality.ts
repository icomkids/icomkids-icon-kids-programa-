import {ratingValue} from './rating-scale.ts';
import type {Experience} from './experience.ts';
import {sellerPointFields,managerPointFields} from './sales-points.ts';
export {sellerPointFields,managerPointFields};
export function qualityBand(percent:number|null){return percent===null?{label:'Sem avaliações',tone:'empty'}:percent>=90?{label:'Ótimo',tone:'excellent'}:percent>=80?{label:'Bom',tone:'good'}:percent>=70?{label:'Médio',tone:'medium'}:{label:'Ruim · atenção',tone:'poor'};}
export function qualitySummary(rows:Experience[],fields:readonly string[]=sellerPointFields){
 const eligible=rows.filter(r=>!r.is_demo&&r.status!=='arquivada'&&r.completed_at);
 const values=eligible.flatMap(r=>fields.map(key=>ratingValue(r.experience_responses[0]?.answers||{},key,r.rating_scale)).filter((v):v is number=>v!==null));
 const total=values.length,positive=values.filter(v=>v>=8).length,low=values.filter(v=>v<=4).length;
 const percent=total?100*positive/total:null;
 return {total,positive,low,percent,mean:total?values.reduce((a,b)=>a+b,0)/total:null,...qualityBand(percent)};
}
export function monthBR(date:string){if(!date||!Number.isFinite(Date.parse(date)))return '';const parts=new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date(date));return `${parts.find(p=>p.type==='year')?.value}-${parts.find(p=>p.type==='month')?.value}`;}
