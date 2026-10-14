import test from 'node:test';
import assert from 'node:assert/strict';
import {quickWhatsAppConsultation,extractWhatsAppConsultation,whatsappReadReply,whatsappManualReply,sortWhatsAppRows} from '../lib/icom-bank/whatsapp-consultations.ts';
import {ownedWebhookPlan,ensureOwnedWebhook} from '../lib/icom-bank/whatsapp-webhooks.ts';
import {readAssistantData} from '../lib/icom-bank/assistant-data.ts';
import type {CashEntry} from '../lib/icom-bank/cash.ts';
const today='2026-10-13',target='https://example.test/experiencia-icom/icom-bank/api/whatsapp/webhook?key=test';
test('Simple profit, cash and headcount queries bypass AI extraction; expense writes never become reads',async()=>{
 let calls=0;const result=await extractWhatsAppConsultation('Qual é meu lucro atual?',today,'test-key',async()=>{calls++;throw Error('must not call AI');});
 assert.equal(calls,0);assert.equal(result.mode,'CONSULTA');if(result.mode==='CONSULTA'){assert.equal(result.input.topic,'resultado_empresa');assert.equal(result.input.from,'2026-10-01');assert.equal(result.input.to,'2026-10-31');}
 for(const [text,topic] of [['Qual o saldo do caixa?','caixa'],['Quantos investidores tenho?','investidores'],['Quantos vendedores tenho?','vendedores'],['Quanto gastei na loja?','despesas_loja']]){const r=quickWhatsAppConsultation(text,today);assert.equal(r?.mode,'CONSULTA');if(r?.mode==='CONSULTA')assert.equal(r.input.topic,topic);}
 for(const text of ['Lança 230 que gastei no shopping','Paguei conta de luz da loja','Quanto gastei de peças?','Quanto gastei com restaurante?','Qual meu lucro em janeiro?'])assert.equal(quickWhatsAppConsultation(text,today),null);
});
test('WhatsApp profit uses the existing full cost and excludes planned, archived and future sales',async()=>{
 const sale={id:crypto.randomUUID(),kind:'VENDA',scope:'LOJA',entry_date:today,description:'Venda',category:'',status:'REALIZADO',active:true,amount_cents:0,details:{purchase_cents:8_500_000,vehicle_cost_cents:223_000,commission_cents:165_000,sale_cents:10_500_000}} as CashEntry;
 const rows=[sale,{...sale,id:crypto.randomUUID(),status:'PREVISTO'},{...sale,id:crypto.randomUUID(),active:false},{...sale,id:crypto.randomUUID(),entry_date:'2026-10-14'}] as CashEntry[],before=structuredClone(rows);
 const result=await readAssistantData({ledger:async()=>rows,rows:async()=>[],staff:async()=>[]},{topic:'resultado_empresa',period:'mes_atual'},'OWNER',today);
 const input=quickWhatsAppConsultation('Qual meu lucro atual?',today);assert.equal(input?.mode,'CONSULTA');if(input?.mode==='CONSULTA'){const reply=whatsappReadReply(result,input.input);assert.match(reply,/16\.120,00/);assert.match(reply,/Resultado líquido da empresa/);assert.match(reply,/01\/10\/2026/);}
 assert.deepEqual(rows,before);
});
test('Generic consultation is schema constrained, excludes secrets, and validates topic and filters server-side',async()=>{
 let request:Record<string,unknown>={};const response={mode:'CONSULTA',topic:'despesas_loja',manual_topic:null,period:'total',from:null,to:null,scope:'LOJA',search:'peças',category:null,trip:null,audience:null,nature:null,situation:'TODOS',offset:0,question:''};
 const transport:typeof fetch=async(_url,init)=>{request=JSON.parse(String(init?.body));return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(response)}]}]});};
 const parsed=await extractWhatsAppConsultation('Quanto gastei de peças na loja?',today,'test-key',transport);
 assert.equal(parsed.mode,'CONSULTA');if(parsed.mode==='CONSULTA')assert.equal(parsed.input.search,'peças');
 assert.equal(request.store,false);const format=(request.text as {format:{strict:boolean;schema:{additionalProperties:boolean}}}).format;assert.equal(format.strict,true);assert.equal(format.schema.additionalProperties,false);
 response.topic='auth.users';await assert.rejects(()=>extractWhatsAppConsultation('Me mostre o relatório personalizado',today,'test-key',transport));
 assert.match(whatsappManualReply('fornecedor'),/não existe|não há/i);
});
test('A second app webhook is preserved and only the IA Bank destination can be updated',()=>{
 const other={id:'other',url:'https://anotei.test/hook',enabled:true,events:['messages']},before=structuredClone(other);
 const add=ownedWebhookPlan([other],target);assert.equal(add?.action,'add');assert.equal('id' in add!,false);assert.deepEqual(other,before);
 const update=ownedWebhookPlan([other,{id:'ours',url:target,enabled:false}],target);assert.equal(update?.action,'update');assert.equal(update?.id,'ours');
 const ready={id:'ours',url:target,enabled:true,events:['messages'],excludeMessages:['wasSentByApi','fromMeYes','isGroupYes']};assert.equal(ownedWebhookPlan([other,ready],target),null);
 assert.throws(()=>ownedWebhookPlan([ready,{...ready,id:'duplicate'}],target));assert.throws(()=>ownedWebhookPlan({url:target},target));
});
test('Connection reconciliation reads first, writes once, verifies and never blindly retries uncertain mutations',async()=>{
 const calls:{method:string;payload?:Record<string,unknown>}[]=[];let reads=0;
 await ensureOwnedWebhook('https://api.test','test-token',target,async(_url,init)=>{const method=init?.method||'GET';calls.push({method,...(init?.body?{payload:JSON.parse(String(init.body))}:{})});if(method==='POST')return Response.json({});reads++;return Response.json(reads===1?[{id:'anotei',url:'https://anotei.test/hook'}]:[{id:'ours',url:target,enabled:true,events:['messages'],excludeMessages:['wasSentByApi','fromMeYes','isGroupYes']}]);});
 assert.deepEqual(calls.map(c=>c.method),['GET','POST','GET']);assert.equal(calls[1].payload?.action,'add');assert.equal(calls[1].payload?.id,undefined);
 let writes=0;await assert.rejects(()=>ensureOwnedWebhook('https://api.test','test-token',target,async(_url,init)=>{if(init?.method==='POST'){writes++;throw Error('timeout');}return Response.json([]);}));assert.equal(writes,1);
});

