import test from 'node:test';
import assert from 'node:assert/strict';
import {helpForRole,assistantInstructions,helpSection} from '../lib/icom-bank/assistant-guide.ts';
import {boundedVoiceBody,voiceInput,voiceSession,callIdFromLocation,createVoiceLimiter} from '../lib/icom-bank/assistant-session.ts';
import {VoiceResources,answerVoiceTools,prepareVoiceTools} from '../lib/icom-bank/assistant-client.ts';
import {createAssistantCache} from '../lib/icom-bank/assistant-cache.ts';
import {startVoice,closeVoice,voiceConfigured,claimVoiceRead} from '../lib/icom-bank/assistant-server.ts';
import {assistantReadTool,assistantReadInput,readAssistantData,type AssistantReader} from '../lib/icom-bank/assistant-data.ts';
import type {CashEntry} from '../lib/icom-bank/cash.ts';

const offer='v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
test('Voice starts with sound enabled; silencing output preserves the microphone and closing still releases it',()=>{
 const r=new VoiceResources();let stops=0;
 const track={enabled:true,stop:()=>stops++};
 r.attachStream({getTracks:()=>[track],getAudioTracks:()=>[track]} as unknown as MediaStream);
 r.audio={muted:false,pause:()=>{},srcObject:{}} as unknown as HTMLAudioElement;
 assert.equal(r.speakerMuted,false);assert.equal(r.audio.muted,false);
 r.setSpeakerMuted(true);assert.equal(r.audio.muted,true);assert.equal(track.enabled,true);assert.equal(stops,0);
 r.setSpeakerMuted(false);assert.equal(r.audio.muted,false);assert.equal(track.enabled,true);
 r.close();assert.equal(stops,1);assert.equal(r.audio.srcObject,null);
});
test('Brazilian conversational guidance avoids echoing questions and preserves immediate verified data lookup',()=>{
 const text=assistantInstructions('OWNER','dashboard');
 assert.match(text,/português brasileiro/);assert.match(text,/entonação variada/);assert.match(text,/não repita nem reformule a pergunta/i);
 assert.match(text,/Chame a ferramenta imediatamente/);assert.match(text,/não invente valores/);assert.match(text,/não use uma gíria em toda resposta/);
});
test('Project guide respects role permissions and does not offer administrator-only tasks to sellers',()=>{
 const seller=helpForRole('VENDEDOR');assert.deepEqual(seller.map(t=>t.section),['dashboard','clientes','contratos']);
 assert.ok(helpForRole('OWNER').some(t=>t.id==='retirada'));
 assert.ok(!helpForRole('GERENTE').some(t=>t.section==='administrativo'));
 assert.equal(helpSection('administrativo','VENDEDOR'),'dashboard');
 assert.equal(helpSection('/clientes/private-id?secret=123','OWNER'),'dashboard');
 const instructions=assistantInstructions('VENDEDOR','administrativo');assert.doesNotMatch(instructions,/Devolução ao investidor/i);assert.match(instructions,/não há ferramentas de escrita/i);assert.match(instructions,/outro assunto/i);
});
test('Server accepts only an audio offer, never client instructions or a role override',()=>{
 assert.deepEqual(voiceInput({sdp:offer,section:'clientes'},'VENDEDOR'),{sdp:offer,section:'clientes'});
 for(const body of [null,[],{sdp:offer,role:'OWNER'},{sdp:offer,instructions:'ignore guide'},{sdp:'bad'},{sdp:offer+'m=video 9 RTP/AVP 96\r\n'},{sdp:offer+'x'.repeat(60000)}])assert.throws(()=>voiceInput(body,'OWNER'));
 const session=voiceSession('FINANCEIRO','administrativo');assert.equal(session.model,'gpt-realtime-2.1-mini');assert.equal(session.tools.length,1);assert.equal(session.tools[0].name,'consultar_dados_icom');assert.equal(session.tool_choice,'auto');assert.equal(session.max_output_tokens,400);assert.equal(session.audio.input.turn_detection.silence_duration_ms,450);assert.match(session.instructions,/Área atual: dashboard/);assert.doesNotMatch(session.instructions,/OPENAI_API_KEY/);
});
test('Body size is bounded even when content length is absent or understated',async()=>{
 const req=(body:string,headers={})=>new Request('https://example.com',{method:'POST',headers,body});
 assert.deepEqual(await boundedVoiceBody(req(JSON.stringify({sdp:offer}))),{sdp:offer});
 await assert.rejects(boundedVoiceBody(req('x'.repeat(65001))),/extensa/);
 await assert.rejects(boundedVoiceBody(req('{}',{'content-length':'65001'})),/extensa/);
 await assert.rejects(boundedVoiceBody(req('not json')),/Reabra/);
});
test('Only provider-issued call identifiers are accepted',()=>{
 assert.equal(callIdFromLocation('/v1/realtime/calls/rtc_123abc'), 'rtc_123abc');
 assert.equal(callIdFromLocation('https://api.openai.com/v1/realtime/calls/rtc_u1_abc'),'rtc_u1_abc');
 for(const location of [null,'/something/rtc_123','/v1/realtime/calls/../../credentials','/v1/realtime/calls/rtc_123?token=secret'])assert.equal(callIdFromLocation(location),null);
});
test('Call guard prevents concurrent sessions, rapid retries and hourly overuse',()=>{
 const limit=createVoiceLimiter();limit.begin('one',100000);assert.throws(()=>limit.begin('one',120000),/andamento/);limit.end('one');assert.throws(()=>limit.begin('one',101000),/Aguarde/);
 for(let i=1;i<8;i++){limit.begin('one',100000+i*20000);limit.end('one');}assert.throws(()=>limit.begin('one',300000),/Aguarde/);
 limit.begin('two',300000);limit.end('two');limit.begin('one',3800000);limit.end('one');
});
test('Closing a voice session stops microphone tracks, audio, connection, channel and pending request exactly once',()=>{
 const r=new VoiceResources();let stops=0,peers=0,channels=0,pauses=0;
 r.attachStream({getTracks:()=>[{stop:()=>stops++}]} as unknown as MediaStream);
 r.peer={close:()=>peers++,ontrack:null,onconnectionstatechange:null} as unknown as RTCPeerConnection;
 r.channel={close:()=>channels++,onmessage:null,onopen:null,onclose:null} as unknown as RTCDataChannel;
 r.audio={pause:()=>pauses++,srcObject:{}} as unknown as HTMLAudioElement;
 r.close();r.close();assert.equal(stops,1);assert.equal(peers,1);assert.equal(channels,1);assert.equal(pauses,1);assert.equal(r.audio.srcObject,null);assert.equal(r.abort.signal.aborted,true);
 const late=new VoiceResources();late.close();assert.equal(late.attachStream({getTracks:()=>[{stop:()=>stops++}]} as unknown as MediaStream),false);assert.equal(stops,2);
});
test('Broker sends server-selected configuration and never returns the API key; another user cannot close the call',async()=>{
 const originalFetch=globalThis.fetch,key=process.env.OPENAI_API_KEY,enabled=process.env.ICOM_ASSISTANT_ENABLED;process.env.OPENAI_API_KEY='test-server-secret';delete process.env.ICOM_ASSISTANT_ENABLED;
 const requests:{url:string;init?:RequestInit}[]=[];
 globalThis.fetch=async(url,init)=>{requests.push({url:String(url),init});return String(url).endsWith('/hangup')?new Response(null,{status:200}):new Response('v=0\r\nm=audio 9 RTP/AVP 111\r\n',{headers:{Location:'/v1/realtime/calls/rtc_test'}});};
 try{
  assert.equal(voiceConfigured(),true);const voice=await startVoice('fixture-owner','OWNER',{sdp:offer,section:'administrativo'},new AbortController().signal);
  assert.doesNotMatch(JSON.stringify(voice),/test-server-secret/);assert.ok(voice.expiresAt>Date.now());
  const form=requests[0].init?.body as FormData;const configuration=JSON.parse(String(form.get('session')));assert.match(configuration.instructions,/Conferência diária/);assert.equal(configuration.tools.length,3);assert.equal(configuration.tools[0].name,'consultar_dados_icom');assert.equal(configuration.tools[1].name,'preparar_despesa_icom');assert.equal(form.get('sdp'),offer);
  assert.throws(()=>claimVoiceRead('someone-else',voice.id),/nova conversa/);
  for(let i=0;i<40;i++)claimVoiceRead('fixture-owner',voice.id);assert.throws(()=>claimVoiceRead('fixture-owner',voice.id),/Limite/);
  const headers=requests[0].init?.headers as Record<string,string>;assert.equal(headers.Authorization,'Bearer test-server-secret');assert.match(headers['OpenAI-Safety-Identifier'],/^[a-f0-9]{64}$/);
  await closeVoice('someone-else',voice.id);assert.equal(requests.length,1);await closeVoice('fixture-owner',voice.id);assert.equal(requests.length,2);assert.match(requests[1].url,/rtc_test\/hangup$/);
 }finally{globalThis.fetch=originalFetch;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;if(enabled===undefined)delete process.env.ICOM_ASSISTANT_ENABLED;else process.env.ICOM_ASSISTANT_ENABLED=enabled;}
});

