import {sharedAssistantCache} from '@/lib/icom-bank/assistant-cache';
import {bankAuthorize,bankOrigin,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {agendaInput,type AgendaEvent} from '@/lib/icom-bank/agenda';
import {bankAgenda} from '@/lib/icom-bank/agenda-server';
export async function GET(){try{const {token,profile}=await bankAuthorize('agenda');return Response.json(await bankAgenda(token,profile.role),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return bankError(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const {token,profile}=await bankAuthorize('agenda');if(profile.role!=='OWNER')throw new BankError('Seu acesso à Agenda é somente para acompanhamento.',403);const raw=await req.text();if(raw.length>6000)throw new BankError('Compromisso acima do limite.',413);
 let parsed;try{parsed=agendaInput({...JSON.parse(raw),origin:'PAINEL'});}catch(e){throw new BankError(e instanceof Error?e.message:'Confira os dados.',400);}
 const row=await bankQuery<AgendaEvent>(token,'rpc/icom_bank_save_agenda','POST',parsed);
 sharedAssistantCache().clear();return Response.json({row},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
