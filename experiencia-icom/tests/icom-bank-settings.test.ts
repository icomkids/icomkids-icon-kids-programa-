import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pixSettingsInput} from '../lib/icom-bank/settings.ts';
const base={expected_updated_at:'2026-10-03T20:00:00Z',pix_type:'EMAIL',pix_key:' teste@example.invalid ',account_holder:' Teste ',agency:'1801',account_number:'98030-9'};
test('Receiving settings preserve exact key and optional bank details',()=>{const input=pixSettingsInput(base);assert.equal(input.pix_key,'teste@example.invalid');assert.equal(input.account_holder,'Teste');assert.equal(input.agency,'1801');assert.equal(input.account_number,'98030-9');assert.equal(pixSettingsInput({...base,pix_key:''}).pix_type,null);assert.equal(pixSettingsInput({...base,remove:true}).pix_key,null);});
test('Receiving settings reject invalid type, stale page identity and oversized or control text',()=>{for(const changed of [{pix_type:'BANCO'},{expected_updated_at:''},{pix_key:'a b'},{pix_key:'x'.repeat(121)},{agency:'1\n2'},{account_holder:'x'.repeat(161)}])assert.throws(()=>pixSettingsInput({...base,...changed}));});
