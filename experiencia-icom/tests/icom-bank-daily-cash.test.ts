import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyCash,withdrawalInput,checkInput,cashDay,previousCashDay} from '../lib/icom-bank/daily-cash.ts';
import type {CashEntry} from '../lib/icom-bank/cash.ts';
const day='2026-10-07',id='e598269b-b7a0-4a4c-88a2-e9cd791265d6';
const entry=(kind:CashEntry['kind'],amount:number,extra:Partial<CashEntry>={}):CashEntry=>({id:crypto.randomUUID(),kind,scope:kind==='PESSOAL'?'PESSOAL':'LOJA',entry_date:day,description:'Fixture',category:'',status:'REALIZADO',amount_cents:amount,details:{},active:true,created_at:day,updated_at:day,...extra});
const withdrawal=(extra:Record<string,unknown>={})=>({id,date:day,recipient:'Bruno',reason:'Retirada pessoal',purpose:'LOJA',method:'PIX',amount_cents:45000,confirmed:true,...extra});
test('Daily opening, shop outflow, personal outflow and total reconcile exactly',()=>{
 const rows=[entry('ENTRADA',1500000,{entry_date:'2026-10-06'}),entry('ENTRADA',20000),entry('CUSTO',45000),entry('PESSOAL',12000),entry('CUSTO',999999,{status:'PREVISTO'}),entry('CUSTO',999999,{active:false}),entry('ENTRADA',999999,{entry_date:'2026-10-08'})];
 const m=dailyCash(rows,day);assert.equal(m.opening_gross,1500000);assert.equal(m.income,20000);assert.equal(m.expenses,45000);assert.equal(m.personal,12000);assert.equal(m.gross,1463000);assert.equal(m.available,1463000);assert.equal(m.opening_gross+m.income-m.expenses-m.personal,m.gross);
});
test('Bank balance must compare to total cash, not to investor-free profit',()=>{
 const sale=entry('VENDA',7200000,{details:{sale_owner:'INVESTIDOR',investor_name:'Eric',trade_in:true,trade_destination:'INVESTIDOR',trade_investor_name:'Eric',trade_value_cents:3000000,purchase_cents:8500000,vehicle_cost_cents:120000,commission_cents:165000,sale_cents:10200000}});
 const m=dailyCash([sale],day);assert.equal(m.gross,7200000);assert.equal(m.available,1415000);assert.equal(m.investor,5785000);assert.equal(7200000-m.gross,0);
 const returned=withdrawalInput(withdrawal({purpose:'INVESTIDOR',sale_id:sale.id,amount_cents:5785000}),day);const after=dailyCash([sale,entry(returned.kind,returned.amount_cents!,{details:returned.details})],day);assert.equal(after.gross,1415000);assert.equal(after.available,1415000);assert.equal(after.investor,0);
});
test('Shop and personal withdrawals deduct exactly once from the same total ledger',()=>{
 const shop=withdrawalInput(withdrawal(),day),personal=withdrawalInput(withdrawal({id:crypto.randomUUID(),purpose:'PESSOAL',amount_cents:12000}),day);
 assert.equal(shop.kind,'CUSTO');assert.equal(personal.kind,'PESSOAL');assert.match(shop.description,/Bruno/);assert.match(shop.details.notes!,/Destinatário: Bruno/);
 const m=dailyCash([entry('ENTRADA',1500000),entry(shop.kind,shop.amount_cents!,{details:shop.details}),entry(personal.kind,personal.amount_cents!,{details:personal.details})],day);assert.equal(m.gross,1443000);assert.equal(m.available,1443000);assert.equal(m.expenses,45000);assert.equal(m.personal,12000);
});
test('Return distributions are included in daily expenses without changing store profit',()=>{const m=dailyCash([entry('RETORNO',100000,{details:{tax_cents:10000,manager_cents:20000,seller_cents:15000}})],day);assert.equal(m.income,100000);assert.equal(m.expenses,45000);assert.equal(m.gross,55000);});
test('Withdrawals require positive cents, recipient, purpose, confirmation and an investor sale',()=>{for(const extra of [{amount_cents:0},{amount_cents:-1},{amount_cents:1.5},{confirmed:false},{recipient:''},{purpose:'OTHER'},{purpose:'INVESTIDOR'},{date:'2026-10-08'},{method:'CARTAO'},{reason:''}])assert.throws(()=>withdrawalInput(withdrawal(extra),day));assert.equal(withdrawalInput(withdrawal({method:'TRANSFERENCIA'}),day).details.payment_method,'TRANSFERENCIA');});
test('Withdrawal can reflect an actual overdraft, but cannot inject a sale link into shop outflow',()=>{const payload=withdrawalInput(withdrawal({sale_id:id}),day);assert.equal(payload.details.sale_cost_id,undefined);assert.equal(dailyCash([entry('CUSTO',45000)],day).available,-45000);});
test('Reconciliation accepts zero and negative observed balances and rejects invalid values',()=>{
 const base={id,date:day,revision:'a'.repeat(32),notes:'',observed_cents:0};assert.equal(checkInput(base,day).observed_cents,0);assert.equal(checkInput({...base,observed_cents:-12300},day).observed_cents,-12300);
 for(const extra of [{observed_cents:'0'},{observed_cents:0.5},{revision:'bad'},{date:'2026-02-30'},{date:'2026-10-08'},{id:'bad'}])assert.throws(()=>checkInput({...base,...extra},day));
});
test('Daily cutoff handles month and leap-year boundaries',()=>{assert.equal(previousCashDay('2026-01-01'),'2025-12-31');assert.equal(previousCashDay('2024-03-01'),'2024-02-29');assert.throws(()=>cashDay('1999-12-31',day));assert.throws(()=>cashDay('',day));});
