import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adminInput,adminArchiveInput,adminYear,adminStats,saleCost,saleProfit,returnNet,returnStore,adminMoneyInput,adminMoneyText,adminSaleCalculation,adminSaleSettlement,adminSaleReceived,defaultSaleCommission,type AdminEntry} from '../lib/icom-bank/administrative.ts';
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const base={id,kind:'VENDA',scope:'LOJA',entry_date:'2026-10-05',description:'Venda teste',category:'',status:'REALIZADO',amount_cents:400000,details:{vehicle:'Teste',plate:'ABC1234',purchase_cents:800000,vehicle_cost_cents:10000,commission_cents:20000,sale_cents:1000000},expected_updated_at:null};
const row=(override:Partial<AdminEntry>={})=>({...adminInput(base),active:true,created_at:'2026-10-05T12:00:00Z',updated_at:'2026-10-05T12:00:00Z',...override}) as AdminEntry;
test('Administrative sale profit uses costs; cash uses received value instead of full sale price',()=>{const e=row();assert.equal(saleCost(e),830000);assert.equal(saleProfit(e),170000);const s=adminStats([e],'2026-10');assert.equal(s.income,400000);assert.equal(s.profit,170000);assert.equal(s.sales,1);});
test('Administrative closure separates personal expenses and ignores planned, archived and other periods',()=>{const s=adminStats([row(),row({kind:'CUSTO',amount_cents:10000}),row({kind:'PESSOAL',scope:'PESSOAL',amount_cents:5000}),row({kind:'MENSAL',scope:'PESSOAL',amount_cents:3000}),row({status:'PREVISTO',amount_cents:999999}),row({active:false,amount_cents:999999}),row({entry_date:'2026-09-30',amount_cents:999999})],'2026-10');assert.equal(s.income,400000);assert.equal(s.expenses,10000);assert.equal(s.personal,8000);assert.equal(s.balance,390000);assert.equal(s.combined,382000);});
test('Bank return subtracts tax and manual allocations exactly once',()=>{const e=row({kind:'RETORNO',amount_cents:100000,details:{vehicle:'Teste',tax_cents:10000,manager_cents:20000,seller_cents:30000}}),s=adminStats([e],'2026-10');assert.equal(returnNet(e),90000);assert.equal(returnStore(e),40000);assert.equal(s.income,100000);assert.equal(s.expenses,60000);assert.equal(s.balance,40000);assert.equal(s.returns,40000);});
test('Monthly OK without amount remains unknown; explicit zero remains a valid known amount',()=>{const without=adminInput({...base,kind:'MENSAL',amount_cents:null,details:{due_day:31,notes:'OK'}});assert.equal(without.amount_cents,null);const s=adminStats([row({...without}),row({kind:'MENSAL',amount_cents:0})],'2026-10');assert.equal(s.missing,1);assert.equal(s.expenses,0);assert.throws(()=>adminInput({...base,amount_cents:null}));});
test('Administrative input rejects malformed dates, negative/fractional money, invalid scope and over-allocation',()=>{for(const changed of [{entry_date:'2026-02-30'},{entry_date:'1999-12-31'},{amount_cents:-1},{amount_cents:1.5},{amount_cents:1000000001},{scope:'PESSOAL'},{details:{...base.details,purchase_cents:'100'}},{details:{...base.details,plate:'invalid'}},{kind:'RETORNO',details:{vehicle:'Teste',tax_cents:400001}}])assert.throws(()=>adminInput({...base,...changed}));const v=adminInput({...base,created_by:'forged',active:false,details:{...base.details,secret:'discard'}});assert.equal('created_by' in v,false);assert.equal('active' in v,false);assert.equal('secret' in v.details,false);});
test('Administrative edit/archive requires version and years cannot exceed supported range',()=>{assert.throws(()=>adminInput({...base,expected_updated_at:'invalid'}));assert.throws(()=>adminArchiveInput({id,active:false}));assert.equal(adminArchiveInput({id,active:false,expected_updated_at:'2026-10-05T12:00:00Z'}).active,false);assert.equal(adminYear('2026'),2026);assert.throws(()=>adminYear('2101'));assert.throws(()=>adminYear('bad'));});
test('Trade sheet does not invent a cash movement from vehicle debt or manual divisions',()=>{const e=row({kind:'TROCA',amount_cents:null,details:{vehicle:'Teste',paid_cents:10000,debt_cents:20000,profit_share_cents:5000}}),s=adminStats([e],'2026-10');assert.equal(s.income,0);assert.equal(s.expenses,0);assert.equal(s.profit,0);});
test('Brazilian administrative amounts preserve reais and cents through formatted inputs',()=>{
 for(const [input,cents] of [['85000',8500000],['85.000,00',8500000],['2.500',250000],['1650,5',165050],['0',0],['0,01',1],['R$ 1.650,00',165000],['10.000.000,00',1000000000]] as const){assert.equal(adminMoneyInput(input),cents);assert.equal(adminMoneyInput(adminMoneyText(cents)),cents);}
 assert.equal(adminMoneyText(8500000),'85.000,00');assert.equal(adminMoneyText(0),'0,00');
 for(const bad of ['', '-1', '85.00', '1.2.3', '1,234', '10000000,01','abc'])assert.throws(()=>adminMoneyInput(bad));
});
test('Bruno sale example includes only incremental vehicle costs and the fixed seller cost',()=>{
 const c=adminSaleCalculation({purchase_cents:'85.000,00',vehicle_cost_cents:'2.500,00',commission_cents:adminMoneyText(defaultSaleCommission),sale_cents:'102.000,00'});
 assert.equal(c.total,8915000);assert.equal(c.profit,1285000);
 assert.equal(adminSaleReceived(c.sale,'INTEGRAL',''),10200000);assert.equal(adminSaleReceived(c.sale,'PARCIAL','50.000,00'),5000000);assert.equal(adminSaleReceived(c.sale,'PENDENTE',''),0);
 assert.throws(()=>adminSaleReceived(c.sale,'PARCIAL','102.000,01'));assert.throws(()=>adminSaleCalculation({purchase_cents:'85.00'}));
 const e=row({details:{vehicle:'Teste',purchase_cents:c.purchase,vehicle_cost_cents:c.cost,commission_cents:c.commission,sale_cents:c.sale},amount_cents:adminSaleReceived(c.sale,'PARCIAL','50.000,00')});
 assert.equal(saleProfit(e),1285000);assert.equal(adminStats([e],'2026-10').income,5000000);
});

