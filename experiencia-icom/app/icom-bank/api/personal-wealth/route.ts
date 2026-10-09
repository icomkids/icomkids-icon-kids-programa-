import {deletionQuery} from '@/lib/icom-bank/deletion-server';
import {sharedAssistantCache} from '@/lib/icom-bank/assistant-cache';
import {accountId} from '@/lib/icom-bank/accounts';
import {bankAuthorize,bankOrigin,bankError,bankQuery,BankError} from '@/lib/icom-bank/server';
import {wealthInput,type WealthRecord} from '@/lib/icom-bank/personal-wealth';
import {bankWealth} from '@/lib/icom-bank/wealth-server';
export async function GET(){try{const {token}=await bankAuthorize('administrativo');return Response.json({rows:await bankWealth(token)},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return bankError(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize('administrativo');const raw=await req.text();if(raw.length>6000)throw new BankError('Cadastro muito extenso.',400);
 const body=JSON.parse(raw);let input;try{input=wealthInput(body);}catch(e){throw new BankError(e instanceof Error?e.message:'Confira o cadastro.',400);}
 const {expected_updated_at,...payload}=input;
 const row=!payload.active?await deletionQuery<WealthRecord>(token,'archive_wealth',payload.id,'rpc/icom_bank_save_personal_wealth',{p_payload:payload,p_expected:expected_updated_at},body.deletion_password):await bankQuery<WealthRecord>(token,payload.kind==='RENDA'&&payload.active&&expected_updated_at===null?'rpc/icom_bank_save_account_income':'rpc/icom_bank_save_personal_wealth','POST',{p_payload:payload,p_expected:expected_updated_at,...payload.kind==='RENDA'&&payload.active&&expected_updated_at===null?{p_account:accountId(body.account_id)}:{}});
 sharedAssistantCache().clear();return Response.json({row},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
