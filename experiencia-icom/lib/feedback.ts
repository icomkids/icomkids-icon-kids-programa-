import {analytics, type Experience} from './experience.ts';

export const feedbackItems = [
  ['Atendimento','salesperson_rating'],
  ['Experiência de compra','overall_rating'],
  ['Transparência','transparency_rating'],
  ['Documentação','documentation_experience'],
  ['Entrega do veículo','delivery_rating'],
  ['Limpeza da loja','store_cleanliness_rating'],
  ['Limpeza do veículo','vehicle_cleanliness_rating'],
] as const;

export function feedbackSummary(rows: Experience[]) {
  const completed = rows.filter(r=>r.completed_at && r.experience_responses.some(a=>Number.isInteger(a.nps_score)));
  const stats=analytics(completed);
  const items=feedbackItems.map(([label,key])=>{
    const scores=completed.flatMap(r=>r.experience_responses).map(r=>key==='documentation_experience' ? ['Muito complicado','Um pouco complicado','Normal','Fácil','Muito fácil'].indexOf(String(r.answers[key]))+1 : r.answers[key]).filter((v): v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=5);
    return {label,key,count:scores.length,mean:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null,satisfaction:scores.length?Math.round(scores.filter(v=>v>=4).length/scores.length*100):null,distribution:[1,2,3,4,5].map(score=>({score,count:scores.filter(v=>v===score).length,percent:scores.length?Math.round(scores.filter(v=>v===score).length/scores.length*100):null}))};
  });
  return {stats,items,experiences:rows.length,customers:new Set(rows.map(r=>r.customer_id)).size,responses:completed.length,responseRate:rows.length?Math.round(completed.length/rows.length*100):null,months:[...new Set(rows.map(r=>r.created_at.slice(0,7)))].sort(),completed};
}