test('Data tools preserve every role boundary before making any database request',async()=>{
 let reads=0;const reader:AssistantReader={rows:async()=>{reads++;return[];},ledger:async()=>{reads++;return[];},staff:async()=>{reads++;return[];}};
 for(const role of ['VENDEDOR','GERENTE','FINANCEIRO','ADMIN'] as const){
  assert.ok(!assistantReadTool(role).parameters.properties.topic.enum.includes('investidores'));
  for(const topic of ['administrativo','investidores','caixa','contas_pagar','contas_receber'])await assert.rejects(readAssistantData(reader,{topic},role),/não tem acesso/);
 }
 await assert.rejects(readAssistantData(reader,{topic:'clientes'},'FINANCEIRO'),/não tem acesso/);
 await assert.rejects(readAssistantData(reader,{topic:'funcionarios'},'GERENTE'),/não tem acesso/);
 assert.equal(reads,0);
 assert.deepEqual(assistantReadTool('VENDEDOR').parameters.properties.topic.enum,['carteira','clientes','contratos']);
});

test('Read filters reject arbitrary SQL, fields, roles, malformed dates and oversized searches',()=>{
 for(const raw of [null,[],{topic:'auth.users'},{topic:'investidores',role:'OWNER'},{topic:'investidores',table:'private'},{topic:'investidores',limit:26},{topic:'clientes',search:'x&select=*'},{topic:'clientes',search:'x'.repeat(81)},{topic:'carteira',period:'personalizado',from:'2026-02-30',to:'2026-03-01'},{topic:'carteira',from:'2026-01-01'}])assert.throws(()=>assistantReadInput(raw,'OWNER'));
 assert.deepEqual(assistantReadInput({topic:'administrativo',period:'mes_anterior'},'OWNER','2026-01-07'),{topic:'administrativo',period:'mes_anterior',from:'2025-12-01',to:'2025-12-31',scope:'TODOS',search:'',limit:20});
});