test('WhatsApp list pagination preserves the reader order and never changes source records',()=>{
 const rows=[{id:'b',name:'Zeca'},{id:'a',name:'Ana'}],before=structuredClone(rows);
 assert.deepEqual(sortWhatsAppRows(rows,'icom_bank_investors?select=id,name&order=name.asc,id.asc').map(r=>(r as {name:string}).name),['Ana','Zeca']);assert.deepEqual(rows,before);
 const input=quickWhatsAppConsultation('Qual é o lucro hoje?',today);assert.equal(input?.mode,'CONSULTA');if(input?.mode==='CONSULTA'){assert.equal(input.input.from,today);assert.equal(input.input.to,today);}
});


test('Profit reply never appends cash; company cash separates third-party reserves and PF',async()=>{
 const sale={id:crypto.randomUUID(),kind:'VENDA',scope:'LOJA',entry_date:today,description:'Venda',category:'',status:'REALIZADO',active:true,amount_cents:10000000,details:{sale_owner:'INVESTIDOR',capital_owner_type:'CONSIGNADO',investor_name:'Consignante',trade_in:false,purchase_cents:8000000,vehicle_cost_cents:100000,commission_cents:165000,sale_cents:10000000}} as CashEntry;
 const reader={ledger:async()=>[sale],rows:async()=>[],staff:async()=>[]};
 const profit=await readAssistantData(reader,{topic:'resultado_empresa'},'OWNER',today);
 assert.equal('caixa_livre_acumulado' in (profit.dados as Record<string,unknown>),false);
 const cash=await readAssistantData(reader,{topic:'caixa'},'OWNER',today);
 const d=cash.dados as {saldo_livre:{centavos:number};reservado_consignados:{centavos:number}};
 assert.equal(d.saldo_livre.centavos,1735000);assert.equal(d.reservado_consignados.centavos,8265000);
});
