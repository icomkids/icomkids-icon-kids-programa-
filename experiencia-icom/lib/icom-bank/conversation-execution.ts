import {randomUUID} from 'node:crypto';
import {assistantReadInput,readAssistantData,type AssistantReader,type AssistantReadInput} from './assistant-data.ts';
import {readManual,manualTopics,type ManualTopic} from './assistant-manual.ts';
import {whatsappReadReply} from './whatsapp-consultations.ts';
import {expensePayload,type ExpenseDraft} from './whatsapp-expenses.ts';
import {prepareFinancial,type FinancialDraft,type FinancialPending,type FinancialReader} from './assistant-financial.ts';
import {resolveAccount,type BankAccount} from './accounts.ts';
import {resolveConversationContext,validMemory,type CompanyContext,type ConversationMemory,type ConversationScope} from './conversation-context.ts';
import {conversationPeriod} from './natural-date.ts';
import {writeIntentGuard,naturalFold} from './natural-money.ts';
import type {ConversationPlan} from './conversation-interpreter.ts';
import {expensePlate} from './spoken-plate.ts';
import type {StockRow} from './stock.ts';
import {isPaymentReminderTitle} from './agenda.ts';
import type {BankRole} from './model.ts';
type Row=Record<string,unknown>;
export type ConversationResult={index:number;kind:'READ'|'MANUAL'|'CONTEXT'|'QUESTION'|'UNSUPPORTED'|'WRITE';reply:string;pending?:FinancialPending;source?:string};
const object=(s:string):Row=>{const v=JSON.parse(s);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Resumo inválido.');return v;};
const personalTopics=['despesas_pessoais','patrimonio_pessoal','rendas_pessoais','alugueis'];
const companyTopics=['resultado_empresa','administrativo','investidores','vendedores','funcionarios','clientes','contratos','parcelas','pagamentos','comprovantes','inadimplencia','veiculos','relatorios','configuracoes','despesas_loja'];
const memoReader=(reader:FinancialReader)=>{const cache=new Map<string,Promise<Row[]>>();return (path:string)=>{let p=cache.get(path);if(!p){p=reader(path);cache.set(path,p);}return p;};};
function readReply(result:unknown,input:AssistantReadInput,label:string,source=''){
 const r=result as {ok:boolean;dados:Row};if(!r.ok)throw Error('A consulta falhou; nenhum valor foi presumido.');
 const d=r.dados,m=(k:string)=>{const v=d[k];return v&&typeof v==='object'?'valor' in v?String((v as Row).valor):null:null;};
 const period=input.period==='total'?'todo o histórico cadastrado':input.from+' a '+input.to;
 if(['investidores','vendedores'].includes(input.topic)){const names=Array.isArray(d.registros)?(d.registros as Row[]).slice(0,5).map(r=>r.nome).filter(Boolean).join(', '):'';return label+': '+String(d.ativos??d.quantidade??0)+' '+input.topic+' ativos.'+(names?' '+names+'.':'');}
 if(input.topic==='administrativo'&&/fatur|vendeu|vendemos/.test(naturalFold(source))){const sales=d.vendas as Row|undefined;return label+': valor das vendas '+String((sales?.faturamento as Row)?.valor||'indisponível')+' · '+period+'. Isso não é dinheiro recebido nem lucro.';}
 if(input.topic==='despesas_pessoais')return label+': despesas pagas '+m('total_pago')+' · '+period+'.'+(input.category?' Categoria: '+input.category+'.':'');
 if(input.topic==='despesas_loja')return label+': gastos registrados '+m('total_despesas_loja')+' · '+period+'.'+(input.search?' Filtro: '+input.search+'.':'');
 if(input.topic==='lancamentos'&&/receb|entrou|entraram/.test(naturalFold(source)))return label+': entradas registradas '+m('total_entradas')+' · '+period+'. Não é faturamento nem lucro; não consulta o banco.';
 if(input.topic==='caixa')return label+': caixa disponível '+m('saldo_livre')+'. Capital de terceiros e custos reservados ficam separados.';
 if(input.topic==='contas_bancarias'&&input.scope!=='TODOS')return label+': saldo registrado '+m(input.scope==='PESSOAL'?'saldo_pf':'saldo_pj')+'. '+(input.search?'Contas do filtro estão detalhadas abaixo.\n'+whatsappReadReply(result,input):'Não é consulta ao banco.');
 if(input.topic==='resultado_empresa'&&input.scope==='LOJA')return label+': resultado líquido '+m('resultado_empresa')+'. Período: '+(input.period==='total'?'todo o histórico cadastrado':input.from+' a '+input.to)+'.';
 return label+'\n'+whatsappReadReply(result,input).replace(/^IA Bank · /,'');
}
export async function prepareConversation(plan:ConversationPlan,source:string,today:string,companies:CompanyContext[],memory:ConversationMemory,role:BankRole,reader:AssistantReader,financialReader:FinancialReader,ids:()=>string=randomUUID,now=Date.now(),origin:'WHATSAPP'|'VOICE'='WHATSAPP'){
 let state=validMemory(memory,now);const results:ConversationResult[]=[],read=memoReader(financialReader),readJobs:Promise<void>[]=[];
 for(const [index,a] of plan.actions.entries()){
  try{
   if(a.intent==='CLARIFY'||a.intent==='UNSUPPORTED'||a.intent==='CORRECT'){
    const reply=a.intent==='CORRECT'?'Para corrigir um registro já salvo, use Editar no lançamento do painel. Não criei uma segunda despesa.':a.question||'Essa função precisa ser feita no painel; nenhum registro foi alterado.';
    results.push({index,kind:a.intent==='CLARIFY'?'QUESTION':'UNSUPPORTED',reply});if(a.intent==='CLARIFY')state={...state,pending_source:a.source,pending_at:now};continue;
   }
   if(a.intent==='MANUAL'){const raw=object(a.data);if(!manualTopics.includes(raw.topic as ManualTopic))throw Error('Qual procedimento você quer consultar?');const manual=readManual(raw,'nao_identificada',role);results.push({index,kind:'MANUAL',reply:manual.title+'\n'+manual.steps.slice(0,2).map((x,i)=>(i+1)+'. '+x.text).join('\n')});continue;}
   const data=Object.fromEntries(Object.entries(object(a.data)).filter(([,v])=>v!==null)),draft=a.intent==='FINANCIAL'?data as unknown as FinancialDraft:null,form=draft?object(draft.form):null;
   if((a.intent==='EXPENSE'||a.intent==='FINANCIAL')&&role!=='OWNER')throw Error('Seu perfil não permite lançamentos financeiros pela IA.');
   let reference:ConversationScope|undefined;
   if(a.intent==='READ'){if(personalTopics.includes(String(data.topic)))reference='PESSOAL';else if(companyTopics.includes(String(data.topic)))reference='LOJA';}
   if(draft&&['PAGAR_CONTA','RECEBER_CONTA'].includes(draft.operation)){
    const rows=await read((draft.operation==='PAGAR_CONTA'?'icom_bank_payables':'icom_bank_receivables')+'?select=*');
    const found=rows.filter(r=>r.active&&(draft.operation==='PAGAR_CONTA'?r.status==='PENDENTE':Number(r.received_cents)<Number(r.amount_cents))&&(!form!.title||naturalFold(String(r.title)).includes(naturalFold(String(form!.title))))&&(!form!.payer||naturalFold(String(r.payer)).includes(naturalFold(String(form!.payer)))));
    if(found.length===1)reference=(found[0].scope||'LOJA') as ConversationScope;
   }
   const consolidated=a.intent==='READ'&&/\b(?:consolidado|pessoal e (?:a )?empresa|empresa e (?:o )?pessoal)\b/.test(naturalFold(a.source));if(consolidated&&role!=='OWNER')throw Error('Seu perfil não permite consolidar dados pessoais.');if(consolidated&&!reference)reference='LOJA';
   const event=draft?.operation==='AGENDA'&&!isPaymentReminderTitle(String(form?.title));
   const resolved=resolveConversationContext({source:a.source,scope:a.scope,scope_evidence:a.scope_evidence,company:a.company,change:a.change_context,reference_scope:reference,event},state,companies,now);
   state=resolved.memory;const context=resolved.context,label=resolved.label;
   if(context.scope==='PESSOAL'&&role!=='OWNER')throw Error('Seu perfil não tem acesso ao financeiro pessoal.');
   if(a.intent==='CONTEXT'){if(!a.change_context)throw Error('Você quer mudar o contexto para qual área?');results.push({index,kind:'CONTEXT',reply:'Contexto ativo: '+label+'.'});continue;}
   if(a.intent==='READ'){
    const raw={...data};delete raw.answer;delete raw.from;delete raw.to;
    const continuation=plan.continues_previous&&state.last_query;
    const inherited=continuation?{...state.last_query,...raw}:raw;
    const period=conversationPeriod(a.source,today);Object.assign(inherited,period||{});
    if(inherited.period==='personalizado'&&!period)Object.assign(inherited,{from:data.from,to:data.to});
    inherited.scope=/\b(?:consolidado|pessoal e (?:a )?empresa|empresa e (?:o )?pessoal|somando.*(?:pessoal|empresa))\b/.test(naturalFold(a.source))?'TODOS':context.scope;
    if(inherited.topic==='caixa'&&context.scope==='PESSOAL')inherited.topic='contas_bancarias';
    if(inherited.topic==='contas_receber'&&context.scope==='PESSOAL')inherited.topic='alugueis';
    const input=assistantReadInput(inherited,role,today);state={...state,last_query:inherited,query_at:now,pending_source:undefined,pending_at:undefined};
    readJobs.push(readAssistantData(reader,input.period==='personalizado'?input:(({from:_,to:__,...q})=>{void _;void __;return q;})(input),role,today).then(result=>{results.push({index,kind:'READ',reply:readReply(result,input,label,a.source)});}).catch(()=>{results.push({index,kind:'QUESTION',reply:'Não consegui consultar agora. Nenhum saldo foi presumido; tente novamente.'});}));continue;
   }
   writeIntentGuard(a.source);if(plan.actions.length===1)writeIntentGuard(source);
   const at=naturalFold(source).indexOf(naturalFold(a.source));if(at>0&&/(?:nao|se eu|caso eu)\s*$/.test(naturalFold(source).slice(Math.max(0,at-15),at)))throw Error('Nenhum lançamento foi criado para uma negação ou hipótese.');
   if(a.intent==='EXPENSE'){
    const d={...data,scope:context.scope} as unknown as ExpenseDraft;
    if(/\b(?:empresa|loja)\b/.test(naturalFold(a.source))&&/\b(?:meu dinheiro|dinheiro pessoal|minha conta pessoal)\b/.test(naturalFold(a.source)))throw Error('Foi reembolso, aporte ou outra movimentação entre você e a empresa? Esse registro deve ser feito no painel próprio.');
    const plate=expensePlate(d.plate,a.source);const [candidates,accounts,stockRows]=await Promise.all([read('icom_bank_payables?select=*'),read('icom_bank_accounts?select=*'),plate&&context.scope==='LOJA'?read('icom_bank_stock_vehicles?select=*'):Promise.resolve([])]);const words=naturalFold(d.description+' '+d.category).split(/[^a-z0-9]+/).filter(w=>w.length>=4&&!['pessoal','empresa','pagamento','despesa','conta'].includes(w));const matches=candidates.filter(r=>r.active&&r.status==='PENDENTE'&&(r.scope||'LOJA')===context.scope&&words.some(w=>naturalFold(String(r.title)).includes(w)));
    if(matches.length){throw Error(matches.length===1?'Já existe a conta '+String(matches[0].title)+' pendente. Diga “paguei a conta '+String(matches[0].title)+'” e a forma de pagamento para registrar a baixa.':'Há contas pendentes relacionadas. Qual título e vencimento foram pagos?');}
    const stocks=stockRows as unknown as StockRow[];
    const payload=expensePayload(d,a.source,ids(),stocks,today,origin); const {expected_updated_at:_,...p}=payload;void _;
    const account=resolveAccount(accounts as BankAccount[],d.account_name,a.source);
    results.push({index,kind:'WRITE',source:a.source,pending:{operation:'LANCAMENTO',rpc:'icom_bank_save_admin_entry',args:{p_payload:p,p_expected:null},account_id:account?.id||null,destination:label,summary:[{label:'Área',value:label},{label:'Despesa',value:p.description},{label:'Valor',value:new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(p.amount_cents)/100)},{label:'Data',value:p.entry_date}]},reply:label+': '+p.description});state={...state,pending_source:undefined,pending_at:undefined};
   }else if(draft){
    if(context.scope==='PESSOAL'&&['CONTA_RECEBER','RECEBER_CONTA'].includes(draft.operation))throw Error('Recebíveis pessoais de aluguel ficam em Administrativo pessoal → Aluguéis a receber. Não registrei entrada da empresa.');
    if(draft.operation==='LANCAMENTO'&&form?.kind==='ENTRADA'&&context.scope==='PESSOAL')throw Error('Registre essa renda em Administrativo pessoal → Outras rendas. Não registrei faturamento da empresa.');
    const pending=await prepareFinancial(draft,a.source,today,read,ids(),context.scope);const p=pending.args.p_payload as Row|undefined;if(pending.operation==='AGENDA'&&p)p.origin=origin;
    results.push({index,kind:'WRITE',source:a.source,pending,reply:label+': '+pending.destination});state={...state,pending_source:undefined,pending_at:undefined};
   }else throw Error('Essa ação ainda não está disponível.');
  }catch(e){const message=e instanceof Error?e.message:'Falta um dado para continuar.';results.push({index,kind:'QUESTION',reply:message});state={...state,pending_source:a.source,pending_at:now};}
 }
 await Promise.all(readJobs);return {results:results.sort((a,b)=>a.index-b.index),memory:state};
}