const sale:CashEntry={id:'sale',kind:'VENDA',scope:'LOJA',entry_date:'2026-10-05',description:'Venda teste',category:'',status:'REALIZADO',amount_cents:5000000,active:true,created_at:'',updated_at:'',details:{sale_owner:'INVESTIDOR',investor_name:'Investidor teste',investor_id:'investor',trade_in:true,trade_destination:'INVESTIDOR',trade_investor_id:'investor',trade_investor_name:'Investidor teste',trade_value_cents:5000000,trade_has_debts:false,purchase_cents:9000000,vehicle_cost_cents:100000,commission_cents:165000,sale_cents:10000000,vehicle:'Carro teste'}};
const personal:CashEntry={...sale,id:'expense',kind:'PESSOAL',scope:'PESSOAL',amount_cents:400000,details:{},description:'Conta teste'};
function fixtureReader(tables:Record<string,unknown[]>,entries:CashEntry[]=[]):AssistantReader{return {rows:async path=>{const name=path.split('?')[0];if(!(name in tables))throw new Error('Table not in fixture: '+name);return tables[name];},ledger:async()=>entries,staff:async()=>tables.staff||[]};}

test('Administrative answers use net store profit, separate investor capital and avoid double counting paid bills',async()=>{
 const reader=fixtureReader({icom_bank_payables:[{id:'paid',scope:'PESSOAL',amount_cents:400000,status:'PAGO',active:true,paid_at:'2026-10-05'},{id:'pending',scope:'PESSOAL',amount_cents:100000,status:'PENDENTE',active:true,due_date:'2026-11-10'},{id:'archived',scope:'PESSOAL',amount_cents:900000,status:'PENDENTE',active:false}],icom_bank_stock_vehicles:[]},[sale,personal,{...sale,id:'archived-sale',active:false},{...sale,id:'planned-sale',status:'PREVISTO'}]);
 const output=await readAssistantData(reader,{topic:'administrativo'},'OWNER','2026-10-07');const d=output.dados as {vendas:{lucro_liquido_loja:{centavos:number}};despesas_pessoais:{pagas:{centavos:number};pagas_mais_pendentes:{centavos:number}};caixa:{saldo_livre:{centavos:number};reservado_investidores:{centavos:number}}};
 assert.equal(d.vendas.lucro_liquido_loja.centavos,735000);assert.equal(d.despesas_pessoais.pagas.centavos,400000);assert.equal(d.despesas_pessoais.pagas_mais_pendentes.centavos,500000);assert.equal(d.caixa.reservado_investidores.centavos,4265000);assert.equal(d.caixa.saldo_livre.centavos,335000);
 const month=await readAssistantData(reader,{topic:'administrativo',period:'mes_atual',scope:'PESSOAL'},'OWNER','2026-10-07');const m=month.dados as {despesas_loja?:unknown;despesas_pessoais:{pagas_mais_pendentes:{centavos:number}}};assert.equal(m.despesas_loja,undefined);assert.equal(m.despesas_pessoais.pagas_mais_pendentes.centavos,400000);
});

