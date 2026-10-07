import {bankAuthorize,bankError,bankOrigin,BankError} from '@/lib/icom-bank/server';
import {helpForRole} from '@/lib/icom-bank/assistant-guide';
import {boundedVoiceBody,voiceInput,VoiceError} from '@/lib/icom-bank/assistant-session';
import {closeVoice,startVoice,voiceConfigured} from '@/lib/icom-bank/assistant-server';
import {authorizeAssistant,quickAssistant} from '@/lib/icom-bank/assistant-query';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function failure(e:unknown){return bankError(e instanceof VoiceError?new BankError(e.message,e.status):e);}
export async function GET(req:Request){try{const {profile}=await authorizeAssistant(req);return Response.json({configured:voiceConfigured(),topics:helpForRole(profile.role)},{headers});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const auth=await authorizeAssistant(req),{profile}=auth;
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new BankError('Reabra a ajuda para conversar.',415);
 const input=voiceInput(await boundedVoiceBody(req),profile.role);
 void quickAssistant(auth).catch(()=>{});
 return Response.json(await startVoice(profile.user_id,profile.role,input,req.signal),{headers});
 }catch(e){return failure(e);}}
export async function DELETE(req:Request){try{
 bankOrigin(req);const {profile}=await bankAuthorize();const id=new URL(req.url).searchParams.get('id')||'';
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new BankError('Identificação de conversa inválida.',400);
 await closeVoice(profile.user_id,id);return Response.json({closed:true},{headers});
 }catch(e){return failure(e);}}
