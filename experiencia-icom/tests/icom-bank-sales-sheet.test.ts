import test from 'node:test';
import assert from 'node:assert/strict';
import {adminInput,saleCost,saleProfit,type AdminEntry} from '../lib/icom-bank/administrative.ts';
import {salesRows,salesTotals} from '../lib/icom-bank/sales-sheet.ts';
const sale=(extra:Partial<AdminEntry>={}):AdminEntry=>({id:crypto.randomUUID(),kind:'VENDA',scope:'LOJA',entry_date:'2026-10-13',description:'Venda de veículo',category:'Venda de veículo',status:'REALIZADO',amount_cents:0,details:{customer_name:'João',vehicle:'Chevrolet Onix',plate:'ABC1D23',purchase_cents:8_500_000,vehicle_cost_cents:250_000,commission_cents:165_000,sale_cents:10_200_000},active:true,created_at:'2026-10-13T12:00:00Z',updated_at:'2026-10-13T12:00:00Z',...extra});
test('Sales summary reuses the established full cost and profit once per sale',()=>{
 const a=sale(),b=sale({id:crypto.randomUUID(),details:{purchase_cents:3_000_000,vehicle_cost_cents:100_000,commission_cents:165_000,sale_cents:3_100_000}}),rows=[a,b],before=structuredClone(rows),totals=salesTotals(rows,'2026-10-13');
 assert.equal(saleCost(a),8_915_000);assert.equal(saleProfit(a),1_285_000);assert.equal(totals.cost,12_180_000);assert.equal(totals.sale,13_300_000);assert.equal(totals.profit,1_120_000);assert.equal(totals.count,2);assert.deepEqual(rows,before);
});
test('Planned, canceled, future and non-sale entries cannot inflate the realized footer',()=>{
 const a=sale();assert.deepEqual(salesTotals([a,sale({status:'PREVISTO'}),sale({active:false}),sale({entry_date:'2026-10-14'}),sale({kind:'CUSTO'})],'2026-10-13'),salesTotals([a],'2026-10-13'));
 assert.equal(salesTotals([sale({details:{sale_cents:1,purchase_cents:100}})],'2026-10-13').profit,-99);
});
test('Visible filters control both the chronological journal and its totals',()=>{
 const older=sale({entry_date:'2026-09-01'}),canceled=sale({active:false});const rows=salesRows([sale(),older,canceled],'joao','2026-10');assert.equal(rows.length,1);assert.equal(salesRows([sale()],'abc1d23').length,1);assert.equal(salesRows([sale()],'onix').length,1);assert.equal(salesRows([canceled],'','',true).length,1);assert.equal(salesRows([sale(),older])[0].id,older.id);assert.equal(salesTotals(rows,'2026-10-13').count,1);
});
test('Sale metadata permits blank optional buyer fields and preserves Mercosul plates and all money',()=>{
 const a=sale(),input=adminInput({...a,expected_updated_at:null,details:{...a.details,customer_name:'',customer_cpf:'',customer_phone:'',customer_email:'',untrusted:'discard me'}});assert.equal(input.details.customer_name,'');assert.equal(input.details.plate,'ABC1D23');assert.equal(input.details.sale_cents,a.details.sale_cents);assert.equal('untrusted' in input.details,false);
 for(const value of [23,{},'x'.repeat(161)])assert.throws(()=>adminInput({...a,expected_updated_at:null,details:{...a.details,customer_name:value}}));
});
