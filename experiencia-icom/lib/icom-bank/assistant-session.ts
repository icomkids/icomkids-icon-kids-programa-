import {assistantInstructions,helpSection} from './assistant-guide.ts';
import type {BankRole} from './model.ts';

export const voiceDurationMs=5*60*1000;
export const voiceDefaultModel='gpt-realtime-2.1-mini';
export class VoiceError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export function voiceInput(body:unknown,role:BankRole){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new VoiceError('Não foi possível iniciar a conversa. Reabra a ajuda.');
 const b=body as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['sdp','section'].includes(k))||typeof b.sdp!=='string'||b.sdp.length>60000||!b.sdp.startsWith('v=0')||!/^m=audio\s/m.test(b.sdp)||/^m=(video|application)\s[^\r\n]*video/im.test(b.sdp))throw new VoiceError('Conexão de áudio inválida. Reabra a ajuda.');
 if(/^m=video\s/m.test(b.sdp))throw new VoiceError('Esta ajuda usa somente áudio.');
 return {sdp:b.sdp,section:helpSection(b.section,role)};
}
export function voiceSession(role:BankRole,section:unknown,model=voiceDefaultModel){return {
 type:'realtime',model,instructions:assistantInstructions(role,section),
 output_modalities:['audio'],max_output_tokens:800,tools:[],tool_choice:'none',
 audio:{input:{noise_reduction:{type:'near_field'},turn_detection:{type:'server_vad',threshold:0.55,prefix_padding_ms:300,silence_duration_ms:700,create_response:true,interrupt_response:true}},output:{voice:'marin'}},
};}
export function callIdFromLocation(location:string|null){const match=location?.match(/(?:^|\/)realtime\/calls\/(rtc_[a-zA-Z0-9_-]+)$/);return match?.[1]||null;}
export async function boundedVoiceBody(req:Request){
 if(Number(req.headers.get('content-length'))>65000)throw new VoiceError('Solicitação de áudio muito extensa.',413);
 const reader=req.body?.getReader();if(!reader)throw new VoiceError('Reabra a ajuda para iniciar a conversa.');
 let length=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>65000){await reader.cancel();throw new VoiceError('Solicitação de áudio muito extensa.',413);}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes)) as unknown;}catch{throw new VoiceError('Reabra a ajuda para iniciar a conversa.');}
}

// Single-instance process guard. For multiple replicas use a shared quota store.
export function createVoiceLimiter(){
 const users=new Map<string,{starts:number[];pending:boolean}>();
 return {begin(user:string,now=Date.now()){
  for(const [id,state] of users)if(!state.pending&&state.starts.every(t=>t<=now-3600000))users.delete(id);
  const state=users.get(user)||{starts:[],pending:false};state.starts=state.starts.filter(t=>t>now-3600000);
  if(state.pending)throw new VoiceError('Você já tem uma conversa em andamento. Encerre-a antes de iniciar outra.',429);
  if(state.starts.length>=8||state.starts.some(t=>t>now-15000))throw new VoiceError('Aguarde um pouco antes de iniciar outra conversa.',429);
  if(users.size>=2000&&!users.has(user))throw new VoiceError('Ajuda ocupada. Tente novamente em alguns minutos.',503);
  state.starts.push(now);state.pending=true;users.set(user,state);
 },end(user:string){const state=users.get(user);if(state)state.pending=false;}};
}
