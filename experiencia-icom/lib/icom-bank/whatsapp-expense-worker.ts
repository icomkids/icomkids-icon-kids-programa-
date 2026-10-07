import {config,db} from '../server';
import {sendText} from '../whatsapp';
import {brazilDay} from './model';
import {botConfig,botCredentials,readBotConnection,type BotConfig} from './whatsapp-bot-server';
import {extractExpense,transcribeExpense} from './whatsapp-ai';
import {expensePayload,expenseReply} from './whatsapp-expenses';
import type {StockRow} from './stock';

type Inbox={id:string;owner_id:string;provider_id:string;sender:string;type:'audio'|'text';text:string;transcript:string;claim_id:string;status:string;reply:string;created_at:string};
export async function botDb<T>(path:string,body?:unknown):Promise<T>{const {url,key}=config();const r=await fetch(url+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Não foi possível concluir o lançamento. Confira o histórico no painel antes de reenviar.');const text=await r.text();return (text?JSON.parse(text):undefined) as T;}
async function boundedJson(r:Response,max:number){if(Number(r.headers.get('content-length'))>max)throw new Error('Áudio acima do limite. Envie um áudio curto.');const reader=r.body?.getReader();if(!reader)throw new Error('Áudio indisponível.');let size=0;const chunks:Uint8Array[]=[];try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>max)throw new Error('Áudio acima do limite. Envie um áudio curto.');chunks.push(next.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes)) as Record<string,unknown>;}
export async function downloadExpenseAudio(b:BotConfig,id:string){
 const c=botCredentials(b),r=await fetch(c.url+'/message/download',{method:'POST',headers:{token:c.token,'Content-Type':'application/json'},body:JSON.stringify({id,return_base64:true,generate_mp3:false,transcribe:false,download_quoted:false}),redirect:'error',signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw new Error('Não consegui baixar o áudio. Envie a despesa por texto.');
 const raw=await boundedJson(r,7500000);const mime=String(raw.mimetype||'').split(';')[0],encoded=raw.base64Data;
 if(!['audio/ogg','audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/webm'].includes(mime)||typeof encoded!=='string'||encoded.length>7000000||! /^[A-Za-z0-9+/=\r\n]+$/.test(encoded))throw new Error('Áudio inválido ou maior que 5 MB. Envie um áudio curto ou texto.');
 const bytes=Buffer.from(encoded,'base64');if(bytes.length<32||bytes.length>5000000)throw new Error('Áudio inválido ou maior que 5 MB. Envie por texto.');return {bytes,mime};
}
async function patch(m:Inbox,payload:Record<string,unknown>){await db('icom_bank_whatsapp_inbox?id=eq.'+m.id+'&claim_id=eq.'+m.claim_id,'PATCH',{...payload,updated_at:new Date().toISOString()});}
async function reply(b:BotConfig,m:Inbox){if(!m.reply)return;const acquired=await botDb<boolean>('rpc/icom_bank_whatsapp_reply_claim',{p_id:m.id});if(!acquired)return;const r=await sendText(botCredentials(b),m.sender,m.reply);await db('icom_bank_whatsapp_inbox?id=eq.'+m.id,'PATCH',{reply_status:r.status==='accepted'?'ACEITO':r.status==='failed'?'FALHOU':'INCERTO',updated_at:new Date().toISOString()});}
export async function processExpenses(){
 const b=await botConfig();if(!b?.enabled||b.status!=='PRONTO')return;
 const [owner]=await botDb<{role:string;active:boolean}[]>('icom_bank_user_access?user_id=eq.'+b.owner_id+'&select=role,active');if(!owner?.active||owner.role!=='OWNER')return;
 if(!(await readBotConnection(b)).connected)return;
 const waiting=await botDb<Inbox[]>('icom_bank_whatsapp_inbox?reply_status=eq.NAO_ENVIADO&status=in.(LANCADO,ESCLARECER,ERRO)&reply=neq.&order=created_at&limit=3');
 for(const m of waiting)if(m.owner_id===b.owner_id&&b.allowed_phones.includes(m.sender))await reply(b,m);
 for(let n=0;n<3;n++){
  const m=await botDb<Inbox|null>('rpc/icom_bank_whatsapp_claim',{});if(!m)return;
  let transcript=m.transcript||m.text;
  try{
   const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('A leitura dos áudios ainda precisa ser ativada pela gestão.');
   if(m.type==='audio'&&!transcript){const audio=await downloadExpenseAudio(b,m.provider_id);transcript=await transcribeExpense(audio.bytes,audio.mime,key);}
   await patch(m,{transcript});
   const since=new Date(Date.parse(m.created_at)-900000).toISOString();
   const [previous]=await botDb<Inbox[]>('icom_bank_whatsapp_inbox?sender=eq.'+m.sender+'&owner_id=eq.'+m.owner_id+'&status=eq.ESCLARECER&created_at=gt.'+encodeURIComponent(since)+'&created_at=lt.'+encodeURIComponent(m.created_at)+'&order=created_at.desc&limit=1');
   const draft=await extractExpense(transcript,brazilDay(),key,previous?.transcript||'');
   const stocks=draft.plate?await botDb<StockRow[]>('icom_bank_stock_vehicles?active=eq.true&plate=eq.'+encodeURIComponent(draft.plate.replace(/[^a-z0-9]/gi,'').toUpperCase())+'&select=id,plate,vehicle,entry_date,status,active&limit=2'):[];
   const p=expensePayload(draft,(previous?.transcript||'')+'\n'+transcript,m.id,stocks),message=expenseReply(p);
   await patch(m,{reply:message});const {expected_updated_at:_,...payload}=p;void _;
   await botDb('rpc/icom_bank_whatsapp_commit',{p_id:m.id,p_claim:m.claim_id,p_payload:payload});
   m.reply=message;await reply(b,m);
  }catch(e){
   const msg=e instanceof Error?e.message:'Não consegui interpretar. Envie novamente a despesa e o valor.';
   // Never overwrite an atomic commit when only its HTTP acknowledgement or WhatsApp delivery failed.
   const [current]=await botDb<{status:string}[]>('icom_bank_whatsapp_inbox?id=eq.'+m.id+'&select=status');
   if(current?.status==='LANCADO')continue;
   const message='ICOM Bank: '+msg.slice(0,600)+'\nNada foi lançado. Responda com os dados que faltam ou envie uma nova despesa completa.';
   await patch(m,{status:msg.includes('Não foi possível concluir')?'ERRO':'ESCLARECER',transcript,reply:message});m.reply=message;await reply(b,m);
  }
 }
}
