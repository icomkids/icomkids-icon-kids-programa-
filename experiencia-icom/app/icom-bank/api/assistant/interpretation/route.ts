import {bankAuthorize,bankOrigin,bankAll,bankQuery,bankCashEntries,bankError,BankError} from '@/lib/icom-bank/server';
import {boundedVoiceBody} from '@/lib/icom-bank/assistant-session';
import {interpretConversation} from '@/lib/icom-bank/conversation-interpreter';
import {prepareConversation} from '@/lib/icom-bank/conversation-execution';
import {validMemory} from '@/lib/icom-bank/conversation-context';
import {extractWhatsAppConsultation,mayBeWhatsAppQuestion,whatsappManualReply,whatsappReadReply} from '@/lib/icom-bank/whatsapp-consultations';
import {readAssistantData,type AssistantReader} from '@/lib/icom-bank/assistant-data';
import {extractExpense} from '@/lib/icom-bank/whatsapp-ai';
import {expensePayload} from '@/lib/icom-bank/whatsapp-expenses';
import {brazilDay} from '@/lib/icom-bank/model';
import {randomUUID} from 'node:crypto';
export const runtime='nodejs';export const dynamic='force-dynamic';
const limits=new Map<string,number[]>();
export async function POST(req:Request){try{
 bankOrigin(req);const {token,profile}=await bankAuthorize('administrativo');if(profile.role!=='OWNER')throw new BankError('Acesso restrito ao proprietário.',403);
 const now=Date.now(),times=(limits.get(profile.user_id)||[]).filter(t=>now-t<60000);if(times.length>=12)throw new BankError('Aguarde um minuto antes de novos testes.',429);limits.set(profile.user_id,[...times,now]);
 const b=await boundedVoiceBody(req,20000) as Record<string,unknown>;if(!b||typeof b.text!=='string'||!b.text.trim()||b.text.length>4000||Object.keys(b).some(k=>!['text','memory','compare'].includes(k))||b.compare!==undefined&&typeof b.compare!=='boolean')throw new BankError('Informe o pedido para simular.',400);
 const key=process.env.OPENAI_API_KEY?.trim();if(!key)throw new BankError('IA indisponível.',503);const today=brazilDay(),[settings]=await bankQuery<{company_name:string}[]>(token,'icom_bank_system_settings?select=company_name&limit=1');
 const companies=[{id:'local',name:settings?.company_name||'Empresa cadastrada',aliases:['ICOM','ICOM Motors','loja','empresa']}],memory=validMemory(b.memory);
 const memo=new Map<string,Promise<unknown[]>>(),rows=(p:string)=>{let r=memo.get(p);if(!r){r=bankAll(token,p);memo.set(p,r);}return r;};const reader:AssistantReader={rows,ledger:()=>bankCashEntries(token),staff:()=>bankQuery(token,'rpc/icom_bank_list_staff','POST',{})};
 let baseline:unknown;const timings:Record<string,number>={};
 if(b.compare){const start=performance.now();try{if(mayBeWhatsAppQuestion(b.text)){const q=await extractWhatsAppConsultation(b.text,today,key);baseline=q.mode==='CONSULTA'?whatsappReadReply(await readAssistantData(reader,q.input.period==='personalizado'?q.input:(({from:_,to:__,...v})=>{void _;void __;return v;})(q.input),'OWNER',today),q.input):q.mode==='MANUAL'?whatsappManualReply(q.topic):q.message;}else{const d=await extractExpense(b.text,today,key);baseline=expensePayload(d,b.text,randomUUID(),[],today);}}catch(e){baseline=e instanceof Error?e.message:'Falha anterior';}timings.before_ms=Math.round(performance.now()-start);memo.clear();}
 const start=performance.now(),parsed=await interpretConversation(b.text,today,key,companies,memory),prepared=await prepareConversation(parsed.plan,b.text,today,companies,memory,'OWNER',reader,async p=>await rows(p) as Record<string,unknown>[]);timings.after_ms=Math.round(performance.now()-start);timings.interpret_ms=Math.round(parsed.duration_ms);timings.model_calls=parsed.model_calls;timings.table_reads=memo.size;
 return Response.json({ok:true,dry_run:true,message:'Simulação: nenhum registro foi salvo e nenhuma mensagem foi enviada.',plan:parsed.plan,results:prepared.results.map(r=>({kind:r.kind,reply:r.reply,summary:r.pending?.summary,operation:r.pending?.operation})),memory:prepared.memory,timings,...b.compare?{baseline}:{}},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return bankError(e instanceof BankError?e:new BankError(e instanceof Error?e.message:'Não consegui simular. Nenhum dado foi alterado.',400));}}
