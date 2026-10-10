import {botAssistantName} from './preferences-server';
import {addressAssistant} from './preferences';
import {resolveAccount,type BankAccount} from './accounts';
import {extractFinancial,prepareFinancial,refuseVoiceWithdrawal} from './assistant-financial';
import {expenseStatusQuestion,audienceLabel,natureLabel} from './expense-context';
import {sharedAssistantCache} from './assistant-cache';
import {config,db} from '../server';
import {sendText} from '../whatsapp';
import {brazilDay} from './model';
import {botConfig,botCredentials,readBotConnection,type BotConfig} from './whatsapp-bot-server';
import {extractExpense,transcribeExpense} from './whatsapp-ai';
import {expensePayload,expenseReply} from './whatsapp-expenses';
import type {AdminEntry} from './administrative';
import {currency} from './model';
import {assistantReadInput} from './assistant-data';
import {personalCategory,personalSummary,tripName,expenseFold} from './personal-expenses';

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
async function reply(b:BotConfig,m:Inbox){if(!m.reply)return;const acquired=await botDb<boolean>('rpc/icom_bank_whatsapp_reply_claim',{p_id:m.id});if(!acquired)return;const name=await botAssistantName(b.owner_id);const r=await sendText(botCredentials(b),m.sender,name+': '+m.reply);await db('icom_bank_whatsapp_inbox?id=eq.'+m.id,'PATCH',{reply_status:r.status==='accepted'?'ACEITO':r.status==='failed'?'FALHOU':'INCERTO',updated_at:new Date().toISOString()});}
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
   if(m.type==='audio'&&!transcript){const audio=await downloadExpenseAudio(b,m.provider_id);transcript=await transcribeExpense(audio.bytes,audio.mime,key);}
   await patch(m,{transcript});
   const since=new Date(Date.parse(m.created_at)-900000).toISOString();
   if(expenseStatusQuestion(transcript)){
    const recent=await botDb<Inbox[]>('icom_bank_whatsapp_inbox?sender=eq.'+m.sender+'&owner_id=eq.'+m.owner_id+'&status=in.(LANCADO,ESCLARECER,ERRO,PROCESSANDO,FILA)&created_at=gt.'+encodeURIComponent(since)+'&created_at=lt.'+encodeURIComponent(m.created_at)+'&order=created_at.desc&limit=2');
    const original=recent[0],message=original?.status==='LANCADO'?'Sim, a despesa anterior foi lançada.\n'+original.reply:original?'A despesa anterior ainda não foi lançada. Confira o motivo no histórico do painel. Esta pergunta não cria uma segunda despesa.':'Não localizei uma despesa recente desta conversa para confirmar. Confira o histórico no painel; esta pergunta não cria um lançamento.';
    await patch(m,{status:'RESOLVIDO',reply:message});m.reply=message;await reply(b,m);continue;
   }
   const [previous]=await botDb<Inbox[]>('icom_bank_whatsapp_inbox?sender=eq.'+m.sender+'&owner_id=eq.'+m.owner_id+'&status=eq.ESCLARECER&created_at=gt.'+encodeURIComponent(since)+'&created_at=lt.'+encodeURIComponent(m.created_at)+'&order=created_at.desc&limit=1');
   const today=brazilDay(new Date(m.created_at));
   transcript=addressAssistant(transcript,await botAssistantName(m.owner_id));
   const financialSource=previous?.transcript?previous.transcript+'\n'+transcript:transcript;
   if(/\b(?:paguei|pagamos|pago|baixar|baixa)\b/i.test(financialSource)&&/\b(?:conta|parcela|vencimento|im[oó]vel|aluguel)\b/i.test(financialSource)){
    refuseVoiceWithdrawal(financialSource);const extracted=await extractFinancial(financialSource,today,key);
    if(extracted.operation==='PAGAR_CONTA'){const prepared=await prepareFinancial(extracted,financialSource,today,async path=>{if(!/^(icom_bank_accounts|icom_bank_payables|icom_bank_receipts|icom_bank_admin_entries)\?/.test(path))throw new Error('Operação indisponível no WhatsApp.');const own=path.startsWith('icom_bank_accounts?')?'&owner_id=eq.'+m.owner_id:'';const all:Record<string,unknown>[]=[];for(let offset=0;offset<20000;offset+=500){const rows=await botDb<Record<string,unknown>[]>(path+own+'&order=id.asc&limit=500&offset='+offset);all.push(...rows);if(rows.length<500)return all;}throw new Error('Use o painel para esta consulta.');},m.id);const message='Pagamento registrado. '+prepared.summary.map(x=>x.label+': '+x.value).join(' · ');await patch(m,{reply:message});await botDb('rpc/icom_bank_whatsapp_account_commit',{p_id:m.id,p_claim:m.claim_id,p_operation:'PAGAR_CONTA',p_args:prepared.args,p_account:prepared.account_id||null});sharedAssistantCache().clear();m.reply=message;await reply(b,m);continue;}
   }
   const draft=await extractExpense(transcript,today,key,previous?.transcript||'');
   const source=draft.uses_previous&&previous?.transcript?previous.transcript+'\n'+transcript:transcript;
   if(draft.intent==='CONSULTA'){
    if(draft.scope!=='PESSOAL'||draft.confidence!=='ALTA')throw new Error('Pergunte uma despesa pessoal por categoria ou pelo nome da viagem.');
    const category=draft.category?personalCategory(draft.category):'',trip=tripName(draft.trip_name);
    if(trip&&(!draft.trip_excerpt||!expenseFold(transcript).includes(expenseFold(draft.trip_excerpt))||!expenseFold(draft.trip_excerpt).includes(expenseFold(trip))))throw new Error('Informe o nome da viagem que deseja consultar.');
    const input=assistantReadInput({topic:'despesas_pessoais',period:draft.query_period||'total',...(category?{category}:{}),...(trip?{trip}:{}),...(draft.query_audience?{audience:draft.query_audience}:{}),...(draft.query_nature?{nature:draft.query_nature}:{})},'OWNER',today);
    const entries:AdminEntry[]=[];
    for(let offset=0;;offset+=500){if(offset>=20000)throw new Error('Consulta muito extensa. Escolha um mês para consultar no painel.');const batch=await botDb<AdminEntry[]>('icom_bank_admin_entries?active=eq.true&scope=eq.PESSOAL&status=eq.REALIZADO&entry_date=gte.'+input.from+'&entry_date=lte.'+input.to+'&select=id,scope,status,active,amount_cents,category,description,entry_date,details&order=id.asc&limit=500&offset='+offset);entries.push(...batch);if(batch.length<500)break;}
    const summary=personalSummary(entries,category,trip,input.from,input.to,input.audience,input.nature),period=input.period==='total'?'todo o histórico':`${input.from.split('-').reverse().join('/')} a ${input.to.split('-').reverse().join('/')}`;
    const message=`Você gastou ${currency(summary.amount_cents)} em ${category||'despesas pessoais'}${trip?' na viagem '+trip:''}${input.audience?' · '+audienceLabel(input.audience):''}${input.nature?' · '+natureLabel(input.nature):''}.\nPeríodo: ${period} · ${summary.count} pagamento(s).${summary.missing?' Total parcial: há registros sem valor.':''}\nSó entram pagamentos realizados e ativos.${input.nature?' O total segue as classificações registradas ou as regras exibidas no painel; gastos sem classificação ficam separados.':''} Nenhum lançamento foi criado por esta consulta.`;
    await patch(m,{status:'RESOLVIDO',reply:message});m.reply=message;await reply(b,m);continue;
   }
   const account=resolveAccount(await botDb<BankAccount[]>('icom_bank_accounts?select=*&owner_id=eq.'+m.owner_id),draft.account_name,source);
   const p=expensePayload(draft,source,m.id,[],today),message=expenseReply(p)+(account?'\nConta: '+account.name:'');
   await patch(m,{reply:message});const {expected_updated_at:_,...payload}=p;void _;
   await botDb('rpc/icom_bank_whatsapp_account_commit',{p_id:m.id,p_claim:m.claim_id,p_operation:'LANCAMENTO',p_args:{p_payload:payload,p_expected:null},p_account:account?.id||null});
   sharedAssistantCache().clear();m.reply=message;await reply(b,m);
  }catch(e){
   const msg=e instanceof Error?e.message:'Não consegui interpretar. Envie novamente a despesa e o valor.';
   // Never overwrite an atomic commit when only its HTTP acknowledgement or WhatsApp delivery failed.
   const [current]=await botDb<{status:string}[]>('icom_bank_whatsapp_inbox?id=eq.'+m.id+'&select=status');
   if(current?.status==='LANCADO')continue;
   const message=msg.slice(0,600)+'\nNada foi lançado. Responda com os dados que faltam ou envie uma nova despesa completa.';
   await patch(m,{status:msg.includes('Não foi possível concluir')?'ERRO':'ESCLARECER',transcript,reply:message});m.reply=message;await reply(b,m);
  }
 }
}
