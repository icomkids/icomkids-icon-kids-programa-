import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server.mjs';
const token='test-webhook-secret-with-at-least-32-characters';
const config={enabled:true,mode:'sandbox',apiKey:'test-key-for-local-fake-provider',webhookToken:token,publicUrl:'https://ap.example.test/'};
function fakeProvider(){const checkouts=[],payments=new Map();let fail=false;
  const fetchImpl=async(url,init)=>{
    assert.match(url,/^https:\/\/api-sandbox\.asaas\.com\/v3\//);assert.equal(init.headers.access_token,config.apiKey);
    if(fail)throw Error('temporary network outage');
    const u=new URL(url);
    if(init.method==='POST'){const payload=JSON.parse(init.body);const id='chk_'+randomUUID();checkouts.push({id,payload});return Response.json({id});}
    if(u.pathname==='/v3/payments')return Response.json({data:[...payments.values()].filter(x=>x.checkoutSession===u.searchParams.get('checkoutSession')),hasMore:false});
    const p=payments.get(u.pathname.split('/').at(-1));return p?Response.json(p):Response.json({}, {status:404});
  };
  return {fetchImpl,checkouts,payments,setFail:v=>{fail=v;}};
}
async function harness(){const dir=mkdtempSync(join(tmpdir(),'ap-payments-')),fake=fakeProvider();let app=createApp({dataDir:dir,demo:true,password:'test-owner-password',payments:config,paymentFetch:fake.fetchImpl}),base,cookie;
  const call=async(path,method='GET',data,headers={})=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  async function listen(){await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;cookie=(await call('/api/login','POST',{username:'proprietaria',password:'test-owner-password'})).cookie;}
  await listen();
  const reserve=async(checkin='2030-06-07',checkout='2030-06-10')=>{const r=await call('/api/reservations','POST',{name:'Teste Pagamento',email:'payment@example.test',phone:'11900000000',accepted:true,checkin,checkout,guests:2,requestKey:randomUUID()});assert.equal(r.status,201);return r.data;};
  const notify=async(data,secret=token)=>call('/api/payments/asaas/webhook','POST',data,{'asaas-access-token':secret});
  return {get app(){return app;},fake,call,reserve,notify,restart:async()=>{await app.close();app=createApp({dataDir:dir,demo:true,payments:config,paymentFetch:fake.fetchImpl});await listen();},close:async()=>{await app.close();rmSync(dir,{recursive:true,force:true});}};
}

test('Pix checkout, server amount, capability access, authenticated event, automatic confirmation, duplicates and refund',async()=>{
  const h=await harness();try{
    const r=await h.reserve();assert.equal(r.paymentsEnabled,true);assert.ok(r.guestToken);
    assert.equal((await h.call('/api/checkout','POST',{token:'invalid'})).status,401);
    assert.equal((await h.call('/api/booking','POST',{token:r.guestToken.replace(/.$/,'!')})).status,401);
    const first=await h.call('/api/checkout','POST',{token:r.guestToken,amount:1});assert.equal(first.status,200);assert.match(first.data.url,/^https:\/\/sandbox\.asaas\.com\//);
    assert.equal((await h.call('/api/checkout','POST',{token:r.guestToken})).data.url,first.data.url);assert.equal(h.fake.checkouts.length,1);
    const checkout=h.fake.checkouts[0];assert.equal(checkout.payload.items[0].value,r.total/100);assert.deepEqual(checkout.payload.billingTypes,['PIX','CREDIT_CARD']);assert.equal(checkout.payload.minutesToExpire,30);assert.equal(checkout.payload.customerData,undefined);
    const owner=(await h.call('/api/owner')).data,id=owner.reservations[0].id;
    assert.equal((await h.call(`/api/owner/reservations/${id}/payments`,'POST',{type:'payment',amount:1,method:'pix',occurred_on:'2026-11-24',requestKey:randomUUID()})).status,409);
    const payment={id:'pay_'+randomUUID(),checkoutSession:checkout.id,externalReference:checkout.payload.externalReference,status:'RECEIVED',billingType:'PIX',value:r.total/100,paymentDate:'2026-11-24'};h.fake.payments.set(payment.id,payment);
    const event={id:'evt_'+randomUUID(),event:'PAYMENT_RECEIVED',payment:{id:payment.id}};
    assert.equal((await h.notify(event,'invalid')).status,401);assert.equal((await h.call('/api/owner')).data.payments.length,0);
    assert.equal((await h.notify(event)).status,200);await h.app.payments.drain();
    let status=(await h.call('/api/booking','POST',{token:r.guestToken})).data;assert.equal(status.status,'confirmed');assert.equal(status.paymentStatus,'paid');assert.equal(status.paid,r.total);
    assert.equal((await h.notify(event)).status,200);await h.notify({...event,id:'evt_'+randomUUID()});await h.app.payments.drain();
    let next=(await h.call('/api/owner')).data;assert.equal(next.payments.length,1);assert.equal(next.payments[0].source,'asaas');assert.equal(next.reservations[0].payment.net,r.total);
    payment.status='REFUNDED';payment.refunds=[{status:'DONE',value:r.total/100,dateCreated:'2026-11-24 18:00:00'}];await h.notify({id:'evt_'+randomUUID(),event:'PAYMENT_REFUNDED',payment:{id:payment.id}});await h.app.payments.drain();
    next=(await h.call('/api/owner')).data;assert.equal(next.payments.length,2);assert.equal(next.reservations[0].payment.net,0);assert.equal(next.paymentReviews.length,1);
    await h.notify({...event,id:'evt_'+randomUUID()});await h.app.payments.drain();assert.equal((await h.call('/api/owner')).data.payments.length,2,'out of order event re-reads actual refunded status');
    const pub=JSON.stringify((await h.call('/api/public')).data);assert.equal(pub.includes(payment.id),false);assert.equal(pub.includes('payment@example.test'),false);assert.equal(pub.includes(token),false);
    await h.restart();status=(await h.call('/api/booking','POST',{token:r.guestToken})).data;assert.equal(status.paid,0);assert.equal(status.review,true);
  }finally{await h.close();}
});

test('card confirms a pending reservation without any browser success callback',async()=>{
  const h=await harness();try{
    const r=await h.reserve();await h.call('/api/checkout','POST',{token:r.guestToken});const checkout=h.fake.checkouts[0];
    const payment={id:'pay_'+randomUUID(),checkoutSession:checkout.id,externalReference:checkout.payload.externalReference,status:'CONFIRMED',billingType:'CREDIT_CARD',value:r.total/100,confirmedDate:'2026-11-24'};h.fake.payments.set(payment.id,payment);
    await h.notify({id:'evt_'+randomUUID(),event:'PAYMENT_CONFIRMED',payment:{id:payment.id}});await h.app.payments.drain();
    const status=(await h.call('/api/booking','POST',{token:r.guestToken})).data;assert.equal(status.status,'confirmed');assert.equal(status.paymentStatus,'paid');assert.equal(status.paid,r.total);
  }finally{await h.close();}
});

test('late card payment cannot occupy dates of another reservation',async()=>{
  const h=await harness();try{
    const first=await h.reserve();await h.call('/api/checkout','POST',{token:first.guestToken});const checkout=h.fake.checkouts[0];
    const id=first.guestToken.split('.')[0];h.app.db.prepare("UPDATE reservations SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(id);await h.call('/api/public');
    const other=await h.reserve();const payment={id:'pay_'+randomUUID(),checkoutSession:checkout.id,externalReference:checkout.payload.externalReference,status:'CONFIRMED',billingType:'CREDIT_CARD',value:first.total/100,confirmedDate:'2026-11-24'};h.fake.payments.set(payment.id,payment);
    await h.notify({id:'evt_'+randomUUID(),event:'CHECKOUT_PAID',checkout:{id:checkout.id}});await h.app.payments.drain();
    const status=(await h.call('/api/booking','POST',{token:first.guestToken})).data;assert.equal(status.status,'expired');assert.equal(status.paid,first.total);assert.equal(status.review,true);
    assert.equal((await h.call('/api/booking','POST',{token:other.guestToken})).data.status,'pending');
    const occupied=h.app.db.prepare('SELECT reservation_id FROM occupancy').all();assert.ok(occupied.every(x=>x.reservation_id===other.guestToken.split('.')[0]));
  }finally{await h.close();}
});

test('value mismatch is queued for retry, transient provider failures persist, and disabled checkout never creates a charge',async()=>{
  const h=await harness();try{
    const r=await h.reserve();await h.call('/api/checkout','POST',{token:r.guestToken});const checkout=h.fake.checkouts[0];
    const payment={id:'pay_'+randomUUID(),checkoutSession:checkout.id,externalReference:checkout.payload.externalReference,status:'RECEIVED',billingType:'PIX',value:1};h.fake.payments.set(payment.id,payment);
    const event={id:'evt_'+randomUUID(),event:'PAYMENT_RECEIVED',payment:{id:payment.id}};await h.notify(event);await h.app.payments.drain();
    assert.equal((await h.call('/api/owner')).data.payments.length,0);assert.equal(h.app.db.prepare('SELECT status FROM payment_webhooks WHERE id=?').get(event.id).status,'pending');
    payment.value=r.total/100;h.fake.setFail(true);h.app.db.prepare('UPDATE payment_webhooks SET next_at=0').run();await h.app.payments.drain();assert.equal((await h.call('/api/owner')).data.payments.length,0);
    h.fake.setFail(false);await h.restart();h.app.db.prepare('UPDATE payment_webhooks SET next_at=0').run();await h.app.payments.drain();assert.equal((await h.call('/api/booking','POST',{token:r.guestToken})).data.paymentStatus,'paid');
  }finally{await h.close();}
  const dir=mkdtempSync(join(tmpdir(),'ap-disabled-')),app=createApp({dataDir:dir,demo:true,password:'test-owner-password'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
  try{assert.equal((await(await fetch(base+'/api/public')).json()).paymentsEnabled,false);assert.equal(app.payments.metadata().configured,false);}finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
