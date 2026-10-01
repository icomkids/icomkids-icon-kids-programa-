import test from 'node:test';
import assert from 'node:assert/strict';
import {phoneBR,sellerInstance,connection,sendText} from '../lib/whatsapp.ts';
import {feedbackSummary} from '../lib/feedback.ts';
import {assertManagement,scopeRows,sellerFilter,sellerRegistration,type AccessProfile} from '../lib/access.ts';
import {analytics,alertRule,assertEditable,category,questions,relationArray,sanitizeAnswers,validToken, type Experience} from '../lib/experience.ts';
test('PostgREST one-to-one relations normalize missing, object and array values',()=>{assert.deepEqual(relationArray(null),[]);assert.deepEqual(relationArray(undefined),[]);const response={answers:{nps_score:10}};assert.deepEqual(relationArray(response),[response]);assert.deepEqual(relationArray([response]),[response])});
test('NPS classification boundaries',()=>{assert.deepEqual([0,6,7,8,9,10].map(category),['detractor','detractor','passive','passive','promoter','promoter'])});
test('NPS formula and empty dataset',()=>{const rows=[10,9,7,5].map(n=>({experience_responses:[{nps_score:n,answers:{},nps_category:category(n)}],experience_alerts:[]})) as unknown as Experience[];assert.equal(analytics(rows).nps,25);assert.equal(analytics([]).nps,null)});
test('critical alert for low score even with promoter NPS',()=>{for(const field of ['overall_rating','salesperson_rating','transparency_rating','delivery_rating','store_cleanliness_rating','vehicle_cleanliness_rating','manager_rating','owner_rating'])for(const score of [1,2])assert.equal(alertRule({nps_score:10,[field]:score}).level,'critical')});
test('cleanliness and discovery answers are validated and preserved',()=>{assert.deepEqual(sanitizeAnswers({store_cleanliness_rating:4,vehicle_cleanliness_rating:5,discovery_source:'Instagram'}),{store_cleanliness_rating:4,vehicle_cleanliness_rating:5,discovery_source:'Instagram'});assert.throws(()=>sanitizeAnswers({store_cleanliness_rating:0}));assert.throws(()=>sanitizeAnswers({vehicle_cleanliness_rating:6}));assert.throws(()=>sanitizeAnswers({discovery_source:'Unknown'}))});
test('other discovery source is conditional and leadership comment needs contact',()=>{assert.ok(questions({discovery_source:'Outro'}).some(q=>q.key==='discovery_source_other'&&!q.optional));assert.equal(sanitizeAnswers({discovery_source:'Google / pesquisa na internet',discovery_source_other:'obsolete'}).discovery_source_other,undefined);assert.ok(!questions({leadership_contact:'Não tive contato'}).some(q=>q.key==='leadership_feedback'))});
test('old responses without cleanliness ratings keep empty averages',()=>{const rows=[{experience_responses:[{nps_score:10,answers:{}}],experience_alerts:[]}] as unknown as Experience[];assert.equal(analytics(rows).mean('store_cleanliness_rating'),null);assert.equal(analytics(rows).mean('vehicle_cleanliness_rating'),null)});
test('documentation low rating alerts regardless of NPS',()=>assert.equal(alertRule({nps_score:10,documentation_experience:'Um pouco complicado'}).level,'critical'));
test('passive attention, detractor and requested contact critical',()=>{assert.equal(alertRule({nps_score:8}).level,'attention');assert.equal(alertRule({nps_score:6}).level,'critical');assert.equal(alertRule({nps_score:10,contact_requested:true}).level,'critical');assert.equal(alertRule({nps_score:10}).level,'none')});
test('secure UUID v4 token validation',()=>{assert.equal(validToken('123'),false);assert.equal(validToken('not-a-token'),false);assert.equal(validToken(crypto.randomUUID()),true)});
test('conditional leadership and NPS questions',()=>{const a=questions({nps_score:5,leadership_contact:'Sim, com ambos'}).map(q=>q.key);assert.ok(a.includes('manager_rating'));assert.ok(a.includes('owner_rating'));assert.ok(a.includes('contact_requested'));assert.ok(!questions({nps_score:10,leadership_contact:'Não tive contato'}).some(q=>q.key==='manager_rating'))});
test('final validation rejects incomplete and unknown options',()=>{assert.throws(()=>sanitizeAnswers({},true));assert.throws(()=>sanitizeAnswers({overall_rating:6}));assert.throws(()=>sanitizeAnswers({leadership_contact:'invalid'}))});
test('discard obsolete branch data',()=>{const clean=sanitizeAnswers({nps_score:10,problem_areas:['Prazo'],leadership_contact:'Não tive contato',manager_rating:2});assert.equal(clean.manager_rating,undefined);assert.equal(clean.problem_areas,undefined)});
test('completed or archived surveys cannot be answered again',()=>{assert.throws(()=>assertEditable({completed_at:new Date().toISOString(),status:'respondida'}),/já foi registrada/);assert.throws(()=>assertEditable({completed_at:null,status:'arquivada'}));assert.doesNotThrow(()=>assertEditable({completed_at:null,status:'iniciada'}))});
test('draft responses do not affect NPS',()=>{const rows=[{experience_responses:[{nps_score:null,answers:{overall_rating:5}}],experience_alerts:[]}] as unknown as Experience[];assert.equal(analytics(rows).nps,null);assert.equal(analytics(rows).count,0)});
test('grouped feedback separates clients, experiences, completed ratings and item denominators',()=>{
 const rows=[
 {customer_id:'same',created_at:'2026-10-01',completed_at:'2026-10-02',experience_responses:[{nps_score:10,answers:{salesperson_rating:5,vehicle_cleanliness_rating:4}}],experience_alerts:[]},
 {customer_id:'same',created_at:'2026-10-03',completed_at:'2026-10-04',experience_responses:[{nps_score:6,answers:{salesperson_rating:3}}],experience_alerts:[]},
 {customer_id:'other',created_at:'2026-10-05',completed_at:null,experience_responses:[{nps_score:null,answers:{salesperson_rating:1}}],experience_alerts:[]},
 ] as unknown as Experience[];
 const summary=feedbackSummary(rows),seller=summary.items.find(i=>i.key==='salesperson_rating')!,vehicle=summary.items.find(i=>i.key==='vehicle_cleanliness_rating')!;
 assert.equal(summary.customers,2);assert.equal(summary.experiences,3);assert.equal(summary.responses,2);assert.equal(summary.responseRate,67);assert.equal(seller.mean,4);assert.equal(seller.satisfaction,50);assert.equal(vehicle.mean,4);assert.equal(vehicle.count,1);assert.equal(vehicle.satisfaction,100);assert.equal(summary.stats.nps,0);assert.deepEqual(summary.months,['2026-10']);assert.equal(seller.distribution.find(d=>d.score===5)?.percent,50);
});
test('Brazilian WhatsApp phones normalize DDD 55 without confusing country code',()=>{
 assert.equal(phoneBR('(55) 99999-1234'),'5555999991234');assert.equal(phoneBR('+55 (12) 99999-1234'),'5512999991234');assert.equal(phoneBR('(11) 3333-1234'),'551133331234');
 for(const invalid of ['','999991234','5510999991234','+1 202 555 1234','(12) 89999-1234'])assert.throws(()=>phoneBR(invalid));
});
test('WhatsApp configuration never falls back to another seller and rejects non HTTPS servers',()=>{
 const raw=JSON.stringify({seller:{url:'https://test.uazapi.com',token:'secret',phone:'12999991234'}});
 assert.equal(sellerInstance('other',raw),null);assert.equal(sellerInstance('seller',raw)?.phone,'5512999991234');assert.throws(()=>sellerInstance('seller',raw.replace('https:','http:')));
});
test('WhatsApp connection checks the sender phone and hides raw provider credentials',()=>{
 const raw={instance:{owner:'5512999991234',status:'connected',token:'private'},status:{connected:true}};
 assert.equal(connection(raw,'5512999991234').connected,true);assert.equal(connection(raw,'5511988881234').connected,false);assert.ok(!JSON.stringify(connection(raw,'5512999991234')).includes('private'));
 assert.equal(connection({instance:{qrcode:'https://evil.example/qr',status:'disconnected'}},'5512999991234').qr,undefined);
});
test('WhatsApp delivery distinguishes acceptance, definitive rejection and uncertain results without retrying',async()=>{
 const config={url:'https://test.uazapi.com',token:'secret',phone:'5512999991234'};let count=0;
 const mock=(status:number,body:unknown)=>(async (_url:unknown,init:RequestInit)=>{count++;assert.deepEqual(JSON.parse(String(init.body)),{number:'5512999991234',text:'test'});return new Response(JSON.stringify(body),{status})}) as typeof fetch;
 assert.deepEqual(await sendText(config,'12999991234','test',mock(200,{messageid:'accepted-id'})),{status:'accepted',providerId:'accepted-id'});
 assert.equal((await sendText(config,'12999991234','test',mock(400,{error:'bad'}))).status,'failed');
 assert.equal((await sendText(config,'12999991234','test',mock(500,{error:'uncertain'}))).status,'unknown');
 assert.equal((await sendText(config,'12999991234','test',mock(200,{success:true}))).status,'unknown');assert.equal(count,4);
});
test('empty grouped feedback shows no fabricated zero rating or satisfaction',()=>{const summary=feedbackSummary([]);assert.equal(summary.responseRate,null);for(const item of summary.items){assert.equal(item.mean,null);assert.equal(item.satisfaction,null);assert.equal(item.count,0)}});
test('seller authorization filters at database boundary and fails closed without link',()=>{
 const seller={id:'user',name:'Seller',role:'seller',salesperson_id:'12345678-1234-4234-8234-123456789abc',leadership_access:false} as AccessProfile;
 assert.equal(sellerFilter(seller),'&salesperson_id=eq.12345678-1234-4234-8234-123456789abc');assert.throws(()=>sellerFilter({...seller,salesperson_id:null}));assert.throws(()=>assertManagement(seller));assert.equal(sellerFilter({...seller,role:'owner',salesperson_id:null}),'');assert.doesNotThrow(()=>assertManagement({...seller,role:'owner'}));
});
test('seller sees only own feedback with leadership and internal alert treatment removed',()=>{
 const seller={id:'user',name:'Seller',role:'seller',salesperson_id:'12345678-1234-4234-8234-123456789abc',leadership_access:true} as AccessProfile;
 const rows=[{id:'own-experience',salesperson_id:'12345678-1234-4234-8234-123456789abc',experience_responses:[{answers:{salesperson_rating:5,manager_rating:1,leadership_feedback:'private'}}],experience_alerts:[{alert_reason:'private',resolution_notes:'internal'}]},{id:'other-experience',salesperson_id:'other',experience_responses:[],experience_alerts:[]}] as unknown as Experience[];
 const scoped=scopeRows(seller,rows);assert.equal(scoped.length,1);assert.equal(scoped[0].id,'own-experience');assert.deepEqual(scoped[0].experience_responses[0].answers,{salesperson_rating:5});assert.deepEqual(scoped[0].experience_alerts,[]);assert.equal(rows[0].experience_responses[0].answers.manager_rating,1);
 assert.equal(scopeRows({...seller,role:'owner'},rows).length,2);assert.equal(scopeRows({...seller,role:'owner'},rows)[0].experience_responses[0].answers.manager_rating,1);
});
test('seller registration ignores forged owner, seller and dates and normalizes Brazilian plates',()=>{
 const profile={id:'authenticated-user',name:'Seller',role:'seller',salesperson_id:'12345678-1234-4234-8234-123456789abc',leadership_access:false} as AccessProfile;
 const request=crypto.randomUUID();const payload={customer_phone:'(12) 99999-1234',customer_name:' Maria ',vehicle_name:' Compass ',vehicle_plate:'abc-1234',request_id:request,p_user:'forged',salesperson_id:'other-seller',created_at:'1990-01-01',purchase_date:'1990-01-01'};
 assert.deepEqual(sellerRegistration(profile,payload),{p_user:'authenticated-user',p_customer:'Maria',p_vehicle:'Compass',p_plate:'ABC1234',p_request:request,p_phone:'5512999991234'});
 assert.equal(sellerRegistration(profile,{...payload,vehicle_plate:'abc1d23'}).p_plate,'ABC1D23');assert.throws(()=>sellerRegistration(profile,{...payload,vehicle_plate:'bad'}));assert.throws(()=>sellerRegistration(profile,{...payload,customer_name:'x'}));assert.throws(()=>sellerRegistration({...profile,role:'owner'},payload));assert.throws(()=>sellerRegistration(profile,{...payload,request_id:'bad'}));
});