test('Investor answers count the full result while returning only permitted fields and a bounded list',async()=>{
 const rows=Array.from({length:26},(_,i)=>({id:String(i),name:i===0?'Cláudio Richelli':'Investidor '+i,active:i!==25,email:'private-email',phone:'private-phone',notes:'private-note'}));
 const output=await readAssistantData(fixtureReader({icom_bank_investors:rows}),{topic:'investidores',limit:2},'OWNER');const d=output.dados as {ativos:number;cadastrados:number;lista_limitada:boolean;registros:{nome:string}[]};
 assert.equal(d.ativos,25);assert.equal(d.cadastrados,26);assert.equal(d.lista_limitada,true);assert.equal(d.registros.length,2);assert.equal(d.registros[0].nome,'Cláudio Richelli');assert.doesNotMatch(JSON.stringify(output),/private-email|private-phone|private-note/);
 await assert.rejects(readAssistantData({rows:async()=>{throw new Error('Database unavailable');},ledger:async()=>[],staff:async()=>[]},{topic:'investidores'},'OWNER'),/Database unavailable/);
});

test('Current personal payables ignore archived or planned stock origins and retain paid/pending separation',async()=>{
 const reader=fixtureReader({icom_bank_payables:[{id:'a',scope:'PESSOAL',title:'Água',amount_cents:10000,due_date:'2026-10-01',active:true,status:'PENDENTE'},{id:'b',scope:'PESSOAL',title:'Luz',amount_cents:20000,active:true,status:'PAGO',paid_at:'2026-10-05'},{id:'c',scope:'LOJA',title:'Loja',amount_cents:30000,active:true,status:'PENDENTE'},{id:'d',stock_id:'future',amount_cents:90000,active:true,status:'PENDENTE'}],icom_bank_stock_vehicles:[{id:'future',active:true,status:'PREVISTO'}]},[]);
 const o=await readAssistantData(reader,{topic:'contas_pagar',scope:'PESSOAL'},'OWNER','2026-10-07');const d=o.dados as {quantidade:number;pendente:{centavos:number};pago:{centavos:number};vencido:{centavos:number}};assert.equal(d.quantidade,2);assert.equal(d.pendente.centavos,10000);assert.equal(d.pago.centavos,20000);assert.equal(d.vencido.centavos,10000);
});

