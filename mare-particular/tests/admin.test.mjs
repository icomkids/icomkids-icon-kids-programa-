import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server.mjs';
import {defaults,quote,today} from '../domain.mjs';
import {pricingRule,paymentState} from '../admin-domain.mjs';
import {report} from '../public/reports.js';

test('season, holiday, event and custom priorities; inclusive end; minimum stay across nights',()=>{
  const rules=[{id:'season',title:'Alta temporada',category:'high',start:'2030-12-01',end:'2031-01-31',weekday:60000,weekend:70000,min_nights:2,priority:10},{id:'holiday',title:'Ano novo',category:'holiday',start:'2030-12-30',end:'2031-01-02',weekday:90000,weekend:100000,min_nights:4,priority:20},{id:'event',title:'Festa local',category:'event',start:'2031-01-01',end:'2031-01-01',weekday:110000,weekend:120000,min_nights:4,priority:30},{id:'custom',title:'Data especial',category:'custom',start:'2031-01-02',end:'2031-01-02',weekday:130000,weekend:140000,min_nights:4,priority:40}];
  const q=quote({checkin:'2030-12-30',checkout:'2031-01-04',guests:2},defaults,[],rules);
  assert.deepEqual(q.items.map(x=>x.amount),[90000,90000,110000,130000,70000]);
  assert.equal(q.total,505000);assert.equal(q.minimum,4);
  assert.throws(()=>quote({checkin:'2030-12-29',checkout:'2030-12-31',guests:2},defaults,[],rules),/4/);
  assert.throws(()=>pricingRule({...rules[0],weekday:1.5},[],30));
  assert.throws(()=>pricingRule({...rules[0],end:'2030-11-30'},[],30));
  assert.throws(()=>pricingRule({...rules[0],start:'2030-02-30'},[],30));
  assert.throws(()=>pricingRule({...rules[0]},rules,30),/mesma prioridade/);
});

