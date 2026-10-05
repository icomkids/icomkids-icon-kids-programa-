import {test} from 'node:test';
import assert from 'node:assert/strict';
import {payableInput,payableState,payableStats,payableExisting,type Payable} from '../lib/icom-bank/payables.ts';
import {adminStats,type AdminEntry} from '../lib/icom-bank/administrative.ts';
import {stockCosts,type StockRow} from '../lib/icom-bank/stock.ts';
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',stamp='2026-10-05T21:00:00Z';
const p={id,stock_id:id,kind:'IPVA',amount_cents:120000,bank:'',due_date:null,status:'PENDENTE',active:true,updated_at:stamp} as Payable;
const s={id,entry_date:'2026-01-01',status:'AGUARDANDO_QUITACAO',active:true,purchase_cents:5000000} as StockRow;
const input={id,expected_updated_at:stamp};
test('Payable dates, methods, confirmation and CAS identifiers are required',()=>{
 assert.deepEqual(payableInput({...input,action:'schedule',due_date:'',notes:' ok '}),{action:'schedule',args:{p_id:id,p_expected:stamp,p_due:null,p_notes:'ok'}});
 for(const due_date of ['2026-02-30','1999-12-31','2101-01-01'])assert.throws(()=>payableInput({...input,action:'schedule',due_date,notes:''}));
 const pay={...input,action:'pay',request_id:other,paid_at:'2026-10-05',method:'PIX',confirmed:true};
 assert.equal(payableInput(pay,'2026-10-05').action,'pay');
 for(const patch of [{confirmed:false},{paid_at:'2026-10-06'},{method:'FINANCIAMENTO'},{request_id:'x'},{receipt_id:'x'},{existing_id:'x'},{expected_updated_at:null}])assert.throws(()=>payableInput({...pay,...patch},'2026-10-05'));
 assert.throws(()=>payableInput({...input,action:'reverse',reason:'a'}));
 assert.equal(payableInput({...input,action:'reverse',reason:' Correção de teste '}).args.p_id,id);
});
test('No guessed due dates: unknown, planned, overdue, today, future, paid and archived',()=>{
 assert.equal(payableState(p,s,'2026-10-05'),'Sem vencimento');
 assert.equal(payableState({...p,due_date:'2026-10-04'},s,'2026-10-05'),'Vencido');
 assert.equal(payableState({...p,due_date:'2026-10-05'},s,'2026-10-05'),'Vence hoje');
 assert.equal(payableState({...p,due_date:'2026-10-06'},s,'2026-10-05'),'Pendente');
 assert.equal(payableState(p,{...s,status:'PREVISTO'}),'Origem prevista');
 assert.equal(payableState({...p,status:'PAGO'},s),'Pago');
 assert.equal(payableState({...p,active:false},s),'Arquivado');
 assert.equal(payableState(p,undefined),'Arquivado');
});
test('Monthly obligation totals use due date and actual payments use paid date; planned/archived origins excluded',()=>{
 const stock=[s,{...s,id:other,status:'PREVISTO' as const}];
 const stats=payableStats([p,{...p,due_date:'2026-09-01'},{...p,due_date:'2026-10-10'},{...p,status:'PAGO',paid_at:'2026-10-02',due_date:'2026-09-01'},{...p,stock_id:other},{...p,active:false}],stock,'2026-10','2026-10-05');
 assert.deepEqual(stats,{pending:360000,overdue:120000,dueMonth:120000,noDate:1,paidMonth:120000,planned:1});
});
test('Existing-payment matching excludes planned, personal, linked, prep costs and wrong amounts',()=>{
 const e={id:other,active:true,kind:'CUSTO',scope:'LOJA',status:'REALIZADO',amount_cents:120000,entry_date:'2026-01-02',details:{payment_method:'PIX'}} as AdminEntry;
 const invalid=[{active:false},{status:'PREVISTO'},{scope:'PESSOAL'},{kind:'ENTRADA'},{amount_cents:119999},{entry_date:'2025-12-31'},{details:{payment_method:'PIX',stock_id:id}},{details:{payment_method:'FINANCIAMENTO'}}];
 assert.equal(payableExisting(p,s,[e,...invalid.map(x=>({...e,...x}) as AdminEntry)],[]).length,1);
 assert.equal(payableExisting(p,s,[e],[{...p,ledger_entry_id:other,status:'PAGO'}]).length,0);
});
test('Debt outflow affects cash once and leaves acquisition/preparation cost unchanged; reversal leaves audit row out of totals',()=>{
 const debt={id:other,active:true,kind:'CUSTO',scope:'LOJA',status:'REALIZADO',amount_cents:120000,entry_date:'2026-10-05',details:{payment_method:'PIX',plate:'ABC1234'}} as AdminEntry;
 assert.equal(adminStats([debt],'2026-10').expenses,120000);
 assert.equal(stockCosts(s,[debt]),0);
 assert.equal(s.purchase_cents+stockCosts(s,[debt]),5000000);
 assert.equal(adminStats([{...debt,active:false}],'2026-10').expenses,0);
});