const trade={trade_in:true,trade_vehicle:'Carro recebido',trade_plate:'XYZ9A99',trade_year:2020,trade_value_cents:5000000,trade_has_debts:true,trade_ipva_cents:100000,trade_fines_cents:50000,trade_has_payoff:true,trade_payoff_cents:350000,trade_payoff_bank:'Safra',payment_method:'FINANCIAMENTO',payment_bank:'Itaú'};
test('Trade deducts IPVA, fines and payoff once and does not change sale profit',()=>{
 const d={...base.details,...trade,sale_cents:10200000};const c=adminSaleSettlement(d.sale_cents,d);assert.deepEqual(c,{trade:5000000,debt:500000,credit:4500000,remaining:5700000});
 const input=adminInput({...base,details:d,amount_cents:c.remaining});assert.equal(input.details.payment_bank,'Itaú');assert.equal(adminStats([row({...input})],'2026-10').income,5700000);
 assert.equal(adminSaleSettlement(10200000,{...trade,trade_has_debts:false}).remaining,5200000);
 assert.equal(adminSaleSettlement(10200000,{...trade,trade_in:false}).remaining,10200000);
 assert.equal(saleProfit(row({details:d})),9370000);
});
test('Trade rejects missing data, invalid debts, excessive cash and financing without bank',()=>{
 const d={...base.details,...trade,sale_cents:10200000};
 for(const changed of [{trade_plate:'wrong'},{trade_year:1800},{trade_in:'true'},{trade_vehicle:''},{trade_value_cents:0},{trade_ipva_cents:5000001},{trade_payoff_bank:''},{payment_bank:'fake'},{payment_bank:'OUTRO',payment_bank_other:''},{trade_has_debts:true,trade_ipva_cents:0,trade_fines_cents:0,trade_has_payoff:false}])assert.throws(()=>adminInput({...base,details:{...d,...changed}}));
 assert.throws(()=>adminInput({...base,details:d,amount_cents:5700001}));assert.throws(()=>adminSaleSettlement(100000,{...trade,trade_value_cents:700000}));
});
test('Inactive trade and financing branches are removed, other banks and legacy rows remain supported',()=>{
 const d={...base.details,...trade,sale_cents:10200000};
 const no=adminInput({...base,details:{...d,trade_in:false,payment_method:'PIX'}}).details;
 assert.deepEqual(Object.keys(no).filter(k=>k.startsWith('trade_')),['trade_in']);assert.equal(no.payment_bank,undefined);
 const clear=adminInput({...base,details:{...d,trade_has_debts:false,payment_method:'CARTAO'}}).details;assert.equal(clear.trade_payoff_bank,undefined);assert.equal(clear.trade_ipva_cents,undefined);
 const other=adminInput({...base,details:{...d,payment_bank:'OUTRO',payment_bank_other:'Banco de montadora',trade_payoff_bank:'OUTRO',trade_payoff_bank_other:'Banco anterior'}}).details;assert.equal(other.payment_bank_other,'Banco de montadora');
 assert.equal(adminInput({...base,details:{...base.details,trade_vehicle:'Registro antigo',payment_method:'Transferência'}}).details.trade_vehicle,'Registro antigo');
});
