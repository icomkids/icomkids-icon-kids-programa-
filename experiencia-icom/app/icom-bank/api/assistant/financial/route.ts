import {accountPost} from '@/lib/icom-bank/accounts-server';
import {bankAuthorize,bankOrigin,bankQuery,bankAll,bankError,BankError} from '@/lib/icom-bank/server';
import {claimVoiceRead} from '@/lib/icom-bank/assistant-server';
import {boundedVoiceBody,VoiceError} from '@/lib/icom-bank/assistant-session';
import {expenseVoiceText} from '@/lib/icom-bank/assistant-expense';
import {extractFinancial,prepareFinancial,signFinancial,readFinancial,sameFinancialEntry} from '@/lib/icom-bank/assistant-financial';
import {sharedAssistantCache} from '@/lib/icom-bank/assistant-cache';
import {brazilDay} from '@/lib/icom-bank/model';
import type {AdminEntry} from '@/lib/icom-bank/administrative';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req:Request){try{
 bankOrigin(req);const {token,profile}=await bankAuthorize('administrativo');
 if(profile.role!=='OWNER')throw new BankError('Sua conta não pode lançar registros financeiros por voz.',403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new BankError('Pedido inválido.',415);
 const raw=await boundedVoiceBody(req,35000) as Record<string,unknown>;
 if(!raw||Array.isArray(raw)||typeof raw!=='object'||Object.keys(raw).some(k=>!['id','name','arguments','confirmation'].includes(k))||typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/i.test(raw.id))throw new BankError('Pedido inválido.',400);
 claimVoiceRead(profile.user_id,raw.id);
 const key=process.env.OPENAI_API_KEY?.trim();if(!key)throw new BankError('Registro por voz indisponível.',503);
 if(raw.confirmation!==undefined){
  if(raw.name!==undefined||raw.arguments!==undefined)throw new BankError('Confirmação inválida.',400);
  const pending=readFinancial(raw.confirmation,profile.user_id,key);
  let row:unknown;
  if(pending.account_id!==undefined){row=await accountPost(token,pending.operation,pending.args,pending.account_id);}else if(pending.operation==='LANCAMENTO'){
   const payload=pending.args.p_payload as Record<string,unknown>;
   const find=async()=>{const [r]=await bankQuery<AdminEntry[]>(token,'icom_bank_admin_entries?id=eq.'+payload.id+'&select=*');return r;};
   row=await find();if(row&&(!(row as AdminEntry).active||!sameFinancialEntry(row as AdminEntry,payload)))throw new BankError('O registro foi alterado. Confira a tela.',409);
   if(!row){try{row=await bankQuery(token,'rpc/'+pending.rpc,'POST',pending.args);}catch(e){row=await find();if(!row||!(row as AdminEntry).active||!sameFinancialEntry(row as AdminEntry,payload))throw e;}}
  }else row=await bankQuery(token,'rpc/'+pending.rpc,'POST',pending.args);
  sharedAssistantCache().clear();return Response.json({ok:true,saved:true,destination:pending.destination,row,message:'Pronto, está salvo em '+pending.destination+'.'},{headers});
 }
 if(raw.name!=='preparar_lancamento_icom')throw new BankError('Pedido inválido.',400);
 const transcript=expenseVoiceText(raw.arguments),today=brazilDay();
 const draft=await extractFinancial(transcript,today,key);
 const prepared=await prepareFinancial(draft,transcript,today,async path=>await bankAll(token,path+'&order=id.asc') as Record<string,unknown>[]);
 return Response.json({ok:true,saved:false,pending:{summary:prepared.summary,destination:prepared.destination,confirmation:signFinancial(prepared,profile.user_id,key)},message:'Confira o resumo e confirme no botão. Ainda não foi salvo.'},{headers});
}catch(e){return bankError(e instanceof VoiceError?new BankError(e.message,e.status):e instanceof BankError?e:new BankError(e instanceof Error?e.message:'Não foi possível salvar. Confira o histórico antes de repetir.',400));}}
