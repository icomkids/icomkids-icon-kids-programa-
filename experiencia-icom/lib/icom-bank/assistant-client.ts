// Browser-only resource owner, kept separate to test cancellation without a microphone.
export class VoiceResources {
 cancelled=false;
 stream:MediaStream|null=null;
 peer:RTCPeerConnection|null=null;
 channel:RTCDataChannel|null=null;
 audio:HTMLAudioElement|null=null;
 abort=new AbortController();
 timer:ReturnType<typeof setTimeout>|null=null;
 handledTools=new Set<string>();
 toolQueue:Promise<void>=Promise.resolve();
 attachStream(stream:MediaStream){if(this.cancelled){stream.getTracks().forEach(t=>t.stop());return false;}this.stream=stream;return true;}
 close(){
  if(this.cancelled)return;this.cancelled=true;this.abort.abort();
  if(this.timer)clearTimeout(this.timer);
  this.stream?.getTracks().forEach(t=>t.stop());
  if(this.peer){this.peer.ontrack=null;this.peer.onconnectionstatechange=null;this.peer.close();}
  if(this.channel){this.channel.onmessage=null;this.channel.onopen=null;this.channel.onclose=null;this.channel.close();}
  if(this.audio){this.audio.pause();this.audio.srcObject=null;}
 }
}

export type VoiceToolCall={type?:string;name?:string;call_id?:string;arguments?:string};
export async function answerVoiceTools(r:VoiceResources,items:VoiceToolCall[],request:(name:string,args:unknown)=>Promise<unknown>){
 const channel=r.channel;if(!channel||r.cancelled)return;
 let count=0;
 for(const call of items){
  if(call.type!=='function_call'||!call.call_id||! /^[a-zA-Z0-9_-]{1,120}$/.test(call.call_id)||r.handledTools.has(call.call_id))continue;
  r.handledTools.add(call.call_id);let output:unknown;
  try{if(call.name!=='consultar_dados_icom'||typeof call.arguments!=='string'||call.arguments.length>4000)throw new Error('Consulta não disponível.');output=await request(call.name,JSON.parse(call.arguments));}
  catch{output={ok:false,error:'Não foi possível consultar estes dados agora. Não invente valores; informe a indisponibilidade e peça para conferir o painel.'};}
  if(r.cancelled||channel.readyState!=='open')return;
  channel.send(JSON.stringify({type:'conversation.item.create',item:{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(output)}}));count++;
 }
 if(count&&!r.cancelled&&channel.readyState==='open')channel.send(JSON.stringify({type:'response.create'}));
}
