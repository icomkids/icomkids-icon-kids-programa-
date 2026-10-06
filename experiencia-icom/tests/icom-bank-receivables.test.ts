import test from 'node:test';
import assert from 'node:assert/strict';
import {saleOutstanding,receivableRemaining,receivableState,receivableMatches,receivableStats,receivableInput,receivableExisting,type Receivable,type Receipt} from '../lib/icom-bank/receivables.ts';
import {adminStats,type AdminEntry} from '../lib/icom-bank/administrative.ts';
const id='72fa4d1f-1c4c-4279-9802-2d59ed78ae05',version='2026-10-06T12:00:00Z';
const sale:AdminEntry={id,kind:'VENDA',scope:'LOJA',entry_date:'2026-10-01',description:'Venda teste',category:'Venda',status:'REALIZADO',amount_cents:2000000,details:{sale_cents:10200000,trade_in:true,trade_value_cents:5000000,trade_has_debts:true,trade_ipva_cents:200000,trade_fines_cents:100000,trade_has_payoff:true,trade_payoff_cents:200000},active:true,created_at:version,updated_at:version};
const bill:Receivable={id,source_entry_id:id,title:'Venda',payer:'Cliente',kind:'CLIENTE',bank:'',amount_cents:3700000,received_cents:1000000,due_date:'2026-10-10',notes:'',active:true,created_at:version,updated_at:version};
const receipt:Receipt={id,receivable_id:id,ledger_entry_id:'824b7ff8-bb5a-4257-93fa-640f419b3650',amount_cents:1000000,received_at:'2026-10-06',method:'PIX',active:true,reason:'',created_at:version,updated_at:version};
test('trade debt credit, initial cash and partial receipts do not duplicate a sale',()=>{
 assert.equal(saleOutstanding(sale),3700000);assert.equal(receivableRemaining(bill),2700000);
 const entry:AdminEntry={...sale,id:receipt.ledger_entry_id,kind:'ENTRADA',amount_cents:receipt.amount_cents,details:{payment_method:'PIX'}};
 assert.equal(adminStats([sale,entry],'2026-10').income,3000000);assert.equal(sale.amount_cents,2000000);
});
test('planned sale is tracked but cannot inflate realized receivable agenda',()=>{
 const planned={...sale,status:'PREVISTO' as const};assert.equal(saleOutstanding(planned),5700000);
 assert.equal(receivableState(bill,planned,'2026-10-06'),'Origem prevista');assert.equal(receivableStats([bill],[planned],[receipt],'2026-10','2026-10-06').pending,0);
});
test('legacy and malformed trade fields never invent a debt',()=>{
 for(const d of [{...sale.details,trade_in:undefined},{...sale.details,trade_ipva_cents:undefined},{...sale.details,trade_has_payoff:undefined},{...sale.details,trade_value_cents:1},{...sale.details,sale_cents:1.5}])assert.equal(saleOutstanding({...sale,details:d}),null);
 assert.equal(saleOutstanding({...sale,amount_cents:null}),null);
 assert.equal(saleOutstanding({...sale,details:{sale_cents:2000000,trade_in:false},amount_cents:2000000}),0);
});
test('agenda uses remaining balance, overdue priority and genuine receipt month',()=>{
 const overdue={...bill,due_date:'2026-10-01'},settled={...bill,received_cents:3700000};
 assert.equal(receivableState(overdue,sale,'2026-10-06'),'Em atraso');assert.equal(receivableState(bill,sale,'2026-10-06'),'Parcial');
 assert.equal(receivableState({...bill,due_date:null},sale,'2026-10-06'),'Sem vencimento');assert.equal(receivableState(settled,sale,'2026-10-06'),'Recebida');
 assert.equal(receivableMatches(settled,sale,'day','2026-10','2026-10-10','2026-10-06'),false);
 const stats=receivableStats([overdue],[sale],[receipt,{...receipt,id:'other',active:false},{...receipt,id:'previous',received_at:'2026-09-30'}],'2026-10','2026-10-06');
 assert.equal(stats.overdue.amount,2700000);assert.equal(stats.receivedMonth,1000000);
 assert.equal(receivableMatches(bill,sale,'paid','2026-10','2026-10-06','2026-10-06',[receipt]),true);
 assert.equal(receivableStats([{...bill,active:false}],[sale],[receipt],'2026-10').receivedMonth,0);
});
test('receipt validation rejects unconfirmed, fractional, future and nonpositive money',()=>{
 const valid={action:'receive',id,request_id:receipt.ledger_entry_id,expected_updated_at:version,amount_cents:1,received_at:'2026-10-06',method:'PIX',confirmed:true};
 assert.equal(receivableInput(valid,'2026-10-06').action,'receive');
 for(const patch of [{confirmed:false},{amount_cents:0},{amount_cents:-1},{amount_cents:0.5},{amount_cents:'100'},{received_at:'2026-10-07'},{received_at:'2026-02-30'},{method:'FINANCIAMENTO'},{request_id:'bad'},{expected_updated_at:null}])assert.throws(()=>receivableInput({...valid,...patch},'2026-10-06'));
});
test('manual bills require a due date; corrections and edits require a version',()=>{
 const valid={action:'save',id,expected_updated_at:null,title:'Repasse',payer:'',kind:'BANCO',bank:'Itaú',notes:'',amount_cents:10000,due_date:'2026-10-10'};
 assert.equal(receivableInput(valid).action,'save');assert.throws(()=>receivableInput({...valid,due_date:null}));assert.throws(()=>receivableInput({...valid,kind:'OTHER'}));assert.throws(()=>receivableInput({...valid,amount_cents:0}));
 assert.throws(()=>receivableInput({action:'reverse',id,receipt_id:receipt.id,expected_updated_at:version,reason:'ab'}));
 assert.throws(()=>receivableInput({action:'archive',id,active:false,expected_updated_at:'bad'}));
});
test('linking existing cash accepts only matching unlinked realized store entries',()=>{
 const entry:AdminEntry={...sale,id:receipt.ledger_entry_id,kind:'ENTRADA',amount_cents:1000000,details:{payment_method:'PIX'},entry_date:'2026-10-06'};
 assert.equal(receivableExisting(bill,sale,[sale,entry,{...entry,id:'personal',scope:'PESSOAL'},{...entry,id:'planned',status:'PREVISTO'},{...entry,id:'over',amount_cents:4000000}],[],'2026-10-06').length,1);
 assert.equal(receivableExisting(bill,sale,[entry],[{...receipt,active:false}],'2026-10-06').length,0);
});
