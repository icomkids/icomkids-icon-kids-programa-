import {bankAuthorize,bankOrigin,bankQuery,bankAll,bankCashEntries,bankError,BankError} from '@/lib/icom-bank/server';
import {claimVoiceRead,voiceMemory} from '@/lib/icom-bank/assistant-server';
import {boundedVoiceBody,VoiceError} from '@/lib/icom-bank/assistant-session';
import {expenseVoiceText} from '@/lib/icom-bank/assistant-expense';
import {prepareVoiceConversation} from '@/lib/icom-bank/conversation-voice';
import {brazilDay} from '@/lib/icom-bank/model';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request){try{
 bankOrigin(req);const {token,profile}=await bankAuthorize('dashboard');if(!req.headers.get('content-type')?.startsWith('application/json'))throw new BankError('Pedido inválido.',415);
 const raw=await boundedVoiceBody(req,7000) as Record<string,unknown>;
 if(!raw||Array.isArray(raw)||typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/i.test(raw.id)||raw.name!=='interpretar_pedido_icom'||Object.keys(raw).some(k=>!['id','name','arguments'].includes(k)))throw new BankError('Pedido inválido.',400);
 claimVoiceRead(profile.user_id,raw.id);const text=expenseVoiceText(raw.arguments),key=process.env.OPENAI_API_KEY?.trim();if(!key)throw new BankError('Interpretação indisponível.',503);
 const settings=profile.role==='OWNER'?await bankQuery<{company_name:string}[]>(token,'icom_bank_system_settings?select=company_name&limit=1'):[];
 const companies=[{id:'local',name:settings[0]?.company_name||'Empresa cadastrada',aliases:['ICOM','ICOM Motors','loja','empresa']}];
 const cache=new Map<string,Promise<unknown[]>>();const rows=(p:string)=>{let r=cache.get(p);if(!r){r=bankAll(token,p);cache.set(p,r);}return r;};
 const result=await prepareVoiceConversation({text,today:brazilDay(),key,companies,memory:voiceMemory(profile.user_id,raw.id),role:profile.role,user:profile.user_id,reader:{rows,ledger:()=>bankCashEntries(token),staff:()=>bankQuery(token,'rpc/icom_bank_list_staff','POST',{})}});
 voiceMemory(profile.user_id,raw.id,result.memory);return Response.json({ok:true,saved:false,reply:result.reply,pendingList:result.pending,timing:result.timing,message:result.pending.length?'Confira cada resumo no painel. Ainda não foi salvo.':result.reply},{headers:{'Cache-Control':'private, no-store','Server-Timing':'conversation;dur='+result.timing.total_ms}});
 }catch(e){return bankError(e instanceof VoiceError?new BankError(e.message,e.status):e instanceof BankError?e:new BankError(e instanceof Error?e.message:'Falha ao interpretar. Nada foi salvo.',400));}}