test('admin prices and money persist; concurrent payments cannot overpay; cancellation requires recorded refund',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ap-admin-'));let app=createApp({dataDir:dir,demo:true});let base,cookie;
  const listen=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;cookie=(await call('/api/login','POST',{},false)).cookie;};
  const call=async(path,method='GET',data,auth=true)=>{const res=await fetch(base+path,{method,headers:{...(method==='GET'?{}:{'Content-Type':'application/json'}),...(auth&&cookie?{Cookie:cookie}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};};
  await listen();
  try{
    for(const path of ['/administrador','/proprietaria','/admin.js','/rates.js','/reports.js','/admin.css'])assert.equal((await fetch(base+path)).status,200,path);
    const rule={title:'Baixa temporada',category:'low',start:'2030-06-01',end:'2030-06-30',weekday:20000,weekend:30000,min_nights:2};
    assert.equal((await call('/api/owner/pricing-rules','POST',rule,false)).status,401);
    assert.equal((await call('/api/owner/pricing-rules','POST',rule)).status,200);
    assert.equal((await call('/api/owner/pricing-rules','POST',rule)).status,409);
    let owner=(await call('/api/owner')).data;const ruleId=owner.pricingRules[0].id;
    const payload={name:'Teste Admin',email:'admin@example.test',phone:'11900000000',note:'Fictício',accepted:true,checkin:'2030-06-07',checkout:'2030-06-10',guests:3,requestKey:randomUUID()};
    const reservation=await call('/api/reservations','POST',payload,false);assert.equal(reservation.status,201);assert.equal(reservation.data.total,95000);
    owner=(await call('/api/owner')).data;const id=owner.reservations[0].id,paymentPath=`/api/owner/reservations/${id}/payments`;
    const payment={type:'payment',amount:30000,method:'pix',occurred_on:today(),reference:'Teste manual',note:'Sem dinheiro real',requestKey:randomUUID()};
    assert.equal((await call(paymentPath,'POST',payment,false)).status,401);
    assert.equal((await call(paymentPath,'POST',payment)).status,409);
    await call(`/api/owner/reservations/${id}`,'PATCH',{status:'confirmed'});
    assert.equal((await call(paymentPath,'POST',{...payment,amount:-1})).status,400);
    assert.equal((await call(paymentPath,'POST',{...payment,occurred_on:'2099-01-01'})).status,400);
    assert.equal((await call(paymentPath,'POST',payment)).status,201);
    assert.equal((await call(paymentPath,'POST',payment)).status,201,'retry is idempotent');
    assert.equal((await call(paymentPath,'POST',{...payment,amount:1})).status,409,'key cannot be reused for another amount');
    owner=(await call('/api/owner')).data;assert.equal(owner.payments.length,1);assert.equal(owner.reservations[0].payment.status,'partial');
    const concurrent=await Promise.all([call(paymentPath,'POST',{...payment,amount:65000,requestKey:randomUUID()}),call(paymentPath,'POST',{...payment,amount:65000,requestKey:randomUUID()})]);
    assert.deepEqual(concurrent.map(x=>x.status).sort(),[201,409]);
    owner=(await call('/api/owner')).data;assert.equal(owner.reservations[0].payment.status,'paid');assert.equal(owner.reservations[0].payment.balance,0);
    let s=report(owner,'all');assert.equal(s.received,95000);assert.equal(s.guests,3);assert.equal(s.paid,1);assert.equal(s.confirmed,1);
    await call('/api/owner/settings','PATCH',{...owner.config,weekday:90000});
    assert.equal((await call(`/api/owner/pricing-rules/${ruleId}`,'PATCH',{...rule,weekday:50000})).status,200);
    assert.equal((await call('/api/owner')).data.reservations[0].total,95000,'existing agreement is frozen');
    await call(`/api/owner/reservations/${id}`,'PATCH',{status:'cancelled'});
    owner=(await call('/api/owner')).data;assert.equal(owner.reservations[0].payment.status,'refund_pending');assert.equal(owner.reservations[0].payment.refundDue,95000);assert.equal(owner.busy.length,0);
    assert.equal((await call(paymentPath,'POST',{...payment,requestKey:randomUUID()})).status,409,'cancelled reservation cannot collect');
    assert.equal((await call(paymentPath,'POST',{...payment,type:'refund',amount:95001,requestKey:randomUUID()})).status,409);
    assert.equal((await call(paymentPath,'POST',{...payment,type:'refund',amount:95000,requestKey:randomUUID()})).status,201);
    owner=(await call('/api/owner')).data;s=report(owner,'all');assert.equal(s.net,0);assert.equal(s.refunded,95000);assert.equal(s.cancelled,1);assert.equal(s.confirmed,0);assert.equal(s.forecast,0);assert.equal(s.refundDue,0);assert.equal(owner.reservations[0].payment.status,'refunded');
    const pub=JSON.stringify((await call('/api/public','GET',null,false)).data);assert.equal(pub.includes('admin@example.test'),false);assert.equal(pub.includes('Teste manual'),false);assert.equal(pub.includes('request_key'),false);
    await app.close();app=createApp({dataDir:dir,demo:true});await listen();owner=(await call('/api/owner')).data;assert.equal(owner.payments.length,3);assert.equal(owner.pricingRules[0].weekday,50000);assert.equal(owner.reservations[0].payment.status,'refunded');
    assert.equal((await call(`/api/owner/pricing-rules/${ruleId}`,'DELETE',{})).status,200);
    assert.equal((await call('/api/owner')).data.pricingRules.length,0);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('reports use check-in for bookings, actual payment date for receipts, and actual occupied nights across months',()=>{
  const r={id:'r',total:30000,status:'confirmed',checkin:'2030-06-30',checkout:'2030-07-03',guests:4,nights:3};
  const payments=[{reservation_id:'r',type:'payment',amount:30000,occurred_on:'2030-05-01'}];r.payment=paymentState(r,payments);
  const data={reservations:[r],payments};
  const june=report(data,'2030-06');assert.equal(june.confirmed,1);assert.equal(june.guests,4);assert.equal(june.received,0);assert.equal(june.forecast,30000);assert.equal(june.occupied,1);
  const july=report(data,'2030-07');assert.equal(july.confirmed,0);assert.equal(july.occupied,2);
  const may=report(data,'2030-05');assert.equal(may.confirmed,0);assert.equal(may.received,30000);
});
