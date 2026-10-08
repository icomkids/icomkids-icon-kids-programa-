import test from 'node:test';
import assert from 'node:assert/strict';
import {financialOverview} from '../lib/icom-bank/financial-overview.ts';
import {wealthInput,wealthSummary,monthlyEstimate,type WealthRecord} from '../lib/icom-bank/personal-wealth.ts';
import {cashPosition,type CashEntry} from '../lib/icom-bank/cash.ts';
const id='00000000-0000-4000-8000-000000000001';
const e=(kind:CashEntry['kind'],amount:number,extra:Partial<CashEntry>={}):CashEntry=>({id:crypto.randomUUID(),kind,scope:kind==='PESSOAL'?'PESSOAL':'LOJA',entry_date:'2026-10-08',description:'Teste',category:'Teste',status:'REALIZADO',amount_cents:amount,details:{},active:true,created_at:'2026-10-08T12:00:00Z',updated_at:'2026-10-08T12:00:00Z',...extra});
const w=(kind:WealthRecord['kind'],amount:number,extra:Partial<WealthRecord>={}):WealthRecord=>({id,owner_id:id,kind,name:'Teste',category:'Poupança',record_date:'2026-10-08',amount_cents:amount,debt_cents:0,invested_cents:0,rate_percent:null,rate_period:'MENSAL',source_id:null,notes:'',active:true,created_at:'2026-10-08T12:00:00Z',updated_at:'2026-10-08T12:00:00Z',...extra});
test('Priority summary shows 12k profit minus 4k operating costs and 2k personal, without changing cash',()=>{
 const sale=e('VENDA',9_000_000,{details:{sale_cents:9_000_000,purchase_cents:7_635_000,commission_cents:165_000,vehicle_cost_cents:0,sale_owner:'LOJA',trade_in:false}}),rows=[sale,e('CUSTO',400_000),e('PESSOAL',200_000)];
 const before=cashPosition(rows,'2026-10-08'),s=financialOverview(rows,[],'2026-10','2026-10-08');
 assert.equal(s.earnings,1_200_000);assert.equal(s.company,800_000);assert.equal(s.real,600_000);assert.deepEqual(s.cash,before);assert.equal(rows[0].details.purchase_cents,7_635_000);
});
test('Investor capital, linked sale payments and embedded vehicle cost settlements never create profit or double expenses',()=>{
 const sale=e('VENDA',7_200_000,{id,details:{sale_cents:10_200_000,purchase_cents:8_400_000,vehicle_cost_cents:220_000,commission_cents:165_000,sale_owner:'INVESTIDOR',investor_name:'Teste',trade_in:true,trade_destination:'INVESTIDOR',trade_investor_name:'Teste',trade_value_cents:3_000_000,trade_has_debts:false}});
 const rows=[sale,e('ENTRADA',100_000,{cash_source_id:id}),e('CUSTO',220_000,{details:{sale_cost_id:id,settlement_part:'CUSTOS'}}),e('CUSTO',5_785_000,{details:{sale_cost_id:id,settlement_part:'INVESTIDOR'}}),e('CUSTO',40_000)];
 const s=financialOverview(rows,[],'2026-10','2026-10-08');assert.equal(s.earnings,1_415_000);assert.equal(s.costs,40_000);assert.deepEqual(s.cash,cashPosition(rows,'2026-10-08'));
});
test('Real negatives are preserved, and planned archived and future records stay out',()=>{
 const rows=[e('CUSTO',200_000),e('PESSOAL',50_000),e('ENTRADA',1_000_000,{status:'PREVISTO'}),e('ENTRADA',1_000_000,{active:false}),e('ENTRADA',1_000_000,{entry_date:'2026-10-09'})];const s=financialOverview(rows,[],'2026-10','2026-10-08');assert.equal(s.real,-250_000);assert.equal(s.earnings,0);
});
test('Wealth includes current assets less debt; income excludes principal, contributions, archived and future receipts',()=>{
 const rows=[w('ATIVO',15_000_000,{debt_cents:2_000_000,invested_cents:10_000_000,rate_percent:12,rate_period:'ANUAL'}),w('RENDA',100_000),w('APORTE',200_000),w('RESGATE',300_000),w('RENDA',50_000,{active:false}),w('RENDA',50_000,{record_date:'2026-10-09'})];
 const s=wealthSummary(rows,'2026-10','2026-10-08');assert.equal(s.net,13_000_000);assert.equal(s.income,100_000);assert.equal(s.contributions,200_000);assert.equal(monthlyEstimate(rows[0]),100_000);
 assert.equal(financialOverview([],rows,'2026-10','2026-10-08').total,100_000);assert.equal(financialOverview([],rows,'2026-10','2026-10-08').cash.available,0);
});
test('Personal write input rejects invalid dates, arbitrary categories and principal masquerading as a receipt with asset fields',()=>{
 const payload={...w('RENDA',20_000),expected_updated_at:null};assert.equal(wealthInput(payload,'2026-10-08').amount_cents,20_000);
 for(const change of [{record_date:'2026-10-09'},{record_date:'2026-02-30'},{category:'injected'},{rate_percent:1},{debt_cents:2},{source_id:'not-an-id'},{amount_cents:0},{active:'true'}])assert.throws(()=>wealthInput({...payload,...change},'2026-10-08'));
});
