// Pure pricing shared by the booking service and the administrator calendar.
export const rateCategories = {low:'Baixa temporada',high:'Alta temporada',holiday:'Feriado prolongado',event:'Data festiva',custom:'Data específica'};
export const ratePriorities = {low:10,high:10,holiday:20,event:30,custom:40};
export function nightlyRate(day, config, rules=[]) {
  const rule=rules.filter(r=>r.start<=day&&r.end>=day).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id))[0];
  const weekend=[5,6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
  return {day,amount:rule?(weekend?rule.weekend:rule.weekday):(weekend?config.weekend:config.weekday),label:rule?rule.title:(weekend?'Fim de semana':'Tarifa básica'),ruleId:rule?.id||null,minNights:Math.max(config.minNights,rule?.min_nights||1)};
}
