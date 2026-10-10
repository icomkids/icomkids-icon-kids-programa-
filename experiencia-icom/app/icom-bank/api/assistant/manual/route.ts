import {userPreferences} from '@/lib/icom-bank/preferences-server';
import {bankError,bankOrigin,BankError} from '@/lib/icom-bank/server';
import {authorizeAssistant} from '@/lib/icom-bank/assistant-query';
import {claimVoiceRead} from '@/lib/icom-bank/assistant-server';
import {boundedVoiceBody,VoiceError} from '@/lib/icom-bank/assistant-session';
import {readManual} from '@/lib/icom-bank/assistant-manual';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
function result(args:unknown,view:unknown,role:Parameters<typeof readManual>[2],order:readonly string[]){try{return readManual(args,view,role,order);}catch{throw new BankError('Escolha um tópico válido do manual.',400);}}
function failure(e:unknown){return bankError(e instanceof VoiceError?new BankError(e.message,e.status):e);}
export async function GET(req:Request){try{
 const {token,profile}=await authorizeAssistant(req),q=new URL(req.url).searchParams;
 if([...q.keys()].some(k=>!['topic','view'].includes(k)))throw new BankError('Consulta inválida.',400);
 return Response.json(result({topic:q.get('topic')},q.get('view'),profile.role,(await userPreferences(token,profile.user_id)).menu_order),{headers});
}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const {token,profile}=await authorizeAssistant(req);
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new BankError('Consulta inválida.',415);
 const raw=await boundedVoiceBody(req,6000) as Record<string,unknown>;
 if(!raw||Array.isArray(raw)||typeof raw!=='object'||Object.keys(raw).some(k=>!['id','name','arguments','view'].includes(k))||typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/i.test(raw.id)||raw.name!=='consultar_manual_icom')throw new BankError('Consulta inválida.',400);
 claimVoiceRead(profile.user_id,raw.id);
 return Response.json(result(raw.arguments,raw.view,profile.role,(await userPreferences(token,profile.user_id)).menu_order),{headers});
}catch(e){return failure(e);}}
