/* eslint-disable @typescript-eslint/no-explicit-any -- Heterogeneous serialized test matrix, validated per scenario below. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationMatrix} from './fixtures/conversation-matrix.ts';
import {naturalMoney,assertMoneyEvidence,writeIntentGuard} from '../lib/icom-bank/natural-money.ts';
import {resolveConversationContext,validMemory,contextTtl} from '../lib/icom-bank/conversation-context.ts';
import {conversationPeriod} from '../lib/icom-bank/natural-date.ts';
import {parseAgendaDate,agendaStatedTime} from '../lib/icom-bank/agenda.ts';
import {prepareConversation} from '../lib/icom-bank/conversation-execution.ts';
import {interpretConversation,type ConversationAction} from '../lib/icom-bank/conversation-interpreter.ts';
import {prepareFinancial,type FinancialDraft} from '../lib/icom-bank/assistant-financial.ts';
import {conversationWhatsApp} from '../lib/icom-bank/conversation-worker.ts';
import {readAssistantData,assistantReadInput,type AssistantReader} from '../lib/icom-bank/assistant-data.ts';
import type {BankRole} from '../lib/icom-bank/model.ts';
const today='2026-10-15',now=Date.now(),id='a4234118-8a17-4993-b490-92edfa233456',bill='b4234118-8a17-4993-b490-92edfa233456';
const companies=[{id:'local',name:'ICOM',aliases:['loja','empresa']},{id:'alfa',name:'Alfa',aliases:['Alfa']},{id:'beta',name:'Beta',aliases:['Beta']}],single=[companies[0]];
const empty:AssistantReader={rows:async()=>[],ledger:async()=>[],staff:async()=>[]};
const action=(source:string,intent:ConversationAction['intent'],data:unknown,extra:Partial<ConversationAction>={}):ConversationAction=>({intent,source,scope:'HERDAR',scope_evidence:'',company:null,change_context:false,data:JSON.stringify(data),question:'',...extra});
const expense=(amount='230,00',excerpt='230,00',description='Material',category='Material')=>({intent:'DESPESA',scope:'LOJA',description,category,amount,amount_excerpt:excerpt,paid:true,payment_method:'OUTRO',date:null,date_excerpt:null,trip_name:null,plate:null,confidence:'ALTA',question:'',account_name:null});
const plan=(a:ConversationAction[])=>({actions:a,continues_previous:false});
const execute=(source:string,a:ConversationAction[],role:BankRole='OWNER',reader=empty)=>prepareConversation(plan(a),source,today,single,{},role,reader,async p=>await reader.rows(p) as Record<string,unknown>[]);
const fakeModel=(p:unknown)=>async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(p)}]}]});
for(const entry of conversationMatrix){const c=entry as unknown as Record<string,any>;test('Matriz '+c.id+' · '+c.group+' · '+c.message,async()=>{
 switch(c.group){
 case 'valor':assert.equal(naturalMoney(c.value),c.cents);assert.doesNotThrow(()=>assertMoneyEvidence(c.cents,c.value,c.message));break;
 case 'guarda':if(c.blocked)assert.throws(()=>writeIntentGuard(c.message));else assert.doesNotThrow(()=>writeIntentGuard(c.message));break;
 case 'contexto':{const memory=Object.fromEntries(Object.entries(c.memory).map(([k,v])=>[k,{...(v as object),selected_at:now}]));const resolve=()=>resolveConversationContext({source:c.message,scope:'HERDAR',scope_evidence:'',company:c.companyName,change:c.change,event:c.event},memory,companies,now);if(c.error)assert.throws(resolve);else{const r=resolve();assert.equal(r.context.scope,c.scope);assert.equal(r.context.company,c.company);if(/Só |próximo/.test(c.message))assert.equal(r.memory.active?.company,(memory.active as {company?:string})?.company);}break;}
 case 'periodo':{const raw=conversationPeriod(c.message,today);assert.ok(raw);const p=assistantReadInput({topic:'despesas_loja',...raw},'OWNER',today);assert.equal(p.from,c.from);assert.equal(p.to,c.to);break;}
 case 'data':assert.equal(parseAgendaDate(c.value,today),c.date);break;
 case 'despesa':{const r=await execute(c.message,[action(c.message,'EXPENSE',expense('230,00','230,00',c.description,c.category))]);assert.equal(r.results[0].kind,'WRITE',r.results[0].reply);const p=r.results[0].pending!.args.p_payload as Record<string,unknown>;assert.equal(p.scope,c.scope);assert.equal(p.amount_cents,23000);assert.equal(p.entry_date,today);break;}
 case 'permissao':{let reads=0;const reader={...empty,rows:async()=>{reads++;throw Error('private');}};const r=await execute(c.message,[action(c.message,'EXPENSE',expense('80,00','80'))],c.role,reader);assert.equal(r.results[0].kind,'QUESTION');assert.match(r.results[0].reply,/perfil/);assert.equal(reads,0);break;}
 case 'limite':{let reads=0;const r=await execute(c.message,[action(c.message,c.intent,{},{question:'Esse recurso deve ser feito no painel próprio; não foi alterado.'})],'OWNER',{...empty,rows:async()=>{reads++;return [];}});assert.equal(r.results[0].kind,'UNSUPPORTED');assert.equal(r.results[0].pending,undefined);assert.equal(reads,0);break;}
 case 'baixa':{const paying=c.op==='PAGAR_CONTA',row={id:bill,title:paying?'Aluguel':'Venda João',payer:'João',scope:c.scope||'LOJA',active:true,status:'PENDENTE',amount_cents:c.paid||20000,received_cents:c.prior||0,due_date:today,updated_at:today+'T10:00:00Z'};const form={title:paying?'Aluguel':'',...(paying?{scope:c.scope||'LOJA'}:{payer:'João'}),...(c.method===null?{}:{method:'PIX'}),...(c.amount?{amount_cents:c.amount}:{})};const d:FinancialDraft={operation:c.op,form:JSON.stringify(form),evidence:JSON.stringify(c.amount?{amount_cents:c.amount}:{}),confidence:'ALTA',question:''};const r=(p:string)=>Promise.resolve(p.startsWith(paying?'icom_bank_payables?':'icom_bank_receivables?')?(c.multiple?[row,{...row,id}]:[row]):[]);if(c.error)await assert.rejects(prepareFinancial(d,c.message,today,r,id));else{const prepared=await prepareFinancial(d,c.message,today,r,id);assert.equal(prepared.args.p_id,bill);assert.equal(prepared.args.p_expected,row.updated_at);if(!paying)assert.equal(prepared.args.p_amount,c.half?10000:c.amount?Number(c.amount.replace(',','.'))*100:20000);}break;}
 case 'consulta':{const r=await prepareConversation(plan([action(c.message,'READ',{topic:c.topic,scope:c.scope})]),c.message,today,single,{active:{scope:c.scope,company:c.scope==='LOJA'?'local':null,selected_at:now}},'OWNER',empty,async()=>[]);assert.equal(r.results[0].kind,'READ',r.results[0].reply);assert.equal(r.results[0].pending,undefined);break;}
 case 'correcao':{const r=await execute(c.message,[action(c.message,'EXPENSE',expense(c.amount,c.excerpt))]);assert.equal(r.results[0].kind,c.error?'QUESTION':'WRITE',r.results[0].reply);if(!c.error)assert.equal((r.results[0].pending!.args.p_payload as Record<string,unknown>).amount_cents,c.amount==='1500,00'?150000:25000);break;}
 case 'fluxo':{
 if(c.kind==='expired'){assert.deepEqual(validMemory({active:{scope:'LOJA',company:'local',selected_at:now-contextTtl}},now),{});}
 if(c.kind==='failure'){const r=await execute('Quanto gastei na loja?',[action('Quanto gastei na loja?','READ',{topic:'despesas_loja'})],'OWNER',{...empty,ledger:async()=>{throw Error('DB offline');}});assert.equal(r.results[0].kind,'QUESTION');assert.match(r.results[0].reply,/Nenhum saldo/);}
 if(c.kind==='time')assert.equal(agendaStatedTime('15:00','às três da tarde',c.message),'15:00');
 if(c.kind==='followup'){const memory={active:{scope:'LOJA' as const,company:'local',selected_at:now},last_query:{topic:'despesas_loja',search:'Marketing',period:'mes_atual'},query_at:now};const r=await prepareConversation({continues_previous:true,actions:[action(c.message,'READ',{})]},c.message,today,single,memory,'OWNER',empty,async()=>[]);assert.equal(r.results[0].kind,'READ');assert.equal(r.memory.last_query?.search,'Marketing');assert.equal(r.memory.last_query?.period,'mes_anterior');}
 if(c.kind==='multi'){const a=action('Agenda reunião amanhã às 14h','FINANCIAL',{operation:'AGENDA',form:JSON.stringify({title:'Reunião',due_date:'2026-10-16',due_time:'14:00'}),evidence:JSON.stringify({due_date:'amanhã',due_time:'14h'}),confidence:'ALTA',question:''});const b=action('dentista às 15h','CLARIFY',{}, {question:'Em qual data é o dentista?'});const r=await execute(c.message,[a,b]);assert.equal(r.results[0].kind,'WRITE');assert.equal(r.results[1].kind,'QUESTION');}
 if(c.kind==='independent'){const r=await execute(c.message,[action('Paguei escola pessoal','CLARIFY',{}, {question:'Qual o valor da escola?'}),action('aluguel da loja','UNSUPPORTED',{}, {question:'Falta o pagamento confirmado.'})]);assert.equal(r.results[0].kind,'QUESTION');assert.equal(r.results[1].kind,'UNSUPPORTED');}
 if(c.kind==='webhook'){let commits=0;const rpc=async<T>(path:string)=>{if(path.endsWith('_context'))return {memory:{},companies:single,pending:commits?null:{id,version:bill,source:'agenda',status:'PENDENTE'}} as T;if(path.endsWith('_confirm')){commits++;return [] as T;}throw Error('unexpected');};await conversationWhatsApp({id:bill,claim_id:id},'1',today,'unused',rpc);await conversationWhatsApp({id:bill,claim_id:id},'1',today,'unused',rpc);assert.equal(commits,1);}
 if(c.kind==='legitimate'){const source='Anota 230,00 de material da loja.',a=action(source,'EXPENSE',expense());const one=await execute(source,[a]),two=await execute(source,[a]);assert.notEqual((one.results[0].pending!.args.p_payload as Record<string,unknown>).id,(two.results[0].pending!.args.p_payload as Record<string,unknown>).id);}
 break;}
 default:assert.fail('Grupo não implementado');
 }
});}
test('Strict plan rejects invented evidence and upstream failures without writes',async()=>{
 const a=action('paguei 900','EXPENSE',expense());await assert.rejects(interpretConversation('anota 230',today,'test',single,{},'OWNER',fakeModel(plan([a])) as typeof fetch));
 await assert.rejects(interpretConversation('anota 230',today,'test',single,{},'OWNER',async()=>new Response('',{status:503})));
 const parsed=await interpretConversation('Anota 230,00 de material da loja.',today,'test',single,{},'OWNER',fakeModel(plan([action('Anota 230,00 de material da loja.','EXPENSE',expense())])) as typeof fetch);assert.equal(parsed.model_calls,1);
});
test('PF account totals exclude PJ even when a bank search is used',async()=>{
 const accounts=[{id,scope:'PESSOAL',name:'Santander pessoal',bank:'Santander',active:true},{id:bill,scope:'PESSOAL',name:'Itaú pessoal',bank:'Itaú',active:true},{id:'c4234118-8a17-4993-b490-92edfa233456',scope:'LOJA',name:'Santander PJ',bank:'Santander',active:true}];
 const out=await readAssistantData({...empty,rows:async path=>path.startsWith('icom_bank_accounts?')?accounts:[]},{topic:'contas_bancarias',scope:'PESSOAL',search:'Santander'},'OWNER',today);const d=out.dados as Record<string,unknown>;assert.equal(d.saldo_pj,undefined);assert.equal(d.saldo_registrado,undefined);assert.equal(d.quantidade,1);
});
