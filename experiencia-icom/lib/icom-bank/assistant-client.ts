// Browser-only resource owner, kept separate to test cancellation without a microphone.
export class VoiceResources {
 cancelled=false;
 stream:MediaStream|null=null;
 peer:RTCPeerConnection|null=null;
 channel:RTCDataChannel|null=null;
 audio:HTMLAudioElement|null=null;
 abort=new AbortController();
 timer:ReturnType<typeof setTimeout>|null=null;
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
