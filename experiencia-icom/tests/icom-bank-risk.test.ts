import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRiskProfile,customerProfileInput,riskLabel,riskProfiles} from '../lib/icom-bank/risk.ts';
import {contractInput,installmentPlan} from '../lib/icom-bank/contracts.ts';
import {customerInput} from '../lib/icom-bank/model.ts';
test('Manual profiles never invent a classification and reject unsupported values',()=>{
 for(const value of [undefined,null,''])assert.equal(parseRiskProfile(value),null);
 for(const value of riskProfiles)assert.equal(parseRiskProfile(value),value);
 for(const value of ['E','a',' A ',1,true,{},['A']])assert.throws(()=>parseRiskProfile(value));
 assert.equal(riskLabel(undefined),'Sem classificação');
 assert.equal(customerInput({name:'Teste',cpf:'52998224725',risk_profile:'B',assigned_to:'forged'}).risk_profile,'B');
 assert.equal('assigned_to' in customerInput({name:'Teste',cpf:'52998224725',assigned_to:'forged'}),false);
});
test('Profile updates require an explicit value, customer identity and version',()=>{
 const body={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',risk_profile:null,expected_updated_at:'2026-10-05T12:00:00.123456+00:00'};
 assert.equal(customerProfileInput(body).p_profile,null);
 for(const changed of [{id:'fake'},{expected_updated_at:''},{risk_profile:'Z'}])assert.throws(()=>customerProfileInput({...body,...changed}));
 assert.throws(()=>customerProfileInput({id:body.id,expected_updated_at:body.expected_updated_at}));
});
test('Each profile preserves manual rates, principal and the installment plan',()=>{
 const finance={vehicle_cents:12000000,down_payment_cents:5000000,count:60,installment_cents:210000,sale_date:'2026-10-03',first_due:'2026-11-03',period:'MENSAL',interest_bps:350,fine_bps:200,late_interest_bps:100,notes:''};
 const body={customer_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',request_id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',vehicle:{brand:'Jeep',model:'Compass',plate:'TST9Z95'},finance};
 const original=contractInput(body,'2026-10-05').finance;
 assert.equal(original.risk_profile,null);
 for(const risk_profile of riskProfiles){const result=contractInput({...body,finance:{...finance,risk_profile}},'2026-10-05').finance;assert.equal(result.risk_profile,risk_profile);assert.deepEqual({...result,risk_profile:null},original);assert.deepEqual(installmentPlan(result),installmentPlan(original));}
 assert.throws(()=>contractInput({...body,finance:{...finance,risk_profile:'Z'}},'2026-10-05'));
});