test('Portfolio totals exclude reversed payments and cancelled contracts, without exposing customer documents',async()=>{
 const reader=fixtureReader({icom_bank_contracts:[{id:'active',customer_id:'customer',number:'001',status:'ATIVO',principal_cents:7000000,total_cents:12600000,sale_date:'2026-10-01'},{id:'cancelled',customer_id:'customer',status:'CANCELADO',principal_cents:9000000,total_cents:9000000,sale_date:'2026-10-01'}],icom_bank_customers:[{id:'customer',name:'Cliente teste',cpf:'private-cpf',phone:'private-phone'}],icom_bank_installments:[{id:'open',contract_id:'active',number:1,due_date:'2026-10-01',updated_cents:210000,paid_cents:10000,status:'A_VENCER'},{id:'paid',contract_id:'active',number:2,due_date:'2026-10-01',updated_cents:210000,paid_cents:210000,status:'PAGO'},{id:'void',contract_id:'cancelled',updated_cents:9000000,paid_cents:0,status:'A_VENCER',due_date:'2026-10-01'}],icom_bank_payments:[{id:'1',installment_id:'open',amount_cents:10000,status:'CONFIRMADO',paid_at:'2026-10-05'},{id:'2',installment_id:'open',amount_cents:999999,status:'ESTORNADO',paid_at:'2026-10-05'}],icom_bank_payment_proofs:[]});
 const o=await readAssistantData(reader,{topic:'carteira'},'VENDEDOR','2026-10-07');const d=o.dados as {contratos_ativos:number;recebido_no_periodo:{centavos:number};carteira_atual_a_receber:{centavos:number};saldo_vencido:{centavos:number}};assert.equal(d.contratos_ativos,1);assert.equal(d.recebido_no_periodo.centavos,10000);assert.equal(d.carteira_atual_a_receber.centavos,200000);assert.equal(d.saldo_vencido.centavos,200000);assert.doesNotMatch(JSON.stringify(o),/private-cpf|private-phone/);
});

