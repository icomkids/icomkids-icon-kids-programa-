import {sharedAssistantCache} from '@/lib/icom-bank/assistant-cache';
import {bankAuthorize,bankOrigin,bankError,bankQuery,BankError} from '@/lib/icom-bank/server';
import {accountData,bankAccounts,bankAccountLinks} from '@/lib/icom-bank/accounts-server';
import {accountInput,accountId} from '@/lib/icom-bank/accounts';
export async function GET(req:Request){try{const {token}=await bankAuthorize('administrativo');return Response.json(new URL(req.url).searchParams.get('select')==='options'?{accounts:await bankAccounts(token),links:await bankAccountLinks(token)}:await accountData(token),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return bankError(e);}}
export async function POST(req:Request){try{bankOrigin(req);const {token}=await bankAuthorize('administrativo');const text=await req.text();if(text.length>4000)throw new BankError('Cadastro muito extenso.',400);const b=JSON.parse(text);let row;
 if(b.action==='assign'){row=await bankQuery(token,'rpc/icom_bank_assign_account','POST',{p_entry:accountId(b.entry_id,true),p_account:accountId(b.account_id,true)});}else{const p=accountInput(b);const {expected_updated_at,...payload}=p;row=await bankQuery(token,'rpc/icom_bank_save_account','POST',{p_payload:payload,p_expected:expected_updated_at});}
 sharedAssistantCache().clear();return Response.json({row},{headers:{'Cache-Control':'no-store'}});}catch(e){return bankError(e instanceof BankError?e:new BankError(e instanceof Error?e.message:'Confira os dados.',400));}}
