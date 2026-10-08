import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {manualViewFromPath,manualMenu,readManual} from '../lib/icom-bank/assistant-manual.ts';
import {syncManualView} from '../lib/icom-bank/assistant-navigation.ts';
import {VoiceResources,answerVoiceTools} from '../lib/icom-bank/assistant-client.ts';
import {voiceSession} from '../lib/icom-bank/assistant-session.ts';
const source=(n:string)=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
test('Manual numbering matches the filtered sidebar and restricts owner guides',()=>{
 assert.deepEqual(manualMenu('OWNER').slice(0,4).map(m=>m.number+' '+m.label),['01 Visão Geral','02 Clientes','03 Contratos','04 Administrativo']);
 assert.deepEqual(manualMenu('FINANCEIRO').map(m=>m.number+' '+m.label),['01 Visão Geral','02 Parcelas','03 Pagamentos','04 Comprovantes','05 Inadimplência']);
 for(const role of ['VENDEDOR','GERENTE','ADMIN','FINANCEIRO'] as const){const restricted=readManual({topic:'investidor'},'investidores',role);assert.equal(restricted.available,false);assert.equal(restricted.steps.length,0);assert.equal(restricted.current_view.id,'nao_identificada');}
 assert.equal(readManual({topic:'cliente'},'clientes','VENDEDOR').available,true);
});
test('Navigation sends only static view enums; record IDs and query values are discarded',()=>{
 const id='6a7f41a3-47de-4968-a574-7607ee1a7127';
 assert.equal(manualViewFromPath('/experiencia-icom/icom-bank/clientes/'+id+'?cpf=private','OWNER'),'cliente_ficha');
 assert.equal(manualViewFromPath('/icom-bank/clientes/'+id+'/contrato/novo','OWNER'),'contrato_veiculo');
 assert.equal(manualViewFromPath('/icom-bank/clientes/novo','OWNER'),'cliente_novo');
 assert.equal(manualViewFromPath('/icom-bank/administrativo/investidores','VENDEDOR'),'nao_identificada');
 assert.equal(manualViewFromPath('/not-bank/clientes','OWNER'),'nao_identificada');
 const events:unknown[]=[];const r=new VoiceResources();r.channel={readyState:'open',send:(s:string)=>events.push(JSON.parse(s))} as RTCDataChannel;
 assert.equal(syncManualView(r,'cliente_ficha','OWNER'),true);assert.equal(syncManualView(r,'cliente_ficha','OWNER'),false);
 assert.equal(syncManualView(r,'contrato_condicoes','OWNER'),true);
 assert.doesNotMatch(JSON.stringify(events),/response.create|private|6a7f41a3/);
 r.cancelled=true;assert.equal(syncManualView(r,'clientes','OWNER'),false);assert.equal(events.length,2);
});
test('Manual follows form stages, uses real labels, and does not invent supplier registration',()=>{
 const guide=readManual({topic:'contrato'},'contrato_condicoes','OWNER');
 assert.match(guide.steps[guide.suggested_step-1].text,/Condições financeiras/);
 assert.match(guide.steps.map(s=>s.text).join(' '),/REVISAR PARCELAS/);
 assert.equal(readManual({topic:'investidor'},'investidor_form','OWNER').suggested_step,4);
 const supplier=readManual({topic:'fornecedor'},'administrativo','OWNER');assert.equal(supplier.available,false);assert.equal(supplier.steps.length,0);assert.match(supplier.notes.join(' '),/Não existe cadastro específico/);
 const paid=readManual({topic:'pagar_conta'},'pagar_conta_form','OWNER');assert.equal(paid.suggested_step,3);assert.match(paid.notes.join(' '),/não executa Pix/);
 for(const [topic,file,labels] of [
  ['cliente','BankNewCustomer',['SALVAR CLIENTE','Nome completo']],
  ['investidor','BankInvestors',['SALVAR INVESTIDOR','+ CADASTRAR INVESTIDOR']],
  ['funcionario','BankStaff',['REVISAR AUTORIZAÇÃO','CONFIRMAR AUTORIZAÇÃO']],
  ['relatorio','BankReports',['Aplicar período','EXPORTAR CSV']],
 ] as const){const text=readManual({topic},'dashboard','OWNER').steps.map(s=>s.text).join(' '),component=source('components/icom-bank/'+file+'.tsx');for(const label of labels){assert.ok(text.includes(label));assert.ok(component.includes(label));}}
 assert.throws(()=>readManual({topic:'cliente',role:'OWNER'},'clientes','VENDEDOR'));
 assert.throws(()=>readManual({topic:'inventado'},'dashboard','OWNER'));
});
test('Every role receives a read-only help tool, and HOW instructions take priority over preparation',async()=>{
 for(const role of ['OWNER','ADMIN','GERENTE','VENDEDOR','FINANCEIRO'] as const){const session=voiceSession(role,'dashboard');assert.ok(session.tools.some(t=>t.name==='consultar_manual_icom'));assert.match(session.instructions,/NUNCA use preparar_despesa_icom/);assert.match(session.instructions,/Não responda|não fale nem interrompa/);assert.doesNotMatch(session.instructions,/\$\{plateVoiceInstructions\}/);}
 const r=new VoiceResources(),events:{type:string;item?:{output:string}}[]=[];r.channel={readyState:'open',send:(s:string)=>events.push(JSON.parse(s))} as RTCDataChannel;
 let reads=0;await answerVoiceTools(r,[{type:'function_call',name:'consultar_manual_icom',call_id:'help_1',arguments:'{"topic":"cliente"}'}],async(name,args)=>{assert.equal(name,'consultar_manual_icom');reads++;return readManual(args,'clientes','VENDEDOR');});
 assert.equal(reads,1);assert.equal(JSON.parse(events[0].item!.output).mode,'MANUAL');assert.equal(events[1].type,'response.create');
});
test('Manual endpoint uses server-authenticated role and voice lease, with no financial query or mutation',()=>{
 const endpoint=source('app/icom-bank/api/assistant/manual/route.ts');assert.match(endpoint,/authorizeAssistant/);assert.match(endpoint,/claimVoiceRead\(profile.user_id/);assert.match(endpoint,/bankOrigin/);assert.match(endpoint,/profile.role/);assert.doesNotMatch(endpoint,/queryAssistant|bankQuery|service_role|bankMutation/);
 const client=source('components/icom-bank/BankVoiceAssistant.tsx');assert.match(client,/aria-modal="false"/);assert.match(client,/view:viewRef.current/);assert.match(client,/attributeFilter:\['data-bank-manual-view'\]/);assert.doesNotMatch(client,/innerText|textContent/);
 for(const n of ['BankNewCustomer','BankContractForm'])assert.doesNotMatch(source('components/icom-bank/'+n+'.tsx'),/location.assign/);
});
