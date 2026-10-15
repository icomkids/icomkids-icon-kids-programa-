import {conversationWhatsApp} from './conversation-worker';
import {agendaChoice,agendaStatusQuestion,agendaInlineCorrection,agendaConfirmedReply,agendaCorrectedDraft,agendaPreviewReply,type AgendaPreview} from './whatsapp-agenda-confirmation';
import {isAgendaWrite} from './agenda';
import {mayBeWhatsAppQuestion} from './whatsapp-consultations';
import {botAssistantName} from './preferences-server';
import {addressAssistant} from './preferences';
import {prepareFinancial} from './assistant-financial';
import {expenseStatusQuestion} from './expense-context';
import {sharedAssistantCache} from './assistant-cache';
import {config,db} from '../server';
import {sendText} from '../whatsapp';
import {brazilDay} from './model';
import {botConfig,botCredentials,readBotConnection,type BotConfig} from './whatsapp-bot-server';
import {transcribeExpense} from './whatsapp-ai';

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
async function reply(b:BotConfig,m:Inbox){if(!m.reply)return;const current=await botConfig();if(!current?.enabled||current.owner_id!==m.owner_id||!current.allowed_phones.includes(m.sender))return;const acquired=await botDb<boolean>('rpc/icom_bank_whatsapp_reply_claim',{p_id:m.id});if(!acquired)return;const name=await botAssistantName(b.owner_id),started=performance.now();const r=await sendText(botCredentials(b),m.sender,'IA Bank · '+name+':\n'+m.reply.replace(/^IA Bank · /,''));console.info('ia_bank_whatsapp_stage',JSON.stringify({stage:'reply',ms:Math.round(performance.now()-started),status:r.status}));await db('icom_bank_whatsapp_inbox?id=eq.'+m.id,'PATCH',{reply_status:r.status==='accepted'?'ACEITO':r.status==='failed'?'FALHOU':'INCERTO',updated_at:new Date().toISOString()});}
export async function processExpenses(){
 const b=await botConfig();if(!b?.enabled||b.status!=='PRONTO')return;
 const [owner]=await botDb<{role:string;active:boolean}[]>('icom_bank_user_access?user_id=eq.'+b.owner_id+'&select=role,active');if(!owner?.active||owner.role!=='OWNER')return;
 if(!(await readBotConnection(b)).connected)return;
 const waiting=await botDb<Inbox[]>('icom_bank_whatsapp_inbox?reply_status=eq.NAO_ENVIADO&status=in.(LANCADO,ESCLARECER,ERRO,RESOLVIDO)&reply=neq.&order=created_at&limit=3');
 for(const m of waiting)if(m.owner_id===b.owner_id&&b.allowed_phones.includes(m.sender))await reply(b,m);
 for(let n=0;n<3;n++){
  const m=await botDb<Inbox|null>('rpc/icom_bank_whatsapp_claim',{});if(!m)return;
  let transcript=m.transcript||m.text;
  try{
   const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('A leitura dos áudios ainda precisa ser ativada pela gestão.');
   if(m.type==='audio'&&!transcript){const audioStart=performance.now(),audio=await downloadExpenseAudio(b,m.provider_id);console.info('ia_bank_whatsapp_stage',JSON.stringify({stage:'download',ms:Math.round(performance.now()-audioStart)}));const transcribeStart=performance.now();transcript=await transcribeExpense(audio.bytes,audio.mime,key);console.info('ia_bank_whatsapp_stage',JSON.stringify({stage:'transcription',ms:Math.round(performance.now()-transcribeStart)}));}
   await patch(m,{transcript});
   const since=new Date(Date.parse(m.created_at)-900000).toISOString();
   const addressed=addressAssistant(transcript,await botAssistantName(m.owner_id));
   const pending=await botDb<AgendaPreview|null>('rpc/icom_bank_whatsapp_agenda_draft',{p_id:m.id,p_claim:m.claim_id}),choice=agendaChoice(addressed),inlineCorrection=agendaInlineCorrection(addressed);
   if(pending&&(expenseStatusQuestion(transcript)||agendaStatusQuestion(transcript))){
    if(pending){const message='Agenda: ainda não foi salvo. '+(pending.status==='EDITANDO'?'Envie a correção para receber um novo resumo.':'Confira o resumo anterior e responda 1 para confirmar ou 2 para editar.');await patch(m,{status:'RESOLVIDO',reply:message});m.reply=message;await reply(b,m);continue;}
    const recent=await botDb<Inbox[]>('icom_bank_whatsapp_inbox?sender=eq.'+m.sender+'&owner_id=eq.'+m.owner_id+'&status=in.(LANCADO,ESCLARECER,ERRO,PROCESSANDO,FILA,RESOLVIDO)&created_at=gt.'+encodeURIComponent(since)+'&created_at=lt.'+encodeURIComponent(m.created_at)+'&order=created_at.desc&limit=2');
    const original=recent[0],message=original?.status==='RESOLVIDO'&&original.reply.startsWith('Agenda: confirmado e salvo.')?'Sim, o agendamento foi confirmado e salvo.\n'+original.reply:original?.status==='LANCADO'?'Sim, a despesa anterior foi lançada.\n'+original.reply:original?'A despesa anterior ainda não foi lançada. Confira o motivo no histórico do painel. Esta pergunta não cria uma segunda despesa.':'Não localizei uma despesa recente desta conversa para confirmar. Confira o histórico no painel; esta pergunta não cria um lançamento.';
    await patch(m,{status:'RESOLVIDO',reply:message});m.reply=message;await reply(b,m);continue;
   }

   if(pending&&choice==='CONFIRMAR'){
    const message=pending.status==='EDITANDO'?'Agenda: você escolheu editar. Escreva a correção para eu mostrar um novo resumo antes de confirmar.':agendaConfirmedReply(pending);
    await patch(m,{reply:message,transcript:addressed});
    if(pending.status==='EDITANDO')await patch(m,{status:'RESOLVIDO'});
    else{await botDb('rpc/icom_bank_whatsapp_agenda_confirm',{p_id:m.id,p_claim:m.claim_id,p_draft:pending.id,p_version:pending.version});sharedAssistantCache().clear();}
    m.reply=message;await reply(b,m);continue;
   }
   if(pending&&(choice==='CANCELAR'||choice==='EDITAR'&&!inlineCorrection)){
    const message=choice==='CANCELAR'?'Agenda: rascunho cancelado. Nada foi agendado.':'Agenda: escreva o que deseja alterar, por exemplo “mude para dia 20”, “às 20 horas” ou o novo local. Depois vou mostrar o resumo corrigido para você confirmar.';
    await patch(m,{reply:message});await botDb('rpc/icom_bank_whatsapp_agenda_edit',{p_id:m.id,p_claim:m.claim_id,p_draft:pending.id,p_version:pending.version,p_cancel:choice==='CANCELAR'});m.reply=message;await reply(b,m);continue;
   }
   const editRequested=pending&&!isAgendaWrite(addressed)&&!mayBeWhatsAppQuestion(addressed)&&!/\b(?:paguei|gastei|comprei)\b/i.test(addressed)&&(pending.status==='EDITANDO'||inlineCorrection||/^(?:mude|muda|altere|troque|troca|corrija|corrige|na verdade)\b/i.test(addressed));
   if(editRequested&&pending){
    try{
     const correction=inlineCorrection||addressed,today=brazilDay(new Date(m.created_at)),changed=await agendaCorrectedDraft(pending,correction,today,key),prepared=await prepareFinancial(changed.draft,changed.source,today,async()=>{throw Error('Agenda não movimenta dinheiro.');},m.id),payload=prepared.args.p_payload as Record<string,unknown>;
     if(prepared.operation==='AGENDA')payload.origin='WHATSAPP';payload.notes=changed.notes;if(changed.observation)prepared.summary.push({label:'Observação',value:changed.observation});
     const message=agendaPreviewReply(prepared);await patch(m,{reply:message,transcript:changed.source});await botDb('rpc/icom_bank_whatsapp_agenda_prepare',{p_id:m.id,p_claim:m.claim_id,p_operation:prepared.operation,p_args:prepared.args,p_summary:prepared.summary,p_source:changed.source});m.reply=message;await reply(b,m);
    }catch(e){const [current]=await botDb<{status:string}[]>('icom_bank_whatsapp_inbox?id=eq.'+m.id+'&select=status');if(current?.status==='RESOLVIDO')continue;const message='Agenda: '+(e instanceof Error?e.message:'Diga o que deseja corrigir.').slice(0,400)+'\nNada foi salvo. Envie novamente a correção.';await patch(m,{status:'RESOLVIDO',reply:message});m.reply=message;await reply(b,m);}continue;
   }
   if(pending&&isAgendaWrite(addressed))await botDb('rpc/icom_bank_whatsapp_agenda_edit',{p_id:m.id,p_claim:m.claim_id,p_draft:pending.id,p_version:pending.version,p_cancel:true,p_finish_message:false});

   const handled=await conversationWhatsApp(m,addressed,brazilDay(new Date(m.created_at)),key,botDb);
   if(handled.committed){const [saved]=await botDb<Inbox[]>('icom_bank_whatsapp_inbox?id=eq.'+m.id+'&select=*');if(saved)await reply(b,saved);continue;}
   await patch(m,{status:handled.status,reply:handled.reply});m.reply=handled.reply||'';await reply(b,m);
  }catch(e){
   const msg=e instanceof Error?e.message:'Não consegui interpretar. Envie novamente a despesa e o valor.';
   // Never overwrite an atomic commit when only its HTTP acknowledgement or WhatsApp delivery failed.
   const [current]=await botDb<{status:string}[]>('icom_bank_whatsapp_inbox?id=eq.'+m.id+'&select=status');
   if(current?.status==='LANCADO'||current?.status==='RESOLVIDO')continue;
   const message=msg.slice(0,600)+(mayBeWhatsAppQuestion(transcript)?'\nNenhum lançamento foi criado. Informe o painel, o filtro e o período para consultar novamente.':'\nNada foi lançado. Responda com os dados que faltam ou envie uma nova despesa completa.');
   await patch(m,{status:msg.includes('Não foi possível concluir')?'ERRO':'ESCLARECER',transcript,reply:message});m.reply=message;await reply(b,m);
  }
 }
}
