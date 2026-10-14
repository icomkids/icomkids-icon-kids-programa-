import {isAgendaWrite,parseAgendaDate,agendaStatedTime} from './agenda.ts';
import type {FinancialDraft} from './assistant-financial.ts';
const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export const agendaScopeQuestion='Esse pagamento é de qual área?\n1 — CPF (pessoal)\n2 — CNPJ (empresa)\nPode incluir uma observação na resposta, por exemplo: “1 — água”.';
export function agendaPaymentScope(source:string):'LOJA'|'PESSOAL'|null{
 const last=source.trim().split('\n').at(-1)||'',choice=/^\s*([12])(?:\s*[-—:,.]\s*.*|\s+.{2,}|\s*)$/.exec(last);
 if(choice&&source.includes('\n'))return choice[1]==='1'?'PESSOAL':'LOJA';
 const t=fold(source),company=/\b(?:cnpj|pj|loja|empresa|profissional)\b/.test(t),personal=/\b(?:cpf|pf|pessoal|pessoais|familia|minha casa)\b/.test(t);
 return company===personal?null:company?'LOJA':'PESSOAL';
}
export function extractSimpleAgenda(source:string,today:string):FinancialDraft|null{
 if(!isAgendaWrite(source))return null;
 const low=(question:string):FinancialDraft=>({operation:'AGENDA',form:'{}',evidence:'{}',confidence:'BAIXA',question});
 if(/\b(?:recorrente|recorrencia|mensal|meses|todo dia|toda semana|cada mes)\b/.test(fold(source)))return null;
 const datePatterns=[
 /\b\d{4}-\d{2}-\d{2}\b/g,
 /\b(?:dia\s+)?\d{1,2}(?:[/-]|\s+(?:do|de)\s+)\d{1,2}(?:(?:[/-]|\s+(?:do|de)\s+)\d{4})?\b/gi,
 /\b(?:dia\s+)?\d{1,2} de (?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?: de \d{4})?\b/gi,
 /\b(?:depois de amanh[ãa]|amanh[ãa]|hoje|ontem)\b/gi,
 /\b(?:pr[oó]xima\s+)?(?:segunda(?:-feira)?|ter[çc]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[áa]bado|domingo)\b/gi,
 /\b(?:pr[oó]ximo\s+)?dia\s+\d{1,2}\b/gi
 ];
 const dates:{excerpt:string;value:string;index:number;end:number}[]=[];
 for(const pattern of datePatterns)for(const m of source.matchAll(pattern)){
  if(dates.some(d=>m.index!>=d.index&&m.index!<d.end))continue;
  const excerpt=m[0].replace(/^pr[oó]ximo\s+/i,''),value=parseAgendaDate(excerpt,today);
  if(!value)return low('Confirme uma data válida para o compromisso.');
  dates.push({excerpt,value,index:m.index!,end:m.index!+m[0].length});
 }
 if(!dates.length)return null;
 if(new Set(dates.map(d=>d.value)).size!==1)return low('Encontrei datas diferentes. Qual é a data do compromisso?');
 const date=dates.sort((a,b)=>b.excerpt.length-a.excerpt.length)[0];
 const times:{excerpt:string;value:string}[]=[];
 const numeric=/\b(?:[àa]s\s+)?\d{1,2}(?::\d{2}(?:\s*horas?)?|h(?:\d{2})?|\s+horas?|(?= da (?:manh[ãa]|tarde|noite|madrugada)))(?: da (?:manh[ãa]|tarde|noite|madrugada))?\b/gi;
 const words:Record<string,number>={uma:1,um:1,duas:2,dois:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,'vinte e um':21,'vinte e uma':21,'vinte e dois':22,'vinte e duas':22,'vinte e tres':23};
 const spoken=/[àa]s\s+(?:vinte e (?:um|uma|dois|duas|tr[êe]s)|uma|um|duas|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte)\b(?: e (?:meia|quinze|trinta|quarenta e cinco))?(?:\s+horas?)?(?: da (?:manh[ãa]|tarde|noite|madrugada))?/gi;
 for(const pattern of [numeric,spoken])for(const m of source.matchAll(pattern)){
  let t=fold(m[0]).replace(/^as\s+/,'').replace(/\s+horas?/,'').trim();const period=/ da (?:tarde|noite)$/.test(t);t=t.replace(/ da (?:manha|tarde|noite|madrugada)$/,'');
  let h:number,min='00';const n=/^(\d{1,2})(?::|h)?(\d{2})?$/.exec(t);
  if(n){h=Number(n[1]);min=n[2]||'00';}
  else{const w=/^(.+?)(?: e (meia|quinze|trinta|quarenta e cinco))?$/.exec(t);if(!w||words[w[1]]===undefined)return null;h=words[w[1]];min=({meia:'30',quinze:'15',trinta:'30','quarenta e cinco':'45'} as Record<string,string>)[w[2]]||'00';}
  if(period&&h<12)h+=12;const value=String(h).padStart(2,'0')+':'+min;
  try{agendaStatedTime(value,m[0],source);}catch{return low('Confirme o horário, por exemplo 19 horas.');}
  times.push({excerpt:m[0],value});
 }
 if(new Set(times.map(t=>t.value)).size>1)return low('Encontrei horários diferentes. Qual é o horário do compromisso?');
 const isBill=/\b(?:divida|conta (?:a pagar|de|do|da)|pagamento|vou pagar|para pagar|a pagar)\b/.test(fold(source));
 const money=[...source.matchAll(/(?:R\$\s*\d[\d.,]*|\b\d[\d.,]*\s*reais)\b/gi)].map(m=>({excerpt:m[0],value:m[0].replace(/R\$\s*|\s*reais/gi,'')}));
 if(isBill&&!money.length)return null;
 if(isBill&&new Set(money.map(m=>m.value)).size>1)return low('Informe um pagamento por vez, com o valor.');
 const scope=isBill?agendaPaymentScope(source):'PESSOAL';
 if(isBill&&!scope)return {...low(agendaScopeQuestion),operation:'CONTA_PAGAR'};
 let title=source.split('\n')[0].replace(/\b(?:um |uma )?compromisso que eu vou ter\b/gi,'Compromisso');
 for(const d of dates)title=title.replace(d.excerpt,'');
 for(const t of times)title=title.replace(t.excerpt,'');
 for(const m of money)title=title.replace(m.excerpt,'');
 title=title.replace(/\bpor favor\b/gi,'').replace(/\b(?:agenda|agende|agendar|marque|lança|lance|lançar|registre)\s*(?:pra mim|para mim|um|uma|o|a)?/gi,'').replace(/\beu (?:tenho|vou ter)\s*/gi,'').replace(/\b(?:um |uma )?pagamento(?: a ser realizado)?(?: de)?\b/gi,'').replace(/\b(?:vou pagar|no próximo|próximo|no dia|dia|às|as)\b/gi,'').replace(/\s+/g,' ').replace(/^[\s,.:-]+|[\s,.:-]+$/g,'').trim();
 if(isBill){const last=source.trim().split('\n').at(-1)||'';if(source.includes('\n')){const observation=last.replace(/^\s*(?:[12]|CPF|CNPJ|pessoal|empresa|loja)(?:\s*[-—:,.]\s*|\s*)/i,'').trim();if(observation.length>=2&&observation!==last)title=observation;}}
 title=title.replace(/(?:^|\s)[àa]s(?=\s|$)/gi,' ').replace(/\s+/g,' ').trim();
 if(!isBill&&/^(?:na|no|em)\s/i.test(title))title='Compromisso '+title;
 if(isBill&&!fold(title).replace(/\b(?:um|uma|eu|tenho|de|do|da|no|na|em|para|a|o|ser|realizado|proximo|pagamento|divida|conta|pagar|cpf|cnpj)\b/g,'').replace(/[\s,.:-]/g,''))title='Pagamento agendado';
 title=title.slice(0,160)|| (isBill?'Pagamento agendado':'Compromisso');
 const form=isBill?{title,scope,amount_cents:money[0].value,due_date:date.value,category:'Conta agendada',months:1,person:'AMBOS'}:{title,scope,due_date:date.value,...(times[0]?{due_time:times[0].value}:{})};
 const evidence={due_date:date.excerpt,...(times[0]?{due_time:times[0].excerpt}:{}),...(isBill?{amount_cents:money[0].excerpt.replace(/R\$\s*|\s*reais/gi,'')}:{})};
 return {operation:isBill?'CONTA_PAGAR':'AGENDA',form:JSON.stringify(form),evidence:JSON.stringify(evidence),confidence:'ALTA',question:''};
}
