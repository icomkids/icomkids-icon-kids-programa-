import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server.mjs';
import {quote,defaults,daysBetween,settings} from '../domain.mjs';

test('date boundaries, nightly prices and guest limits',()=>{
  assert.throws(()=>daysBetween('2030-02-30','2030-03-04'));
  assert.throws(()=>daysBetween('2030-06-05','2030-06-05'));
  const q=quote({checkin:'2030-06-07',checkout:'2030-06-10',guests:4},defaults);
  assert.equal(q.nights,3);assert.equal(q.subtotal,130000);assert.equal(q.total,145000);
  assert.throws(()=>quote({checkin:'2030-06-07',checkout:'2030-06-10',guests:5},defaults));
  assert.throws(()=>quote({checkin:'2030-06-07',checkout:'2030-06-10',guests:2},defaults,['2030-06-08']));
  assert.doesNotThrow(()=>quote({checkin:'2030-06-07',checkout:'2030-06-10',guests:2},defaults,['2030-06-10']));
  assert.throws(()=>settings({...defaults,minNights:5,maxNights:2},defaults));
});
test('concurrent reservation, owner authorization, cancellation, blocking, expiry and persistence',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'mare-test-'));let app=createApp({dataDir:dir,demo:true});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let base=`http://127.0.0.1:${app.server.address().port}`;
  const call=async(path,method='GET',data,cookie)=>{const res=await fetch(base+path,{method,headers:{...(method==='GET'?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};};
  try{
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await fetch(base+'/app.js')).status,200);
    assert.equal((await fetch(base+'/proprietaria')).status,200);
    assert.equal((await call('/api/owner')).status,401);
    const login=await call('/api/login','POST',{}),cookie=login.cookie;
    const payload={name:'Hóspede Teste',email:'hospede@example.test',phone:'11900000000',note:'teste',accepted:true,checkin:'2030-06-07',checkout:'2030-06-10',guests:2,requestKey:randomUUID()};
    const results=await Promise.all([call('/api/reservations','POST',payload),call('/api/reservations','POST',{...payload,requestKey:randomUUID()})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    const first=results[0].status===201?results[0]:results[1];assert.equal(first.data.total,145000);
    if(results[0].status===201){const repeat=await call('/api/reservations','POST',payload);assert.equal(repeat.data.code,first.data.code);}
    const publicData=await call('/api/public');assert.equal(JSON.stringify(publicData.data).includes('hospede@example.test'),false);
    let owner=(await call('/api/owner','GET',null,cookie)).data;const id=owner.reservations[0].id;
    assert.equal(owner.reservations.length,1);assert.equal(owner.busy.length,3);
    assert.equal((await call(`/api/owner/reservations/${id}`,'PATCH',{status:'confirmed'})).status,401);
    assert.equal((await call(`/api/owner/reservations/${id}`,'PATCH',{status:'confirmed'},cookie)).status,200);
    assert.equal((await call('/api/owner/settings','PATCH',{...defaults,weekday:50000},cookie)).status,200);
    owner=(await call('/api/owner','GET',null,cookie)).data;assert.equal(owner.reservations[0].total,145000);
    assert.equal((await call('/api/owner/blocks','POST',{start:'2030-06-08',end:'2030-06-11',reason:'Manutenção'},cookie)).status,409);
    assert.equal((await call(`/api/owner/reservations/${id}`,'PATCH',{status:'cancelled'},cookie)).status,200);
    assert.equal((await call('/api/public')).data.busy.length,0);
    assert.equal((await call('/api/owner/blocks','POST',{start:'2030-06-08',end:'2030-06-11',reason:'Manutenção'},cookie)).status,201);
    owner=(await call('/api/owner','GET',null,cookie)).data;
    assert.equal((await call(`/api/owner/blocks/${owner.blocks[0].id}`,'DELETE',{},cookie)).status,200);
    const pending=await call('/api/reservations','POST',{...payload,requestKey:randomUUID()});assert.equal(pending.status,201);
    app.db.prepare("UPDATE reservations SET expires_at='2000-01-01T00:00:00.000Z' WHERE status='pending'").run();
    assert.equal((await call('/api/public')).data.busy.length,0);
    owner=(await call('/api/owner','GET',null,cookie)).data;assert.equal(owner.reservations.filter(x=>x.status==='expired').length,1);
    await app.close();app=createApp({dataDir:dir,demo:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;
    const nextLogin=await call('/api/login','POST',{});assert.equal((await call('/api/owner','GET',null,nextLogin.cookie)).data.reservations.length,2);
    assert.equal((await fetch(base+'/api/owner/settings',{method:'PATCH',headers:{'Content-Type':'application/json',Origin:'https://other.example',Cookie:nextLogin.cookie},body:JSON.stringify(defaults)})).status,403);
    assert.equal((await fetch(base+'/server.mjs')).status,404);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('live mode requires password; demo access is disabled',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'mare-auth-')),app=createApp({dataDir:dir,demo:false,password:'local-test-password'});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
  try{for(const [password,status]of [['',401],['incorrect',401],['local-test-password',200]]){const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(r.status,status);}assert.equal((await(await fetch(base+'/api/public')).json()).demo,false);}finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
