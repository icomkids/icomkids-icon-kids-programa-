import test from 'node:test';
import assert from 'node:assert/strict';
import {deletionTarget,deletionPassword} from '../lib/icom-bank/deletion.ts';
const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('Destructive financial actions request a scoped password approval',()=>{
 for(const [path,body,operation] of [
 ['administrative',{active:false},'archive_admin'],['personal-wealth',{active:false},'archive_wealth'],['accounts',{active:false,expected_updated_at:'2026-10-09'},'archive_account'],['payables',{action:'archive',active:false},'archive_expense'],['payables',{action:'reverse'},'reverse_payable'],['receivables',{action:'archive',active:false},'archive_receivable'],['receivables',{action:'reverse'},'reverse_receipt'],['payments/reverse',{},'reverse_payment'],['contracts',{action:'cancel'},'cancel_contract']
 ] as const)assert.deepEqual(deletionTarget('/experiencia-icom/icom-bank/api/'+path,{...body,id}),{operation,id});
});
test('Editing, restoration and session exit do not delete a record',()=>{
 for(const [path,body] of [['administrative',{active:true}],['accounts',{active:true}],['contracts',{action:'edit'}],['payables',{action:'pay'}],['payables',{action:'archive',active:true}],['receivables',{action:'receive'}],['receivables',{action:'archive',active:true}],['session',{}],['assistant',{}]] as const)assert.equal(deletionTarget('/api/'+path,{...body,id}),null);
});
test('Cancellation rejects an invalid target and preserves password characters',()=>{
 assert.throws(()=>deletionTarget('/api/contracts',{action:'cancel',id:'not-an-id'}));
 assert.throws(()=>deletionPassword('short'));assert.throws(()=>deletionPassword('a'.repeat(65)));assert.throws(()=>deletionPassword(null));assert.equal(deletionPassword(' special ! '),' special ! ');
});
