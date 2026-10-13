import test from 'node:test';
import assert from 'node:assert/strict';
import {prolaboreScheduleInput,prolaboreReceiveInput,prolaboreEditInput,prolaboreSummary,prolaboreDate,type ProlaboreRecord} from '../lib/icom-bank/prolabore.ts';
import {accountSummary,existingAccount,type BankAccount} from '../lib/icom-bank/accounts.ts';
import {monthlyDueDates} from '../lib/icom-bank/payables.ts';
const id='00000000-0000-4000-8000-000000000001',pj='00000000-0000-4000-8000-000000000002',pf='00000000-0000-4000-8000-000000000003',today='2026-10-13';
const input={id,reference_month:'2026-10',first_due:'2026-10-13',months:12,first_received:false,paid_at:null,amount_cents:3000000,source_account_id:pj,target_account_id:pf,notes:''};
const account:BankAccount={id:pf,owner_id:id,name:'santander pessoal',bank:'Santander',scope:'PESSOAL',active:true,created_at:today,updated_at:today};
test('Duplicate personal account is selected rather than duplicated; conflicting PJ name gives a specific error',()=>{
 const b={name:' Santander pessoal ',bank:'santander',scope:'PESSOAL',active:true,initial_cents:0,expected_updated_at:null};assert.equal(existingAccount([account],b)?.id,pf);assert.throws(()=>existingAccount([account],{...b,scope:'LOJA'}),/pessoal \(PF\)/);assert.throws(()=>existingAccount([account],{...b,initial_cents:3000000}));assert.throws(()=>existingAccount([{...account,active:false}],b));assert.equal(existingAccount([account],{...b,name:'Santander loja',scope:'LOJA'}),null);
});
test('10 and 12 month schedules preserve the monthly due day and do not claim receipt',()=>{
 for(const months of [1,10,12,60]){const p=prolaboreScheduleInput({...input,months},today);assert.equal(p.months,months);assert.equal(p.paid_at,null);assert.equal(monthlyDueDates(p.first_due,p.months).length,months);}
 assert.deepEqual(monthlyDueDates('2028-01-31',3),['2028-01-31','2028-02-29','2028-03-31']);assert.equal(prolaboreScheduleInput({...input,first_due:'2027-01-10',reference_month:'2027-01'},today).first_received,false);
});
test('Schedules reject zero, invalid dates, duplicate accounts and unbounded durations',()=>{
 for(const change of [{months:0},{months:61},{months:2.5},{amount_cents:0},{amount_cents:30.1},{first_due:'2026-02-30'},{first_due:'2100-12-31',months:2},{source_account_id:pf},{reference_month:'2026-13'}])assert.throws(()=>prolaboreScheduleInput({...input,...change},today));
});
test('Only the first receipt can be declared at registration and it requires a genuine past or current date',()=>{
 assert.equal(prolaboreScheduleInput({...input,first_received:true,paid_at:today},today).paid_at,today);assert.throws(()=>prolaboreScheduleInput({...input,first_received:true},today));assert.throws(()=>prolaboreScheduleInput({...input,first_received:true,paid_at:'2026-10-14'},today));
});
test('Planned monthly amounts never create PF cash; confirming one month applies its amount once',()=>{
 const rows:ProlaboreRecord[]=monthlyDueDates(input.first_due,12).map((date,i)=>({id:String(i),owner_id:id,status:'PREVISTO',due_date:date,paid_at:null,reference_month:date.slice(0,7),series_id:id,sequence_number:i+1,months_count:12,amount_cents:3000000,source_account_id:pj,target_account_id:pf,notes:'',created_at:today,updated_at:today}));
 const data={accounts:[{...account,id:pj,scope:'LOJA' as const,name:'Santander loja'},account],links:[],entries:[],prolabore:rows};assert.equal(accountSummary(data,today).personal,0);assert.equal(prolaboreSummary(rows,'2026-10',today).planned,3000000);assert.equal(prolaboreSummary(rows,'',today).planned,36000000);
 const confirmed=[{...rows[0],status:'REALIZADO' as const,paid_at:today},...rows.slice(1)],s=accountSummary({...data,prolabore:confirmed},today);assert.equal(s.personal,3000000);assert.equal(s.company,-3000000);assert.equal(s.gross,0);assert.equal(s.available,0);assert.equal(prolaboreSummary(confirmed,'',today).received,3000000);assert.equal(prolaboreSummary(confirmed,'',today).planned,33000000);
});
test('Receipts require explicit confirmation; editing requires a version and valid PJ/PF template',()=>{
 const b={id,expected_updated_at:today+'T12:00:00Z',paid_at:today,confirmed:true};assert.equal(prolaboreReceiveInput(b,today).p_id,id);assert.throws(()=>prolaboreReceiveInput({...b,confirmed:false},today));assert.throws(()=>prolaboreReceiveInput({...b,paid_at:'2026-10-14'},today));assert.throws(()=>prolaboreEditInput({...input,expected_updated_at:'bad'}));assert.equal(prolaboreEditInput({...input,expected_updated_at:b.expected_updated_at,amount_cents:3500000}).p_payload.amount_cents,3500000);
});
test('A canceled receipt remains in the month when it actually arrived while leaving balances',()=>{
 const row:ProlaboreRecord={id,owner_id:id,reference_month:'2026-09',due_date:'2026-09-10',paid_at:today,amount_cents:3000000,source_account_id:pj,target_account_id:pf,notes:'',status:'CANCELADO',created_at:today,updated_at:today};assert.equal(prolaboreDate(row),today);assert.equal(prolaboreSummary([row],'2026-10',today).received,0);assert.equal(prolaboreDate({...row,paid_at:null}),'2026-09-10');
});
