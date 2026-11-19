import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SupabaseStore} from '../supabase-store.mjs';
import {createApp} from '../server.mjs';

test('Supabase runtime enforces the Icom project and never falls back on outages',async()=>{
  assert.throws(()=>new SupabaseStore({url:'https://other.supabase.co',key:'test-key'}));
  const dir=mkdtempSync(join(tmpdir(),'mare-supabase-test-'));
  const app=createApp({dataDir:dir,demo:true,supabase:{url:'https://swsfwthjxtqtkloexyjs.supabase.co',key:'test-key',fetchImpl:async()=>{throw Error('network unavailable');}}});
  await assert.rejects(app.ready,error=>error.status===503);
  assert.equal(app.db,null);assert.equal(existsSync(join(dir,'mare.sqlite')),false);
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  try{assert.equal((await fetch(`http://127.0.0.1:${app.server.address().port}/api/health`)).status,503);}finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('database errors preserve reservation conflicts and reject unusable responses',async()=>{
  for(const [response,status]of [[{code:'23505'},409],[{code:'P0001',message:'Essas datas já estão ocupadas.'},409],[{code:'P0001',message:'Reserva não encontrada.'},404],[{code:'42501',message:'internal secret detail'},503]]){
    const store=new SupabaseStore({url:'https://swsfwthjxtqtkloexyjs.supabase.co',key:'test-key',fetchImpl:async()=>({ok:false,json:async()=>response})});
    await assert.rejects(store.create({},true),e=>e.status===status&&!e.message.includes('secret detail'));
  }
  const store=new SupabaseStore({url:'https://swsfwthjxtqtkloexyjs.supabase.co',key:'sb_secret_fake_test_only',fetchImpl:async(_url,options)=>{assert.equal(options.headers.Authorization,undefined);return{ok:true,json:async()=>({ok:true})};}});
  assert.deepEqual(await store.health(),{ok:true});
});
