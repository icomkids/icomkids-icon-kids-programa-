import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moneyInput,contractInput,installmentPlan,realDate,type FinanceInput} from '../lib/icom-bank/contracts.ts';
const finance:FinanceInput={vehicle_cents:1000000,down_payment_cents:100000,count:3,installment_cents:300000,first_due:'2028-01-31',sale_date:'2026-10-03',period:'MENSAL',interest_bps:0,fine_bps:0,late_interest_bps:0,notes:''};
test('Bank cents are exact and formatted amounts cannot silently change scale',()=>{assert.equal(moneyInput('1250,50'),125050);assert.equal(moneyInput('0,01'),1);for(const s of ['1.250,50','12.50','1e5','-2','NaN','1,001'])assert.throws(()=>moneyInput(s));});
test('Bank monthly dates preserve original anchor across leap February',()=>{assert.deepEqual(installmentPlan(finance).map(i=>i.due_date),['2028-01-31','2028-02-29','2028-03-31']);assert.deepEqual(installmentPlan({...finance,first_due:'2027-01-31'}).map(i=>i.due_date),['2027-01-31','2027-02-28','2027-03-31']);assert.equal(installmentPlan({...finance,period:'QUINZENAL',first_due:'2026-12-25'})[1].due_date,'2027-01-09');assert.equal(installmentPlan({...finance,period:'SEMANAL',first_due:'2026-12-25'})[1].due_date,'2027-01-01');});
test('Bank contract rejects invalid dates, fractions, forged ownership and uncovered principal',()=>{const body={customer_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',request_id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',vehicle:{brand:'Ford',model:'Ka',plate:'ABC-1234'},finance};const valid=contractInput({...body,seller_id:'forged'},'2026-10-03');assert.equal(valid.vehicle.plate,'ABC1234');assert.equal('seller_id' in valid,false);assert.equal(realDate('2027-02-29'),false);for(const changed of [{count:1.5},{count:121},{down_payment_cents:1000000},{installment_cents:1},{sale_date:'2026-10-04'},{first_due:'2026-10-02'},{period:'DIARIA'}])assert.throws(()=>contractInput({...body,finance:{...finance,...changed}},'2026-10-03'));});

test('Optional vehicle details do not block a sale or weaken financial validation',()=>{
 const body={customer_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',request_id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',vehicle:{},finance};
 const parsed=contractInput(body,'2026-10-03');
 assert.equal(parsed.vehicle.plate,'');assert.equal(parsed.vehicle.brand,'');assert.equal(parsed.vehicle.chassis,'');assert.equal(parsed.vehicle.renavam,'');assert.equal(parsed.vehicle.model_year,null);
 assert.equal(parsed.finance.vehicle_cents-parsed.finance.down_payment_cents,900000);
 for(const plate of ['ABC1234','TTQ9F92'])assert.equal(contractInput({...body,vehicle:{plate}},'2026-10-03').vehicle.plate,plate);
 for(const vehicle of [{plate:'INVALIDA'},{chassis:'abc'},{renavam:'123'},{brand:'F'}])assert.throws(()=>contractInput({...body,vehicle},'2026-10-03'));
 for(const changed of [{installment_cents:1},{count:0},{down_payment_cents:1000000},{sale_date:'2026-10-04'}])assert.throws(()=>contractInput({...body,finance:{...finance,...changed}},'2026-10-03'));
});
