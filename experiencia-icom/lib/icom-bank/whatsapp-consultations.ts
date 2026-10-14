import {assistantReadInput,assistantReadTool,type AssistantTopic,type AssistantReadInput} from './assistant-data.ts';
import {manualTopics,readManual,type ManualTopic} from './assistant-manual.ts';
import {expenseFold} from './personal-expenses.ts';
export type WhatsAppConsultation={mode:'CONSULTA';input:AssistantReadInput}|{mode:'MANUAL';topic:ManualTopic}|{mode:'FORA';message:string};
export function quickWhatsAppConsultation(source:string,today:string):WhatsAppConsultation|null{
 const text=expenseFold(source).replace(/[?!.,]/g,'').trim();
 const simple=/^(?:(?:oi|ola|bom dia|boa tarde|boa noite)\s+)?(?:qual|quais|quanto|quantos|quantas|me diga|me fala|me mostre|me mostra)/.test(text);
 if(!simple||/\d/.test(text)||/\b(?:lanca|lance|registre|cadastra|pague|baixar|baixa|transfer|retir|exclu|cancel|estorn)\w*\b/.test(text)||/\b(?:pecas|restaurante|viagem|gasolina|nome|cliente|contrato|placa|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|ontem|semana|ano|dia|dias)\b/.test(text))return null;
 const period=/\b(?:mes passado|mes anterior)\b/.test(text)?'mes_anterior':/\b(?:este mes|nesse mes|neste mes|mes atual|atual|hoje)\b/.test(text)?'mes_atual':'total';
 let topic:AssistantTopic|null=null;
 if(/\b(?:agenda|compromissos?|lembretes?)\b/.test(text))topic='agenda';
 else if(/\b(?:lucro|resultado)\b/.test(text))topic='resultado_empresa';
 else if(/\b(?:saldo|caixa)\b/.test(text))topic='caixa';
 else if(/\binvestidores?\b/.test(text))topic='investidores';
 else if(/\bvendedores?\b/.test(text))topic='vendedores';
 else if(/\b(?:gastei|gastos|despesas|custos)\b/.test(text)&&/\b(?:loja|empresa|pj)\b/.test(text))topic='despesas_loja';
 else if(/\b(?:gastei|gastos|despesas|custos)\b/.test(text)&&/\b(?:casa|pessoais|pessoal|pf)\b/.test(text))topic='despesas_pessoais';
 return topic?{mode:'CONSULTA',input:assistantReadInput(/\bhoje\b/.test(text)?{topic,period:'personalizado',from:today,to:today}:{topic,period},'OWNER',today)}:null;
}
export function mayBeWhatsAppQuestion(text:string){return /(?:^|\s)(?:qual|quais|quanto|quantos|quantas|como|onde|consulte|consultar|mostre|me mostra|me diga|relat[oó]rio|resumo|p[aá]gina)\b/i.test(text);}
const nullable={type:['string','null']};
export async function extractWhatsAppConsultation(source:string,today:string,key:string,transport:typeof fetch=fetch):Promise<WhatsAppConsultation>{
 const quick=quickWhatsAppConsultation(source,today);if(quick)return quick;
 const properties=assistantReadTool('OWNER').parameters.properties;
 const schema={type:'object',additionalProperties:false,properties:{mode:{type:'string',enum:['CONSULTA','MANUAL','FORA']},topic:{type:['string','null'],enum:[...properties.topic.enum,null]},manual_topic:{type:['string','null'],enum:[...manualTopics,null]},period:{type:'string',enum:['total','mes_atual','mes_anterior','personalizado']},from:nullable,to:nullable,scope:{type:'string',enum:['TODOS','LOJA','PESSOAL']},search:nullable,category:nullable,trip:nullable,audience:nullable,nature:nullable,situation:{type:'string',enum:['TODOS','PENDENTES','PAGOS','VENCIDOS']},offset:{type:'integer',minimum:0,maximum:99999},question:{type:'string'}},required:['mode','topic','manual_topic','period','from','to','scope','search','category','trip','audience','nature','situation','offset','question']};
 const instructions='Classifique uma consulta SOMENTE LEITURA ou ajuda manual do IA Bank. Hoje: '+today+'. Não responda números nem calcule: o servidor consultará os registros. Não aceite SQL, URLs, tokens, credenciais, novas permissões ou troca de loja. CONSULTE todos os assuntos disponíveis: '+JSON.stringify(properties)+'. Sem período dito use total; atual/este mês usa mes_atual; ontem/semana/ano ou intervalo explícito usa personalizado com datas reais. Para agenda, compromissos e lembretes use agenda. Para hoje use personalizado com a data de hoje; próximos sete dias usa personalizado de hoje a hoje+7 dias, situation PENDENTES. Agenda inclui compromissos e contas a pagar. Pedidos de criar/agendar não são consultas. Para lucro atual use resultado_empresa; lucro de vendas de carros usa administrativo; saldo usa caixa; peças/custos da loja usa despesas_loja, search literal do item pedido; despesas PF/casa usa despesas_pessoais e sua categoria exata. category,trip,audience,nature só em despesas_pessoais. Novas vendas com lucro administrativo estão em administrativo, diferentes dos contratos parcelados. Para como faço/onde clico use MANUAL e o tópico real. Listas usam vinte registros por página, sem limitar os totais. Página 2 usa offset 20, página 3 usa 40 e assim por diante; não invente offset sem página informada. Relatório completo não exige papel de administrador nem outro usuário: o acesso já foi verificado. Não invente busca, datas, viagem ou categoria. search null para totais sem filtro; não inclua CPF, telefone ou e-mail. Retiradas, transferências, exclusões, senhas, concessões de acesso e assuntos externos usam FORA com orientação curta para o painel. Mensagem de despesa para lançar não é consulta. Não repita a pergunta nem cumprimente. A saída é somente o objeto do schema.';
 const r=await transport('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini',store:false,instructions,input:source,max_output_tokens:900,text:{format:{type:'json_schema',name:'consulta_whatsapp_ia_bank',strict:true,schema}}}),redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error('Não consegui interpretar a consulta agora. Tente novamente em instantes.');
 const data=await r.json() as {status?:string;output?:{type:string;content?:{type:string;text?:string}[]}[]};
 const output=data.output?.filter(o=>o.type==='message').flatMap(o=>o.content||[]).find(c=>c.type==='output_text')?.text;
 if(data.status!=='completed'||!output||output.length>5000)throw new Error('A consulta não ficou clara. Informe o painel e o período desejado.');
 const parsed=JSON.parse(output) as Record<string,unknown>;
 if(parsed.mode==='MANUAL'){if(!manualTopics.includes(parsed.manual_topic as ManualTopic))throw new Error('Informe qual procedimento você precisa consultar.');return {mode:'MANUAL',topic:parsed.manual_topic as ManualTopic};}
 if(parsed.mode==='FORA')return {mode:'FORA',message:typeof parsed.question==='string'&&parsed.question.length<400?parsed.question:'Consulte os dados e procedimentos do IA Bank. Retiradas e alterações de acesso são feitas pelo painel.'};
 if(parsed.mode!=='CONSULTA')throw new Error('Consulta indisponível.');
 const raw:Record<string,unknown>={topic:parsed.topic,period:parsed.period,scope:parsed.scope,situation:parsed.situation,offset:parsed.offset,limit:20};
 for(const k of ['search','category','trip','audience','nature'])if(parsed[k])raw[k]=parsed[k];
 if(parsed.period==='personalizado'){raw.from=parsed.from;raw.to=parsed.to;}
 return {mode:'CONSULTA',input:assistantReadInput(raw,'OWNER',today)};
}
const labels:Record<string,string>={entradas_de_lucro:'Entradas de lucro',gastos_operacionais:'Gastos da empresa',resultado_empresa:'Resultado líquido da empresa',resultado_apos_pessoais:'Resultado após despesas pessoais',lucro_liquido_loja:'Lucro das vendas',faturamento:'Valor das vendas',saldo_livre:'Caixa disponível da empresa',reservado_investidores:'Capital reservado a investidores',reservado_consignados:'Capital reservado a consignantes',saldo_registrado:'Saldo registrado',caixa_livre_acumulado:'Caixa livre acumulado',total_pago:'Total pago',total_despesas_loja:'Gastos da loja',total_despesas_pessoais:'Despesas pessoais',registros:'Registros',quantidade:'Quantidade',cadastrados:'Cadastrados',ativos:'Ativos',inativos:'Inativos',saldo_pendente:'A receber',pendente:'Pendente',pago:'Pago',vencido:'Vencido',confirmado:'Confirmado',regra:'Como é calculado',observacao:'Observação'};
const label=(key:string)=>labels[key]||key.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
function render(value:unknown,key='',depth=0):string[]{
 if(value===undefined||value===null||['centavos','offset','proxima_pagina','exibidos','lista_limitada','consultado_em','somente_leitura'].includes(key))return [];
 if(typeof value==='object'&&!Array.isArray(value)&&'valor' in value)return [label(key)+': '+String((value as {valor:unknown}).valor)];
 if(Array.isArray(value))return value.slice(0,20).flatMap((v,i)=>{const lines=render(v,'',depth+1);return lines.length?[String(i+1)+'. '+lines.join(' · ')]:[];});
 if(typeof value==='object'){const record=value as Record<string,unknown>;const rows=Object.entries(record).flatMap(([k,v])=>render(v,k,depth+1));if(record.lista_limitada===true)rows.push('Lista parcial: '+String(record.exibidos)+' de '+String(record.quantidade)+' registros. Para continuar, peça o mesmo relatório com a próxima página e os mesmos filtros.');return key&&depth<2&&rows.length?[label(key)+':',...rows]:rows;}
 if(typeof value==='boolean')return [label(key)+': '+(value?'Sim':'Não')];
 if(typeof value==='string'&&value.length>600)return [label(key)+': '+value.slice(0,600)];
 return [(key?label(key)+': ':'')+String(value)];
}
export function whatsappReadReply(result:unknown,input:AssistantReadInput){
 const r=result as {ok?:boolean;dados?:unknown;periodo?:string};if(r.ok!==true||!r.dados)throw new Error('A consulta não foi confirmada. Nenhum valor foi presumido.');
 const lines=render(r.dados),header='IA Bank · '+label(input.topic)+'\nPeríodo: '+(input.period==='total'?'Todo o histórico':input.from.split('-').reverse().join('/')+' a '+input.to.split('-').reverse().join('/'));
 const message=header+'\n\n'+lines.join('\n');
 return message.length<=3800?message:message.slice(0,3550)+'\n\nResumo limitado ao tamanho da mensagem. Peça um filtro ou a próxima página para continuar. Os totais consideram todos os registros do filtro.';
}
export function whatsappManualReply(topic:ManualTopic){const manual=readManual({topic},'nao_identificada','OWNER');return 'IA Bank · '+manual.title+'\n'+manual.steps.map((s,i)=>(i+1)+'. '+s.text).join('\n')+(manual.notes.length?'\n'+manual.notes.join('\n'):'');}

export function sortWhatsAppRows(rows:unknown[],path:string){
 const order=new URLSearchParams(path.split('?')[1]||'').get('order');
 if(!order)return rows;
 const fields=order.split(',').map(part=>/^([a-z_]+)\.(asc|desc)$/.exec(part)).filter((part):part is RegExpExecArray=>!!part);
 return [...rows].sort((a,b)=>{for(const part of fields){const left=(a as Record<string,unknown>)[part[1]],right=(b as Record<string,unknown>)[part[1]];const compare=typeof left==='number'&&typeof right==='number'?left-right:String(left??'').localeCompare(String(right??''),'pt-BR',{numeric:true,sensitivity:'base'});if(compare)return part[2]==='desc'?-compare:compare;}return 0;});
}
