import {createHash,randomUUID} from 'node:crypto';
import {callIdFromLocation,createVoiceLimiter,VoiceError,voiceDurationMs,voiceSession} from './assistant-session.ts';
import type {BankRole} from './model.ts';

const limiter=createVoiceLimiter();
const calls=new Map<string,{user:string;callId:string;expiresAt:number;reads:number;timer:ReturnType<typeof setTimeout>}>();
export function claimVoiceRead(user:string,id:string){
 const call=calls.get(id);
 if(!call||call.user!==user||call.expiresAt<=Date.now())throw new VoiceError('Inicie uma nova conversa para consultar os dados.',403);
 if(call.reads>=40)throw new VoiceError('Limite de consultas desta conversa atingido. Inicie outra conversa.',429);
 call.reads++;
}
export function voiceConfigured(){return !!process.env.OPENAI_API_KEY?.trim()&&process.env.ICOM_ASSISTANT_ENABLED!=='false';}
async function hangup(callId:string){
 try{await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`,{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(10000)});}catch{/* Browser also closes the peer connection. Never log upstream errors or audio. */}
}
export async function closeVoice(user:string,id:string){
 const call=calls.get(id);if(!call||call.user!==user)return;
 calls.delete(id);clearTimeout(call.timer);limiter.end(user);await hangup(call.callId);
}
export async function startVoice(user:string,role:BankRole,input:{sdp:string;section:string},signal:AbortSignal){
 if(!voiceConfigured())throw new VoiceError('A voz ainda aguarda ativação pelo administrador. As orientações rápidas estão disponíveis abaixo.',503);
 limiter.begin(user);
 let callId:string|null=null;
 try{
  const form=new FormData();form.set('sdp',input.sdp);form.set('session',JSON.stringify(voiceSession(role,input.section,process.env.OPENAI_REALTIME_MODEL?.trim()||undefined)));
  const response=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',body:form,headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY!.trim()}`,'OpenAI-Safety-Identifier':createHash('sha256').update(`icom-bank:${user}`).digest('hex')},signal:AbortSignal.any([signal,AbortSignal.timeout(30000)]),cache:'no-store'});
  if(!response.ok){await response.body?.cancel();throw new VoiceError(response.status===429?'O serviço de voz está ocupado ou sem cota. Peça ao administrador para conferir a API.':'Não foi possível conectar a voz. Peça ao administrador para conferir a configuração da API.',502);}
  callId=callIdFromLocation(response.headers.get('Location'));const sdp=await response.text();
  if(!callId||!sdp.startsWith('v=0')||sdp.length>60000)throw new VoiceError('O serviço não confirmou a conexão. Tente novamente.',502);
  if(signal.aborted)throw new VoiceError('A conversa foi cancelada.');
  const id=randomUUID(),expiresAt=Date.now()+voiceDurationMs;
  const timer=setTimeout(()=>void closeVoice(user,id),voiceDurationMs);timer.unref();
  calls.set(id,{user,callId,expiresAt,reads:0,timer});return {id,sdp,expiresAt};
 }catch(error){limiter.end(user);if(callId)await hangup(callId);if(error instanceof VoiceError)throw error;throw new VoiceError('Não foi possível conectar a voz. Tente novamente em alguns instantes.',502);}
}
