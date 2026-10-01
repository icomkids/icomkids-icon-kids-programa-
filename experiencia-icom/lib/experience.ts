export type Answers = Record<string, string | number | boolean | string[]>;
export function relationArray<T>(value: T | T[] | null | undefined): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}
export type Category = 'promoter' | 'passive' | 'detractor';
export const category = (score: number): Category => score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor';
export const validToken = (token: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
export function assertEditable(record: {completed_at:string|null;status:string}) {
  if(record.completed_at) throw new Error('Obrigado. Sua avaliação já foi registrada.');
  if(record.status==='arquivada') throw new Error('Esta experiência foi arquivada.');
}
export const ratingFields = ['overall_rating','salesperson_rating','transparency_rating','delivery_rating','store_cleanliness_rating','vehicle_cleanliness_rating','manager_rating','owner_rating'];
const answerLabels: Record<string,string> = {overall_rating:'Experiência de compra',salesperson_rating:'Atendimento do vendedor',salesperson_understanding:'O vendedor entendeu o que procurava?',transparency_rating:'Transparência na negociação',documentation_experience:'Documentação e pagamento',delivery_rating:'Entrega do veículo',nps_score:'Chance de recomendar a Icom (0 a 10)',positive_highlights:'Pontos positivos',improvement_areas:'O que pode melhorar',problem_areas:'Problemas apontados',customer_feedback:'Comentário do cliente',contact_requested:'Deseja contato da gestão?',store_cleanliness_rating:'Limpeza da loja',vehicle_cleanliness_rating:'Limpeza do veículo',discovery_source:'Como conheceu a Icom',discovery_source_other:'Outra origem'};
export const answerLabel = (key: string) => answerLabels[key] || key.replaceAll('_',' ');
export function alertRule(a: Answers, manual = false) {
  const reasons: string[] = [];
  if (Number(a.nps_score) <= 6) reasons.push('NPS detrator');
  ratingFields.forEach(k => { if (typeof a[k] === 'number' && Number(a[k]) <= 2) reasons.push(`Nota baixa: ${k}`); });
  if (['Um pouco complicado', 'Muito complicado'].includes(String(a.documentation_experience))) reasons.push('Dificuldade na documentação');
  if (a.contact_requested === 'Sim' || a.contact_requested === true) reasons.push('Contato solicitado');
  if (manual) reasons.push('Problema registrado pela gestão');
  return {level: reasons.length ? 'critical' : Number(a.nps_score) < 9 ? 'attention' : 'none', reasons};
}
export interface Experience { vehicle_plate?:string|null; id: string; token: string; customer_id: string; salesperson_id: string; vehicle_id: string; purchase_date: string; delivery_date: string; status: string; created_at: string; sent_at: string | null; completed_at: string | null; is_demo: boolean; customers: {name: string; phone: string; customer_type: string}; salespeople: {name: string}; vehicles: {name: string}; experience_responses: {answers: Answers; nps_score: number; nps_category: Category}[]; experience_alerts: Alert[] }
export interface Alert { id: string; experience_id: string; alert_level: string; alert_reason: string; resolution_status: string; assigned_to: string | null; created_at: string; resolved_at: string | null; resolution_notes: string | null; experience_alert_events?: {description: string; event_type: string; created_at: string}[] }
export const resolutions = ['Novo','Em análise','Contato iniciado','Aguardando cliente','Resolvido','Não resolvido'];
export const statuses = ['criada','enviada','aberta','iniciada','respondida','atendimento necessário','em tratamento','resolvida','arquivada'];
export function analytics(rows: Experience[]) {
  const responses = rows.flatMap(r => r.experience_responses).filter(r => typeof r.nps_score === 'number' && Number.isInteger(r.nps_score));
  const count = responses.length;
  const promoters = responses.filter(r => r.nps_score >= 9).length;
  const detractors = responses.filter(r => r.nps_score <= 6).length;
  const mean = (field: string) => { const values = responses.map(r => field === 'documentation_experience' ? ['Muito complicado','Um pouco complicado','Normal','Fácil','Muito fácil'].indexOf(String(r.answers[field])) + 1 : Number(r.answers[field])).filter(v => v > 0); return values.length ? values.reduce((a,b) => a+b,0) / values.length : null; };
  const rank = (fields: string[]) => { const counts: Record<string, number> = {}; responses.forEach(r => fields.forEach(f => { const items = r.answers[f]; if(Array.isArray(items)) items.forEach(v => counts[v] = (counts[v] || 0)+1); else if(typeof items==='string'&&items) counts[items]=(counts[items]||0)+1; })); return Object.entries(counts).sort((a,b) => b[1]-a[1]); };
  const alerts = rows.flatMap(r => r.experience_alerts); const closed = alerts.filter(a => ['Resolvido','Não resolvido'].includes(a.resolution_status));
  const contactHours = alerts.flatMap(a => {const event = a.experience_alert_events?.find(e => e.event_type === 'customer_contact_started'); return event ? [(Date.parse(event.created_at)-Date.parse(a.created_at))/3600000] : [];});
  return {count, promoters, detractors, passives: count-promoters-detractors, nps: count ? Math.round(100*(promoters-detractors)/count) : null, responseRate: rows.length ? Math.round(count/rows.length*100) : 0, mean, discovery:rank(['discovery_source']), praise:rank(['positive_highlights']), improvements:rank(['improvement_areas','problem_areas']), resolutionRate:closed.length ? Math.round(100*closed.filter(a => a.resolution_status === 'Resolvido').length/closed.length) : null, contactHours:contactHours.length ? contactHours.reduce((a,b)=>a+b,0)/contactHours.length : null};
}
export interface Question { key: string; title: string; help?: string; kind: 'rating' | 'options' | 'nps' | 'multi' | 'text'; options?: string[]; optional?: boolean }
const trust = ['Sim, muito','Sim, em parte','Não fez diferença','Não'];
export function questions(a: Answers): Question[] {
  const q: Question[] = [
    {key:'overall_rating',title:'De maneira geral, como você avalia sua experiência de compra na Icom?',kind:'rating'},
    {key:'salesperson_rating',title:'Como você avalia o atendimento do seu vendedor?',help:'Pense em atenção, cordialidade, disponibilidade e clareza durante sua compra.',kind:'rating'},
    {key:'salesperson_understanding',title:'Você sentiu que nosso vendedor entendeu o que você realmente procurava?',kind:'options',options:['Sim, completamente','Em grande parte','Parcialmente','Pouco','Não']},
    {key:'transparency_rating',title:'Como você avalia a transparência da Icom durante a negociação?',help:'Considere valores, condições e tudo aquilo que foi combinado.',kind:'rating'},
    {key:'documentation_experience',title:'Como foi sua experiência com documentação, pagamento e finalização da compra?',kind:'options',options:['Muito fácil','Fácil','Normal','Um pouco complicado','Muito complicado']},
    {key:'delivery_rating',title:'Como você avalia a experiência de receber seu veículo?',help:'Considere apresentação, limpeza, explicações e cumprimento do combinado.',kind:'rating'},
    {key:'store_cleanliness_rating',title:'Como você avalia a limpeza da nossa loja?',kind:'rating'},
    {key:'vehicle_cleanliness_rating',title:'Como você avalia a limpeza do veículo na entrega?',kind:'rating'},
    {key:'discovery_source',title:'Como você conheceu a Icom?',kind:'options',options:['Instagram','Facebook','Google / pesquisa na internet','Indicação de amigo ou familiar','Passei em frente à loja','Site de anúncios de veículos','Já era cliente','Outro']},
    {key:'nps_score',title:'De 0 a 10, qual a chance de você recomendar a Icom para um amigo ou familiar?',kind:'nps'},
    {key:'leadership_contact',title:'Durante sua compra, você teve contato com alguém da liderança da Icom?',kind:'options',options:['Sim, com o gerente Luiz Lázaro','Sim, com o proprietário Bruno Lira','Sim, com ambos','Não tive contato','Não me lembro']}
  ];
  if(a.discovery_source==='Outro') q.splice(q.findIndex(item=>item.key==='discovery_source')+1,0,{key:'discovery_source_other',title:'Onde você conheceu a Icom?',kind:'text'});
  const leadership = String(a.leadership_contact || '');
  if (leadership.includes('gerente') || leadership.includes('ambos')) q.push({key:'manager_rating',title:'Como você avalia a participação do gerente Luiz Lázaro?',kind:'rating'},{key:'manager_trust_impact',title:'A participação do gerente trouxe mais segurança e confiança para sua compra?',kind:'options',options:trust});
  if (leadership.includes('proprietário') || leadership.includes('ambos')) q.push({key:'owner_rating',title:'Como você avalia a participação do proprietário Bruno Lira?',kind:'rating'},{key:'owner_trust_impact',title:'A participação do proprietário trouxe mais segurança e confiança para sua compra?',kind:'options',options:trust});
  if (leadership.includes('gerente') || leadership.includes('proprietário') || leadership.includes('ambos')) q.push({key:'leadership_feedback',title:'Gostaria de comentar a participação da liderança?',kind:'text',optional:true});
  const nps = Number(a.nps_score ?? 10);
  if(nps >= 9) q.push({key:'positive_highlights',title:'Que bom saber disso! O que mais te marcou positivamente?',kind:'multi',options:['Atendimento do vendedor','Confiança','Transparência','Negociação','Qualidade do veículo','Agilidade','Entrega do veículo','Estrutura da loja','Participação da gestão','Outro']});
  else q.push({key:nps >= 7 ? 'improvement_areas' : 'problem_areas',title:nps >= 7 ? 'O que faltou para sua experiência ser nota 10?' : 'Sentimos que sua experiência não foi como deveria. Em qual momento precisamos melhorar?',kind:'multi',options:['Atendimento do vendedor','Negociação','Informações sobre o veículo','Condições do veículo','Financiamento','Documentação','Prazo','Comunicação','Entrega do veículo','Pós-venda','Participação da gestão','Outro']});
  q.push({key:'customer_feedback',title:nps <= 6 ? 'Conte para nós o que aconteceu.' : nps <= 8 ? 'Conte para nós o que poderíamos melhorar.' : 'Quer deixar algum comentário sobre sua experiência?',kind:'text',optional:nps >= 7});
  if(nps <= 6) q.push({key:'contact_requested',title:'Você gostaria que alguém da gestão entrasse em contato com você?',kind:'options',options:['Sim','Não']});
  return q;
}
export function sanitizeAnswers(raw: Answers, final = false): Answers {
  const clean: Answers = {};
  for (const q of questions(raw)) {
    const v = raw[q.key]; const missing = v === undefined || v === '' || (Array.isArray(v) && !v.length);
    if(missing) { if(final && !q.optional) throw new Error('Responda todas as perguntas obrigatórias.'); continue; }
    if(q.kind === 'rating' || q.kind === 'nps') { if(typeof v !== 'number' || !Number.isInteger(v) || v < (q.kind === 'nps' ? 0 : 1) || v > (q.kind === 'nps' ? 10 : 5)) throw new Error('Nota inválida.'); }
    if(q.kind === 'options' && !q.options?.includes(String(v))) throw new Error('Opção inválida.');
    if(q.kind === 'multi' && (!Array.isArray(v) || v.some(x => !q.options?.includes(x)))) throw new Error('Seleção inválida.');
    if(q.kind === 'text' && (typeof v !== 'string' || v.length > 4000)) throw new Error('Comentário inválido ou muito longo.');
    clean[q.key] = v;
  }
  return clean;
}
