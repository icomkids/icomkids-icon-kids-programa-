import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

test('demo requires credentials; one-time setup, required password change, session persistence and revocation',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ap-auth-'));let app=createApp({dataDir:dir,demo:true}),base;
  async function listen(){await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;}
  const call=async(path,method='GET',data,cookie,extra={})=>{const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},...(data?{body:JSON.stringify(data)}:{})});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0],setCookie:res.headers.get('set-cookie')};};
  await listen();
  try{
    assert.equal((await call('/api/login','POST',{})).status,503);
    assert.equal((await call('/api/owner','GET',null,'mp_session=old-demo-session')).status,401);
    const input={username:'proprietaria',password:'temporary-owner-password'};
    assert.equal((await call('/api/auth/setup','POST',input,null,{Authorization:'Bearer invalid-token'})).status,401);
    const created=await call('/api/auth/setup','POST',input,null,{Authorization:'Bearer '+app.bootstrapToken});assert.equal(created.status,201);
    assert.equal((await call('/api/auth/setup','POST',input,null,{Authorization:'Bearer '+app.bootstrapToken})).status,409);
    assert.equal((await call('/api/login','POST',{...input,username:'another-owner'})).status,401);
    const login=await call('/api/login','POST',input);assert.equal(login.status,200);assert.equal(login.data.mustChange,true);assert.match(login.setCookie,/HttpOnly/);assert.match(login.setCookie,/SameSite=Strict/);
    const gated=await call('/api/owner','GET',null,login.cookie);assert.equal(gated.status,403);assert.equal(gated.data.code,'PASSWORD_CHANGE_REQUIRED');
    const changed=await call('/api/auth/password','POST',{currentPassword:input.password,newPassword:'personal-owner-password'},login.cookie);assert.equal(changed.status,200);
    assert.equal((await call('/api/owner','GET',null,login.cookie)).status,401);
    assert.equal((await call('/api/owner','GET',null,changed.cookie)).status,200);
    assert.equal((await call('/api/login','POST',input)).status,401);
    const raw=JSON.stringify(app.db.prepare('SELECT * FROM owner_account').all());assert.equal(raw.includes(input.password),false);assert.equal(raw.includes('personal-owner-password'),false);
    await app.close();app=createApp({dataDir:dir,demo:true});await listen();assert.equal(app.bootstrapToken,null);
    assert.equal((await call('/api/owner','GET',null,changed.cookie)).status,200,'sessions survive restart');
    await call('/api/logout','POST',{},changed.cookie);assert.equal((await call('/api/owner','GET',null,changed.cookie)).status,401);
    const next=await call('/api/login','POST',{username:'proprietaria',password:'personal-owner-password'});assert.equal(next.status,200);assert.equal(next.data.mustChange,false);
    for(let i=0;i<12;i++)await call('/api/login','POST',{username:'proprietaria',password:'invalid'});
    assert.equal((await call('/api/login','POST',{username:'proprietaria',password:'invalid'})).status,429);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
