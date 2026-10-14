import {realDate,validId} from './contracts.ts';
import {brazilDay,currency} from './model.ts';
import type {Payable} from './payables.ts';
import type {StockRow} from './stock.ts';
export type AgendaEvent={id:string;owner_id:string;scope:'LOJA'|'PESSOAL';title:string;due_date:string;due_time:string|null;notes:string;status:'PENDENTE'|'CONCLUIDO';origin:'PAINEL'|'WHATSAPP'|'VOICE';created_at:string;updated_at:string};
export type AgendaItem={id:string;type:'COMPROMISSO'|'PAGAMENTO';scope:'LOJA'|'PESSOAL';title:string;due_date:string;due_time:string|null;amount_cents:number|null;status:string;origin:string;overdue:boolean};
export function agendaInput(b:Record<string,unknown>){
 if(Object.keys(b).some(k=>!['id','scope','title','due_date','due_time','notes','status','expected_updated_at','origin'].includes(k)))throw Error('Confira os campos do compromisso.');
 const id=b.id,title=typeof b.title==='string'?b.title.trim():'',notes=typeof b.notes==='string'?b.notes.trim():'',due=b.due_date,time=b.due_time||null,status=b.status||'PENDENTE';
 if(typeof id!=='string'||!validId(id)||title.length<2||title.length>160||notes.length>2000||/[\u0000-\u001f]/.test(title)||!['LOJA','PESSOAL'].includes(String(b.scope))||typeof due!=='string'||!realDate(due)||due<'2000-01-01'||due>'2100-12-31'||time!==null&&(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))||!['PENDENTE','CONCLUIDO'].includes(String(status)))throw Error('Informe compromisso, data e se é da empresa ou pessoal.');
 const expected=b.expected_updated_at===null?null:typeof b.expected_updated_at==='string'&&Number.isFinite(Date.parse(b.expected_updated_at))?b.expected_updated_at:undefined;
 if(expected===undefined)throw Error('Atualize o compromisso antes de salvar.');
 const origin=b.origin||'PAINEL';if(!['PAINEL','WHATSAPP','VOICE'].includes(String(origin)))throw Error('Origem inválida.');
 return {p_payload:{id,scope:b.scope,title,due_date:due,due_time:time,notes,status,origin},p_expected:expected};
}
export function agendaItems(events:AgendaEvent[],payables:Payable[],stocks:Pick<StockRow,'id'|'active'|'status'>[],today=brazilDay()):AgendaItem[]{
 const byId=new Map(stocks.map(s=>[s.id,s]));
 const items:AgendaItem[]=events.map(e=>({id:e.id,type:'COMPROMISSO',scope:e.scope,title:e.title,due_date:e.due_date,due_time:e.due_time,amount_cents:null,status:e.status,origin:e.origin,overdue:e.status==='PENDENTE'&&e.due_date<today}));
 for(const p of payables){const s=p.stock_id?byId.get(p.stock_id):undefined;if(!p.active||!p.due_date||p.stock_id&&(!s?.active||s.status==='PREVISTO'))continue;items.push({id:p.id,type:'PAGAMENTO',scope:p.scope||'LOJA',title:p.title||p.kind,due_date:p.due_date,due_time:null,amount_cents:Number(p.amount_cents),status:p.status==='PAGO'?'CONCLUIDO':'PENDENTE',origin:'CONTAS_A_PAGAR',overdue:p.status==='PENDENTE'&&p.due_date<today});}
 return items.sort((a,b)=>a.due_date.localeCompare(b.due_date)||(a.due_time||'99:99').localeCompare(b.due_time||'99:99')||a.title.localeCompare(b.title,'pt-BR'));
}
export const agendaDateLabel=(v:string)=>v.split('-').reverse().join('/');
export function isAgendaWrite(source:string){const t=source.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();if(/^(?:como|onde|qual|quais|quanto|quantos|me explica|me ensina|o que)\b/.test(t)||/\b(?:como (?:faco|agendar)|ja (?:agendou|salvou|lancou)|paguei|pagamos|ja paguei)\b/.test(t))return false;return /\b(?:agende|agendar|agenda (?:pra|para|um|uma|o|a)|marque (?:um|uma)|me lembre|crie (?:um|uma) lembrete|lanc[ae]\w* .*?(?:divida|conta a pagar)|registre .*?(?:divida|conta a pagar)|vou pagar|tenho (?:um |uma )?(?:pagamento a (?:ser realizado|pagar)|compromisso|reuniao|festa de aniversario))\b/.test(t);}
export function parseAgendaDate(excerpt:string,today:string){
 const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();const s=fold(excerpt).replace(/^no dia /,'').replace(/^dia /,'');
 let expected='';const shift=(n:number)=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 if(['hoje','amanha','depois de amanha','ontem'].includes(s))expected=shift(({hoje:0,amanha:1,'depois de amanha':2,ontem:-1} as Record<string,number>)[s]);
 else if(/^\d{4}-\d{2}-\d{2}$/.test(s))expected=s;
 else {const br=s.match(/^(\d{1,2})(?:[/-]|\s+(?:do|de)\s+)(\d{1,2})(?:(?:[/-]|\s+(?:do|de)\s+)(\d{4}))?$/),written=s.match(/^(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?: de (\d{4}))?$/),day=s.match(/^\d{1,2}$/),weekday=s.match(/^(?:(?:na |proxima |na proxima ))?(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado)$/);
 if(br)expected=(br[3]||today.slice(0,4))+'-'+br[2].padStart(2,'0')+'-'+br[1].padStart(2,'0');
 else if(written)expected=(written[3]||today.slice(0,4))+'-'+String(['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'].indexOf(written[2])+1).padStart(2,'0')+'-'+written[1].padStart(2,'0');
 else if(day)expected=today.slice(0,7)+'-'+s.padStart(2,'0');
 else if(weekday){const target=['domingo','segunda','terca','quarta','quinta','sexta','sabado'].indexOf(weekday[1].replace('-feira','')),current=new Date(today+'T12:00:00Z').getUTCDay();let n=(target-current+7)%7;if(s.includes('proxima')&&n===0)n=7;expected=shift(n);}
 }
 return realDate(expected)&&expected>='2000-01-01'&&expected<='2100-12-31'?expected:null;
}
export function agendaStatedDate(value:string,excerpt:string,source:string,today:string){
 const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
 if(!excerpt.trim()||!fold(source).includes(fold(excerpt)))throw Error('Diga a data do compromisso ou vencimento.');
 const expected=parseAgendaDate(excerpt.replace(/^(?:no )?pr[oó]ximo dia /i,'dia '),today);
 if(expected!==value)throw Error('Confirme a data com dia, mês e ano.');return value;
}
export function agendaStatedTime(value:unknown,excerpt:unknown,source:string){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)||typeof excerpt!=='string'||!source.toLowerCase().includes(excerpt.toLowerCase()))throw Error('Confirme o horário do compromisso.');
 const original=excerpt.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim().replace(/^as\s*/,''),period=/ da (?:tarde|noite)$/.test(original),words:Record<string,number>={zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,'vinte e um':21,'vinte e uma':21,'vinte e dois':22,'vinte e duas':22,'vinte e tres':23};let t=original.replace(/ da (?:manha|tarde|noite|madrugada)$/,'').replace(/\s*horas?$/,'');const spoken=t.match(/^(.+?)(?: e (meia|quinze|trinta|quarenta e cinco))?$/);if(spoken&&words[spoken[1]]!==undefined){let h=words[spoken[1]];if(period&&h<12)h+=12;const mins:Record<string,string>={meia:'30',quinze:'15',trinta:'30','quarenta e cinco':'45'};t=String(h)+':'+(mins[spoken[2]]||'00');}const match=t.match(/^(\d{1,2})(?::|h)(\d{2})?(?:\s*horas)?$/)||t.match(/^(\d{1,2})(?:\s*horas)?$/);
 if(!match||String(period&&Number(match[1])<12?Number(match[1])+12:Number(match[1])).padStart(2,'0')+':'+(match[2]||'00')!==value)throw Error('Confirme o horário, por exemplo 14:30.');
 return value;
}
export function agendaMorningReply(c:{day:string;events:AgendaItem[];bills:AgendaItem[];events_count:number;bills_count:number;bills_total:number}){
 const item=(e:AgendaItem)=>'• '+(e.overdue?'Em atraso · '+agendaDateLabel(e.due_date)+' · ':e.due_time?e.due_time+' · ':'')+e.title+(e.amount_cents!==null?' · '+currency(e.amount_cents):'')+(e.type==='PAGAMENTO'?' · '+(e.scope==='LOJA'?'Empresa / CNPJ':'Pessoal / CPF'):'');
 const message='Sua agenda de '+agendaDateLabel(c.day)+'\n\n'+(c.events_count?'Compromissos ('+c.events_count+'):\n'+c.events.map(item).join('\n')+'\n\n':'')+(c.bills_count?'Contas a pagar ('+c.bills_count+') · '+currency(c.bills_total)+':\n'+c.bills.map(item).join('\n')+'\n\n':'')+((c.events.length<c.events_count||c.bills.length<c.bills_count)?'Lista resumida. Confira todos os itens na Agenda do painel.\n':'')+'Lembrete das pendências cadastradas. Nenhum pagamento foi realizado por esta mensagem.';
 return message.length<=3800?message:message.slice(0,3520)+'\n\nLista resumida. Veja todos os compromissos e pagamentos na Agenda do painel. Nenhum pagamento foi realizado pelo lembrete.';
}

export function agendaReminderWindow(now=new Date()){const hour=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(now));return hour>=8&&hour<20;}
