import test from 'node:test';
import assert from 'node:assert/strict';
import {prolaboreInput,prolaboreSummary,type ProlaboreRecord} from '../lib/icom-bank/prolabore.ts';
import {accountSummary,resolveAccount,type BankAccount,type AccountLink} from '../lib/icom-bank/accounts.ts';
import {financialOverview} from '../lib/icom-bank/financial-overview.ts';
import {deletionTarget} from '../lib/icom-bank/deletion.ts';
import {readManual} from '../lib/icom-bank/assistant-manual.ts';
import type {CashEntry} from '../lib/icom-bank/cash.ts';
const day='2026-10-13',pj='00000000-0000-4000-8000-000000000001',pf='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003';
const a=(account:string,scope:BankAccount['scope']):BankAccount=>({id:account,owner_id:id,name:scope==='LOJA'?'Santander loja':'Itaú pessoal',bank:scope==='LOJA'?'Santander':'Itaú',scope,active:true,created_at:day,updated_at:day});
const transfer:ProlaboreRecord={id,owner_id:id,source_account_id:pj,target_account_id:pf,amount_cents:3000000,reference_month:'2026-10',paid_at:day,notes:'',status:'REALIZADO',created_at:day,updated_at:day};
const entry=(entryId:string,kind:CashEntry['kind'],value:number):CashEntry=>({id:entryId,kind,scope:kind==='PESSOAL'?'PESSOAL':'LOJA',entry_date:day,description:'Registro',category:'Registro',status:'REALIZADO',active:true,amount_cents:value,details:{},created_at:day,updated_at:day});
const link=(entryId:string,account:string):AccountLink=>({ledger_entry_id:entryId,account_id:account,owner_id:id,purpose:'MOVIMENTO',wealth_id:null,created_at:day});
test('Pró-labore transfers 30000 from PJ to PF without changing consolidated cash or profit',()=>{
 const e=entry(id,'ENTRADA',10000000),data={accounts:[a(pj,'LOJA'),a(pf,'PESSOAL')],entries:[e],links:[link(id,pj)],prolabore:[transfer]},s=accountSummary(data,day),before=accountSummary({...data,prolabore:[]},day);
 assert.equal(s.company,7000000);assert.equal(s.personal,3000000);assert.equal(s.gross,before.gross);assert.equal(s.available,before.available);assert.equal(s.rows.reduce((n,r)=>n+r.balance,0)+s.unassigned,s.gross);
 const result=financialOverview(data.entries,[],'2026-10',day);assert.equal(result.earnings,10000000);assert.equal(result.costs,0);assert.equal(result.personal,0);assert.equal(result.total,10000000);assert.equal(prolaboreSummary([transfer],'2026-10',day).received,3000000);
});
test('A personal bill debits PF or PJ explicitly, reducing total cash only once',()=>{
 const opening=entry(id,'ENTRADA',10000000),bill=entry(pf,'PESSOAL',50000),data={accounts:[a(pj,'LOJA'),a(pf,'PESSOAL')],entries:[opening,bill],links:[link(id,pj),link(pf,pf)],prolabore:[transfer]};
 const personal=accountSummary(data,day),company=accountSummary({...data,links:[link(id,pj),link(pf,pj)]},day);
 assert.equal(personal.personal,2950000);assert.equal(personal.company,7000000);assert.equal(company.personal,3000000);assert.equal(company.company,6950000);assert.equal(personal.gross,9950000);assert.equal(company.gross,9950000);assert.equal(financialOverview(data.entries,[],'2026-10',day).personal,50000);
});
test('Canceled and future transfers leave balances intact; monthly totals use receipt date',()=>{
 const data={accounts:[a(pj,'LOJA'),a(pf,'PESSOAL')],entries:[],links:[],prolabore:[{...transfer,status:'CANCELADO' as const},{...transfer,id:pf,paid_at:'2026-11-01'}]};const s=accountSummary(data,day);assert.equal(s.personal,0);assert.equal(s.company,0);assert.equal(prolaboreSummary(data.prolabore,'2026-10',day).received,0);assert.equal(prolaboreSummary([{...transfer,reference_month:'2026-09'}],'2026-10',day).received,3000000);
});
test('Pró-labore rejects unconfirmed amounts, identical accounts, invalid dates and floats',()=>{
 const input={...transfer,confirmed:true};assert.equal(prolaboreInput(input,day).amount_cents,3000000);
 for(const p of [{confirmed:false},{amount_cents:0},{amount_cents:-1},{amount_cents:2.5},{source_account_id:pf},{paid_at:'2026-10-14'},{paid_at:'2026-02-30'},{reference_month:'2026-13'},{target_account_id:'bad'}])assert.throws(()=>prolaboreInput({...input,...p},day));
});
test('PF and PJ voice aliases select only an unambiguous account in the explicitly requested area',()=>{
 const accounts=[a(pj,'LOJA'),a(pf,'PESSOAL')];assert.equal(resolveAccount(accounts,undefined,'paguei da minha conta física')?.id,pf);assert.equal(resolveAccount(accounts,'da minha conta física','paguei da minha conta física')?.id,pf);assert.equal(resolveAccount(accounts,'pela minha conta jurídica','paguei pela minha conta jurídica')?.id,pj);assert.equal(resolveAccount(accounts,'PJ','paguei da PJ')?.id,pj);assert.equal(resolveAccount(accounts,'Itaú','paguei pelo Itaú da conta física')?.id,pf);
 assert.throws(()=>resolveAccount([...accounts,{...a(id,'PESSOAL'),name:'Inter pessoal',bank:'Inter'}],undefined,'paguei da minha conta física'));
 assert.throws(()=>resolveAccount(accounts,undefined,'paguei escola da minha filha'));assert.throws(()=>resolveAccount(accounts,'Caixa','paguei pelo Caixa da minha conta física'));assert.throws(()=>resolveAccount(accounts,'Santander','paguei Santander da minha conta física'));assert.throws(()=>resolveAccount(accounts,undefined,'paguei pela conta física ou pela conta jurídica'));
});
test('Cancellation uses the existing deletion password and manual instructions match the new screen',()=>{
 assert.deepEqual(deletionTarget('/api/prolabore',{id,action:'cancel'}),{operation:'cancel_prolabore',id});assert.equal(deletionTarget('/api/prolabore',{id}),null);
 const m=readManual({topic:'prolabore'},'prolabore_form','OWNER');assert.equal(m.available,true);assert.ok(m.steps.some(s=>s.text.includes('Conta pessoal (PF)')));assert.equal(readManual({topic:'prolabore'},'dashboard','VENDEDOR').available,false);
});
