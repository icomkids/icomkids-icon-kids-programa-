import {bankAuthorize,bankAll,bankCashEntries,bankQuery,bankError,bankOrigin,BankError} from '@/lib/icom-bank/server';
import {readAssistantData,AssistantDataError} from '@/lib/icom-bank/assistant-data';
import {claimVoiceRead} from '@/lib/icom-bank/assistant-server';
import {boundedVoiceBody,VoiceError} from '@/lib/icom-bank/assistant-session';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
function failure(e:unknown){return bankError(e instanceof AssistantDataError||e instanceof VoiceError?new BankError(e.message,e.status):e);}
async function query(raw:unknown){
 const {token,profile}=await bankAuthorize();
 return readAssistantData({rows:path=>bankAll(token,path),ledger:()=>bankCashEntries(token),staff:()=>bankQuery(token,'rpc/icom_bank_list_staff','POST',{})},raw,profile.role);
}
// Authenticated read-only preview also permits direct comparison with the panel.
export async function GET(req:Request){try{
 const q=new URL(req.url).searchParams,raw:Record<string,unknown>={};
 for(const [name,value] of q){if(name==='limit')raw[name]=Number(value);else raw[name]=value;}
 return Response.json(await query(raw),{headers});
}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const {token,profile}=await bankAuthorize();
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new BankError('Consulta inválida.',415);
 const raw=await boundedVoiceBody(req,6000) as Record<string,unknown>;
 if(!raw||Array.isArray(raw)||typeof raw!=='object'||Object.keys(raw).some(k=>!['id','name','arguments'].includes(k))||typeof raw.id!=='string'||! /^[a-f0-9-]{36}$/i.test(raw.id)||raw.name!=='consultar_dados_icom')throw new BankError('Consulta inválida.',400);
 claimVoiceRead(profile.user_id,raw.id);
 return Response.json(await readAssistantData({rows:path=>bankAll(token,path),ledger:()=>bankCashEntries(token),staff:()=>bankQuery(token,'rpc/icom_bank_list_staff','POST',{})},raw.arguments,profile.role),{headers});
}catch(e){return failure(e);}}
