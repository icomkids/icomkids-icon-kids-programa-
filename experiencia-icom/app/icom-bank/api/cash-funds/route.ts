import {bankAuthorize,bankOrigin,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {cashFundsInput} from '@/lib/icom-bank/cash-funds';
import {sharedAssistantCache} from '@/lib/icom-bank/assistant-cache';
import type {CashEntry} from '@/lib/icom-bank/cash';
export async function POST(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize('administrativo');const raw=await req.text();if(raw.length>3000)throw new BankError('Registro muito extenso.',400);let input;try{input=cashFundsInput(JSON.parse(raw));}catch(e){throw new BankError(e instanceof Error?e.message:'Confira os dados.',400);}
 const row=await bankQuery<CashEntry>(token,'rpc/icom_bank_add_cash_funds','POST',{p_id:input.id,p_account:input.account_id,p_kind:input.type,p_amount:input.amount_cents,p_date:input.date,p_notes:input.notes});sharedAssistantCache().clear();return Response.json({row},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
