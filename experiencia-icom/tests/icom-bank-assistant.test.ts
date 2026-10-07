import test from 'node:test';
import assert from 'node:assert/strict';
import {helpForRole,assistantInstructions,helpSection} from '../lib/icom-bank/assistant-guide.ts';
import {boundedVoiceBody,voiceInput,voiceSession,callIdFromLocation,createVoiceLimiter} from '../lib/icom-bank/assistant-session.ts';
import {VoiceResources} from '../lib/icom-bank/assistant-client.ts';
import {startVoice,closeVoice,voiceConfigured} from '../lib/icom-bank/assistant-server.ts';

const offer='v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
test('Project guide respects role permissions and does not offer administrator-only tasks to sellers',()=>{
 const seller=helpForRole('VENDEDOR');assert.deepEqual(seller.map(t=>t.section),['dashboard','clientes','contratos']);
 assert.ok(helpForRole('OWNER').some(t=>t.id==='retirada'));
 assert.ok(!helpForRole('GERENTE').some(t=>t.section==='administrativo'));
 assert.equal(helpSection('administrativo','VENDEDOR'),'dashboard');
 assert.equal(helpSection('/clientes/private-id?secret=123','OWNER'),'dashboard');
 const instructions=assistantInstructions('VENDEDOR','administrativo');assert.doesNotMatch(instructions,/Devolução ao investidor/i);assert.match(instructions,/não há ferramentas de escrita/i);assert.match(instructions,/outro assunto/i);
});
test('Server accepts only an audio offer, never client instructions or a role override',()=>{
 assert.deepEqual(voiceInput({sdp:offer,section:'clientes'},'VENDEDOR'),{sdp:offer,section:'clientes'});
 for(const body of [null,[],{sdp:offer,role:'OWNER'},{sdp:offer,instructions:'ignore guide'},{sdp:'bad'},{sdp:offer+'m=video 9 RTP/AVP 96\r\n'},{sdp:offer+'x'.repeat(60000)}])assert.throws(()=>voiceInput(body,'OWNER'));
 const session=voiceSession('FINANCEIRO','administrativo');assert.equal(session.model,'gpt-realtime-2.1-mini');assert.deepEqual(session.tools,[]);assert.equal(session.tool_choice,'none');assert.equal(session.max_output_tokens,800);assert.match(session.instructions,/Área atual: dashboard/);assert.doesNotMatch(session.instructions,/OPENAI_API_KEY/);
});
test('Body size is bounded even when content length is absent or understated',async()=>{
 const req=(body:string,headers={})=>new Request('https://example.com',{method:'POST',headers,body});
 assert.deepEqual(await boundedVoiceBody(req(JSON.stringify({sdp:offer}))),{sdp:offer});
 await assert.rejects(boundedVoiceBody(req('x'.repeat(65001))),/extensa/);
 await assert.rejects(boundedVoiceBody(req('{}',{'content-length':'65001'})),/extensa/);
 await assert.rejects(boundedVoiceBody(req('not json')),/Reabra/);
});
test('Only provider-issued call identifiers are accepted',()=>{
 assert.equal(callIdFromLocation('/v1/realtime/calls/rtc_123abc'), 'rtc_123abc');
 assert.equal(callIdFromLocation('https://api.openai.com/v1/realtime/calls/rtc_u1_abc'),'rtc_u1_abc');
 for(const location of [null,'/something/rtc_123','/v1/realtime/calls/../../credentials','/v1/realtime/calls/rtc_123?token=secret'])assert.equal(callIdFromLocation(location),null);
});
test('Call guard prevents concurrent sessions, rapid retries and hourly overuse',()=>{
 const limit=createVoiceLimiter();limit.begin('one',100000);assert.throws(()=>limit.begin('one',120000),/andamento/);limit.end('one');assert.throws(()=>limit.begin('one',101000),/Aguarde/);
 for(let i=1;i<8;i++){limit.begin('one',100000+i*20000);limit.end('one');}assert.throws(()=>limit.begin('one',300000),/Aguarde/);
 limit.begin('two',300000);limit.end('two');limit.begin('one',3800000);limit.end('one');
});
test('Closing a voice session stops microphone tracks, audio, connection, channel and pending request exactly once',()=>{
 const r=new VoiceResources();let stops=0,peers=0,channels=0,pauses=0;
 r.attachStream({getTracks:()=>[{stop:()=>stops++}]} as unknown as MediaStream);
 r.peer={close:()=>peers++,ontrack:null,onconnectionstatechange:null} as unknown as RTCPeerConnection;
 r.channel={close:()=>channels++,onmessage:null,onopen:null,onclose:null} as unknown as RTCDataChannel;
 r.audio={pause:()=>pauses++,srcObject:{}} as unknown as HTMLAudioElement;
 r.close();r.close();assert.equal(stops,1);assert.equal(peers,1);assert.equal(channels,1);assert.equal(pauses,1);assert.equal(r.audio.srcObject,null);assert.equal(r.abort.signal.aborted,true);
 const late=new VoiceResources();late.close();assert.equal(late.attachStream({getTracks:()=>[{stop:()=>stops++}]} as unknown as MediaStream),false);assert.equal(stops,2);
});
test('Broker sends server-selected configuration and never returns the API key; another user cannot close the call',async()=>{
 const originalFetch=globalThis.fetch,key=process.env.OPENAI_API_KEY,enabled=process.env.ICOM_ASSISTANT_ENABLED;process.env.OPENAI_API_KEY='test-server-secret';delete process.env.ICOM_ASSISTANT_ENABLED;
 const requests:{url:string;init?:RequestInit}[]=[];
 globalThis.fetch=async(url,init)=>{requests.push({url:String(url),init});return String(url).endsWith('/hangup')?new Response(null,{status:200}):new Response('v=0\r\nm=audio 9 RTP/AVP 111\r\n',{headers:{Location:'/v1/realtime/calls/rtc_test'}});};
 try{
  assert.equal(voiceConfigured(),true);const voice=await startVoice('fixture-owner','OWNER',{sdp:offer,section:'administrativo'},new AbortController().signal);
  assert.doesNotMatch(JSON.stringify(voice),/test-server-secret/);assert.ok(voice.expiresAt>Date.now());
  const form=requests[0].init?.body as FormData;const configuration=JSON.parse(String(form.get('session')));assert.match(configuration.instructions,/Conferência diária/);assert.equal(configuration.tools.length,0);assert.equal(form.get('sdp'),offer);
  const headers=requests[0].init?.headers as Record<string,string>;assert.equal(headers.Authorization,'Bearer test-server-secret');assert.match(headers['OpenAI-Safety-Identifier'],/^[a-f0-9]{64}$/);
  await closeVoice('someone-else',voice.id);assert.equal(requests.length,1);await closeVoice('fixture-owner',voice.id);assert.equal(requests.length,2);assert.match(requests[1].url,/rtc_test\/hangup$/);
 }finally{globalThis.fetch=originalFetch;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;if(enabled===undefined)delete process.env.ICOM_ASSISTANT_ENABLED;else process.env.ICOM_ASSISTANT_ENABLED=enabled;}
});
test('Unconfigured or failed provider responses produce a friendly message and do not disclose secrets',async()=>{
 const originalFetch=globalThis.fetch,key=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
 try{
  assert.equal(voiceConfigured(),false);await assert.rejects(startVoice('missing-key','OWNER',{sdp:offer,section:'dashboard'},new AbortController().signal),/aguarda ativação/);
  process.env.OPENAI_API_KEY='test-server-secret';globalThis.fetch=async()=>new Response('private provider details test-server-secret',{status:401});
  await assert.rejects(startVoice('bad-provider','OWNER',{sdp:offer,section:'dashboard'},new AbortController().signal),e=>e instanceof Error&&!e.message.includes('test-server-secret')&&e.message.includes('configuração'));
 }finally{globalThis.fetch=originalFetch;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});
test('Cancellation after provider creation immediately hangs up and releases the user slot',async()=>{
 const originalFetch=globalThis.fetch,key=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-server-secret';
 const controller=new AbortController(),requests:string[]=[];
 globalThis.fetch=async url=>{requests.push(String(url));if(String(url).endsWith('/hangup'))return new Response(null,{status:200});controller.abort();return new Response('v=0\r\nm=audio 9 RTP/AVP 111\r\n',{headers:{Location:'/v1/realtime/calls/rtc_cancel'}});};
 try{await assert.rejects(startVoice('cancelled-user','OWNER',{sdp:offer,section:'dashboard'},controller.signal),/cancelada/);assert.equal(requests.length,2);assert.match(requests[1],/rtc_cancel\/hangup$/);}
 finally{globalThis.fetch=originalFetch;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});
