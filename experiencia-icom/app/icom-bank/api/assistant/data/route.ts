import {bankError,bankOrigin,BankError} from '@/lib/icom-bank/server';
import {AssistantDataError} from '@/lib/icom-bank/assistant-data';
import {authorizeAssistant,queryAssistant} from '@/lib/icom-bank/assistant-query';
import {claimVoiceRead} from '@/lib/icom-bank/assistant-server';
import {boundedVoiceBody,VoiceError} from '@/lib/icom-bank/assistant-session';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
function failure(e:unknown){return bankError(e instanceof AssistantDataError||e instanceof VoiceError?new BankError(e.message,e.status):e);}
// Authenticated read-only preview also permits direct comparison with the panel.
export async function GET(req:Request){try{
 const q=new URL(req.url).searchParams,raw:Record<string,unknown>={};
 for(const [name,value] of q){if(name==='limit'||name==='offset')raw[name]=Number(value);else raw[name]=value;}
 const start=performance.now(),auth=await authorizeAssistant(req);
 return Response.json(await queryAssistant(auth,raw),{headers:{...headers,'Server-Timing':`query;dur=${Math.round(performance.now()-start)}`}});
}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const start=performance.now();bankOrigin(req);const auth=await authorizeAssistant(req),{profile}=auth;
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new BankError('Consulta inválida.',415);
 const raw=await boundedVoiceBody(req,6000) as Record<string,unknown>;
 if(!raw||Array.isArray(raw)||typeof raw!=='object'||Object.keys(raw).some(k=>!['id','name','arguments'].includes(k))||typeof raw.id!=='string'||! /^[a-f0-9-]{36}$/i.test(raw.id)||raw.name!=='consultar_dados_icom')throw new BankError('Consulta inválida.',400);
 claimVoiceRead(profile.user_id,raw.id);
 return Response.json(await queryAssistant(auth,raw.arguments),{headers:{...headers,'Server-Timing':`query;dur=${Math.round(performance.now()-start)}`}});
}catch(e){return failure(e);}}
