import {bankAuthorize,bankOrigin,bankError,bankQuery,BankError} from '@/lib/icom-bank/server';
import {bankProlabore} from '@/lib/icom-bank/prolabore-server';
import {prolaboreInput,prolaboreScheduleInput,prolaboreReceiveInput,prolaboreEditInput} from '@/lib/icom-bank/prolabore';
import {deletionQuery} from '@/lib/icom-bank/deletion-server';
import {sharedAssistantCache} from '@/lib/icom-bank/assistant-cache';
import {validId} from '@/lib/icom-bank/contracts';
export async function GET(){try{const {token}=await bankAuthorize('administrativo');return Response.json({rows:await bankProlabore(token)},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return bankError(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize('administrativo');const raw=await req.text();if(raw.length>4000)throw new BankError('Registro muito extenso.',400);const b=JSON.parse(raw);let row;
 if(b.action==='cancel'){
  if(typeof b.id!=='string'||!validId(b.id)||typeof b.expected_updated_at!=='string'||!Number.isFinite(Date.parse(b.expected_updated_at)))throw new BankError('Atualize a lista antes de cancelar.',400);
  row=await deletionQuery(token,'cancel_prolabore',b.id,'rpc/icom_bank_cancel_prolabore',{p_id:b.id,p_expected:b.expected_updated_at},b.deletion_password);
 }else if(b.action==='schedule'){
  row=await bankQuery(token,'rpc/icom_bank_schedule_prolabore','POST',{p_payload:prolaboreScheduleInput(b)});
 }else if(b.action==='receive'){
  row=await bankQuery(token,'rpc/icom_bank_receive_prolabore','POST',prolaboreReceiveInput(b));
 }else if(b.action==='edit_series'){
  row=await bankQuery(token,'rpc/icom_bank_edit_prolabore_series','POST',prolaboreEditInput(b));
 }else{
  let payload;try{payload=prolaboreInput(b);}catch(e){throw new BankError(e instanceof Error?e.message:'Confira os dados.',400);}
  row=await bankQuery(token,'rpc/icom_bank_save_prolabore','POST',{p_payload:payload});
 }
 sharedAssistantCache().clear();return Response.json({row},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
