import test from 'node:test';
import assert from 'node:assert/strict';
import {agendaInput,agendaItems,agendaStatedDate,agendaStatedTime,isAgendaWrite,agendaMorningReply,agendaReminderWindow,type AgendaEvent} from '../lib/icom-bank/agenda.ts';
import {prepareFinancial,type FinancialDraft} from '../lib/icom-bank/assistant-financial.ts';
import {readAssistantData} from '../lib/icom-bank/assistant-data.ts';
import {quickWhatsAppConsultation} from '../lib/icom-bank/whatsapp-consultations.ts';
import {orderedMenu,preferencesPatch} from '../lib/icom-bank/preferences.ts';
import {canBank} from '../lib/icom-bank/model.ts';
import type {Payable} from '../lib/icom-bank/payables.ts';
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',today='2026-10-14';
const event=(patch:Partial<AgendaEvent>={}):AgendaEvent=>({id,owner_id:id,scope:'LOJA',title:'Reunião',due_date:today,due_time:'14:30',notes:'',status:'PENDENTE',origin:'PAINEL',created_at:'',updated_at:'2026-10-14T12:00:00Z',...patch});
const bill=(patch:Partial<Payable>={}):Payable=>({id:crypto.randomUUID(),stock_id:null,kind:'DESPESA',scope:'LOJA',title:'Luz da loja',amount_cents:25000,due_date:today,active:true,status:'PENDENTE',paid_at:null,notes:'',bank:'',method:null,ledger_entry_id:null,receipt_id:null,created_at:'',updated_at:'',...patch});
test('Agenda validates identity, date, time, scope and version without accepting financial fields',()=>{
 const p={id,title:'Dentista',scope:'PESSOAL',due_date:'2026-10-15',due_time:'09:00',notes:'',status:'PENDENTE',expected_updated_at:null};
 assert.equal(agendaInput(p).p_payload.due_time,'09:00');
 for(const bad of [{due_date:'2026-02-30'},{due_time:'25:10'},{scope:'EXTERNO'},{owner_id:id},{amount_cents:1},{expected_updated_at:'invalid'}])assert.throws(()=>agendaInput({...p,...bad}));
});
test('Calendar combines commitments with canonical bills once and excludes inactive/planned stock',()=>{
 const a=event(),b=bill(),hidden=bill({stock_id:id}),rows=agendaItems([a],[b,hidden,bill({active:false}),bill({due_date:null})],[{id,active:true,status:'PREVISTO'}],today);
 assert.equal(rows.length,2);assert.equal(rows.filter(x=>x.type==='PAGAMENTO').length,1);assert.equal(rows[0].amount_cents,null);
 assert.equal(agendaItems([], [hidden],[{id,active:true,status:'DISPONIVEL'}],today).length,1);
 assert.equal(agendaItems([], [bill({status:'PAGO'})],[],today)[0].overdue,false);
});
test('Agenda writes never hijack reports, how-to requests or an already-paid expense',()=>{
 for(const text of ['Agende uma reunião amanhã','Agenda pra mim o dentista dia 15','Lança uma dívida de 250 para amanhã','Vou pagar aluguel dia 20'])assert.equal(isAgendaWrite(text),true,text);
 for(const text of ['Quais são meus compromissos hoje?','Como faço para agendar uma reunião?','Paguei a conta da loja','Já agendou?','Qual meu lucro atual?'])assert.equal(isAgendaWrite(text),false,text);
});
test('Spoken and written dates are checked against literal evidence; time accepts natural Brazilian speech',()=>{
 for(const [excerpt,date] of [['amanhã','2026-10-15'],['depois de amanhã','2026-10-16'],['15/10/2026','2026-10-15'],['15 de novembro','2026-11-15'],['próxima segunda-feira','2026-10-19'],['dia 15','2026-10-15']])assert.equal(agendaStatedDate(date,excerpt,'Agende '+excerpt,today),date);
 assert.throws(()=>agendaStatedDate('2026-10-16','amanhã','Agende amanhã',today));
 assert.throws(()=>agendaStatedDate('2026-10-15','amanhã','Agende hoje',today));
 assert.equal(agendaStatedTime('14:30','às 14:30','Reunião às 14:30'),'14:30');
 assert.equal(agendaStatedTime('14:30','às duas e meia da tarde','Reunião às duas e meia da tarde'),'14:30');
 assert.equal(agendaStatedTime(undefined,undefined,'Reunião amanhã'),null);
 assert.throws(()=>agendaStatedTime('17:30','às 14:30','Reunião às 14:30'));
});
test('The morning window is São Paulo 08:00 and daily summaries disclose no actual bank payment',()=>{
 assert.equal(agendaReminderWindow(new Date('2026-10-15T10:59:00Z')),false);
 assert.equal(agendaReminderWindow(new Date('2026-10-15T11:00:00Z')),true);
 assert.equal(agendaReminderWindow(new Date('2026-10-15T23:00:00Z')),false);
 const items=agendaItems([event()],[bill()],[],today),reply=agendaMorningReply({day:today,events:items.filter(e=>e.type==='COMPROMISSO'),bills:items.filter(e=>e.type==='PAGAMENTO'),events_count:1,bills_count:1,bills_total:25000});
 assert.match(reply,/250,00/);assert.match(reply,/Nenhum pagamento foi realizado/);assert.match(reply,/14:30/);
});
test('Voice and WhatsApp preparations create future pending debts and commitments without consulting bank accounts',async()=>{
 const reader=async()=>{throw Error('must not read accounts');};
 const d:FinancialDraft={operation:'AGENDA',form:JSON.stringify({title:'Reunião',scope:'LOJA',due_date:'2026-10-15',due_time:'14:30'}),evidence:JSON.stringify({due_date:'amanhã',due_time:'14:30'}),confidence:'ALTA',question:''};
 const prepared=await prepareFinancial(d,'Agende reunião amanhã às 14:30',today,reader,id);assert.equal(prepared.rpc,'icom_bank_save_agenda');assert.equal(prepared.account_id,undefined);assert.equal((prepared.args.p_payload as {status:string}).status,'PENDENTE');
 const debt:FinancialDraft={operation:'CONTA_PAGAR',form:JSON.stringify({title:'Escola',scope:'PESSOAL',amount_cents:'250,00',due_date:'2026-10-15'}),evidence:JSON.stringify({amount_cents:'250',due_date:'amanhã'}),confidence:'ALTA',question:''};
 const p=await prepareFinancial(debt,'Lança uma dívida de 250 da escola para amanhã',today,reader,id);assert.equal(p.rpc,'icom_bank_save_expense');assert.equal(p.account_id,undefined);assert.equal(p.args.p_expected,null);
});
test('Agenda queries honor role/date filters, include existing bills and preserve financial entries',async()=>{
 const p=bill(),reader={ledger:async()=>{throw Error('no ledger needed');},staff:async()=>[],rows:async(path:string)=>path.startsWith('icom_bank_agenda_events?')?[event(),event({id:crypto.randomUUID(),due_date:'2026-10-15'})]:path.startsWith('icom_bank_payables?')?[p]:[]};
 const r=await readAssistantData(reader,{topic:'agenda',period:'personalizado',from:today,to:today,situation:'PENDENTES'},'OWNER',today),d=r.dados as {quantidade:number;total_a_pagar:{centavos:number}};
 assert.equal(d.quantidade,2);assert.equal(d.total_a_pagar.centavos,25000);
 await assert.rejects(()=>readAssistantData(reader,{topic:'agenda'},'VENDEDOR',today),/não tem acesso/);
 assert.equal(quickWhatsAppConsultation('Quais meus compromissos hoje?',today)?.mode,'CONSULTA');
});
test('Agenda is added without changing seller grants or a saved menu order',()=>{
 assert.equal(canBank('OWNER','agenda'),true);assert.equal(canBank('VENDEDOR','agenda'),false);assert.equal(canBank('ADMIN','agenda'),false);
 assert.deepEqual(orderedMenu('OWNER',['clientes','dashboard']).slice(0,2).map(([id])=>id),['clientes','dashboard']);
 assert.ok(orderedMenu('OWNER',['clientes','dashboard']).some(([id])=>id==='agenda'));
 assert.deepEqual(preferencesPatch({menu_order:orderedMenu('OWNER').map(([id])=>id)}).menu_order?.length,13);
});