test('Multiple read calls return all outputs before one voice continuation; replays and cancelled sessions send nothing',async()=>{
 const r=new VoiceResources(),events:{type:string;item?:{output:string}}[]=[];r.channel={readyState:'open',send:(s:string)=>events.push(JSON.parse(s))} as unknown as RTCDataChannel;
 const items=[{type:'function_call',name:'consultar_dados_icom',call_id:'call_one',arguments:'{"topic":"investidores"}'},{type:'function_call',name:'consultar_dados_icom',call_id:'call_two',arguments:'{"topic":"administrativo"}'}];let reads=0;
 await answerVoiceTools(r,items,async()=>{reads++;return {ok:true,quantidade:1};});assert.equal(reads,2);assert.deepEqual(events.map(e=>e.type),['conversation.item.create','conversation.item.create','response.create']);
 await answerVoiceTools(r,items,async()=>{reads++;return {};});assert.equal(events.length,3);assert.equal(reads,2);
 await answerVoiceTools(r,[{type:'function_call',name:'delete_all',call_id:'call_invalid',arguments:'{}'}],async()=>{reads++;return {};});assert.equal(reads,2);assert.equal(JSON.parse(events[3].item!.output).ok,false);
 const cancelled=new VoiceResources();cancelled.channel=r.channel;await answerVoiceTools(cancelled,[{...items[0],call_id:'call_cancel'}],async()=>{cancelled.cancelled=true;return {secret:'not-sent'};});assert.equal(events.length,5);
});
test('Unconfigured or failed provider responses produce a friendly message and do not disclose secrets',async()=>{
 const originalFetch=globalThis.fetch,key=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
 try{
  assert.equal(voiceConfigured(),false);await assert.rejects(startVoice('missing-key','OWNER',{sdp:offer,section:'dashboard'},new AbortController().signal),/aguarda ativação/);
  process.env.OPENAI_API_KEY='test-server-secret';globalThis.fetch=async()=>new Response('private provider details test-server-secret',{status:401});
  await assert.rejects(startVoice('bad-provider','OWNER',{sdp:offer,section:'dashboard'},new AbortController().signal),e=>e instanceof Error&&!e.message.includes('test-server-secret')&&e.message.includes('configuração'));
 }finally{globalThis.fetch=originalFetch;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});
test('Cancellation after provider creation immediately hangs up and releases the user slot',async()=>{
 const originalFetch=globalThis.fetch,key=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-server-secret';
 const controller=new AbortController(),requests:string[]=[];
 globalThis.fetch=async url=>{requests.push(String(url));if(String(url).endsWith('/hangup'))return new Response(null,{status:200});controller.abort();return new Response('v=0\r\nm=audio 9 RTP/AVP 111\r\n',{headers:{Location:'/v1/realtime/calls/rtc_cancel'}});};
 try{await assert.rejects(startVoice('cancelled-user','OWNER',{sdp:offer,section:'dashboard'},controller.signal),/cancelada/);assert.equal(requests.length,2);assert.match(requests[1],/rtc_cancel\/hangup$/);}
 finally{globalThis.fetch=originalFetch;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});

test('Quick seller and cash questions read only their own source, including active sellers and investor reserves',async()=>{
 let ledger=0,staff=0;const reader:AssistantReader={rows:async()=>{throw new Error('Unrelated source should not be read');},ledger:async()=>{ledger++;return[sale,personal];},staff:async()=>{staff++;return[{name:'João',role:'VENDEDOR',active:true},{name:'Outro',role:'VENDEDOR',active:true},{name:'Antigo',role:'VENDEDOR',active:false},{name:'Gerente',role:'GERENTE',active:true},{name:'Bruno',role:'OWNER',active:true}];}};
 const sellers=await readAssistantData(reader,{topic:'vendedores'},'OWNER');const s=sellers.dados as {ativos:number;registros:{nome:string}[]};assert.equal(s.ativos,2);assert.deepEqual(s.registros.map(r=>r.nome),['João','Outro']);assert.equal(ledger,0);assert.equal(staff,1);
 const cash=await readAssistantData(reader,{topic:'caixa'},'OWNER','2026-10-07');const c=cash.dados as {saldo_livre:{centavos:number};reservado_investidores:{centavos:number}};assert.equal(c.saldo_livre.centavos,335000);assert.equal(c.reservado_investidores.centavos,4265000);assert.equal(ledger,1);assert.equal(staff,1);
 await assert.rejects(readAssistantData(reader,{topic:'vendedores'},'VENDEDOR'),/não tem acesso/);
});

test('Private short cache deduplicates in-flight reads, expires, separates keys and never retains errors',async()=>{
 const cache=createAssistantCache(10000,2);let reads=0,release:(v:number)=>void=()=>{};
 const load=()=>{reads++;return new Promise<number>(resolve=>{release=resolve;});};
 const a=cache.read('user-A:investors',load,1000),b=cache.read('user-A:investors',load,1001);await Promise.resolve();assert.equal(reads,1);release(3);assert.deepEqual(await Promise.all([a,b]),[3,3]);
 assert.equal(await cache.read('user-B:investors',async()=>7,1002),7);assert.equal(await cache.read('user-A:investors',async()=>99,2000),3);
 assert.equal(await cache.read('user-A:investors',async()=>4,11000),4);
 await assert.rejects(cache.read('error',async()=>{throw new Error('offline');},21000),/offline/);assert.equal(await cache.read('error',async()=>5,21001),5);
});

test('Function lookup starts before the full response ends and concurrent reads do not wait for each other',async()=>{
 const r=new VoiceResources(),events:{type:string}[]=[];r.channel={readyState:'open',send:(s:string)=>events.push(JSON.parse(s))} as unknown as RTCDataChannel;
 let started=0,resolveFirst:(v:unknown)=>void=()=>{};
 const calls=[{type:'function_call',name:'consultar_dados_icom',call_id:'early_one',arguments:'{"topic":"investidores"}'},{type:'function_call',name:'consultar_dados_icom',call_id:'early_two',arguments:'{"topic":"vendedores"}'}];
 const request=async(_name:string,args:unknown)=>{started++;return (args as {topic:string}).topic==='investidores'?new Promise(resolve=>{resolveFirst=resolve;}):{ok:true};};
 prepareVoiceTools(r,calls,request);await Promise.resolve();assert.equal(started,2);assert.equal(events.length,0);
 const answer=answerVoiceTools(r,calls,request);resolveFirst({ok:true});await answer;assert.equal(started,2);assert.deepEqual(events.map(e=>e.type),['conversation.item.create','conversation.item.create','response.create']);
});

test('Voice lease and warm cache survive separate route module instances without admitting another user',async()=>{
 const originalFetch=globalThis.fetch,key=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='fixture-key';
 globalThis.fetch=async url=>String(url).endsWith('/hangup')?new Response(null,{status:200}):new Response('v=0\r\nm=audio 9 RTP/AVP 111\r\n',{headers:{Location:'/v1/realtime/calls/rtc_routes'}});
 try{
  const voice=await startVoice('route-owner','OWNER',{sdp:offer,section:'dashboard'},new AbortController().signal);
  const serverPath='../lib/icom-bank/assistant-server.ts?route=data',separate=await import(serverPath) as typeof import('../lib/icom-bank/assistant-server.ts');
  separate.claimVoiceRead('route-owner',voice.id);assert.throws(()=>separate.claimVoiceRead('different-owner',voice.id),/nova conversa/);await separate.closeVoice('route-owner',voice.id);assert.throws(()=>claimVoiceRead('route-owner',voice.id),/nova conversa/);
  const cachePath='../lib/icom-bank/assistant-cache.ts?route=quick',otherCache=await import(cachePath) as typeof import('../lib/icom-bank/assistant-cache.ts');
  const ownCache=await import('../lib/icom-bank/assistant-cache.ts');await ownCache.sharedAssistantCache().read('route-fixture',async()=>42);assert.equal(await otherCache.sharedAssistantCache().read('route-fixture',async()=>99),42);
 }finally{globalThis.fetch=originalFetch;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});

test('Close microphone noise gating is stronger without extending answer latency',()=>{
 const s=voiceSession('OWNER','administrativo');assert.equal(s.audio.input.noise_reduction.type,'near_field');assert.equal(s.audio.input.turn_detection.threshold,0.75);assert.equal(s.audio.input.turn_detection.interrupt_response,true);
});
