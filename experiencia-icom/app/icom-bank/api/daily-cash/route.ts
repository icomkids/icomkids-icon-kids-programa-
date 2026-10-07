import {bankAuthorize,bankOrigin,bankError,bankQuery,BankError} from '@/lib/icom-bank/server';
import {cashDay,checkInput,dailyCash,withdrawalInput,type DailyContext,type CashCheck} from '@/lib/icom-bank/daily-cash';
import {dailyCashData} from '@/lib/icom-bank/daily-cash-server';
import {brazilDay} from '@/lib/icom-bank/model';
import type {AdminEntry} from '@/lib/icom-bank/administrative';
export async function GET(req:Request){try{const {token}=await bankAuthorize('administrativo');const date=cashDay(new URL(req.url).searchParams.get('date')||brazilDay());return Response.json(await dailyCashData(token,date),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return bankError(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize('administrativo');const raw=await req.text();if(raw.length>6000)throw new BankError('Registro muito extenso.',400);const body=JSON.parse(raw) as Record<string,unknown>;
 if(body.action==='withdrawal'){
  const payload=withdrawalInput(body);
  const row=await bankQuery<AdminEntry>(token,'rpc/icom_bank_record_withdrawal','POST',{p_payload:payload});
  return Response.json({row},{headers:{'Cache-Control':'no-store'}});
 }
 if(body.action!=='check')throw new BankError('Selecione uma operação válida.',400);
 const input=checkInput(body),context=await bankQuery<DailyContext>(token,'rpc/icom_bank_daily_context','POST',{p_day:input.date});
 if(input.revision!==context.revision)throw new BankError('Os lançamentos mudaram. Atualize a conferência e confira o saldo novamente.',409);
 const metrics=dailyCash(context.entries,input.date);
 if(input.observed_cents!==metrics.gross&&input.notes.length<5)throw new BankError('Explique a diferença na observação para guardar a conferência.',400);
 const row=await bankQuery<CashCheck>(token,'rpc/icom_bank_save_cash_check','POST',{p_id:input.id,p_day:input.date,p_observed:input.observed_cents,p_notes:input.notes,p_revision:context.revision,p_metrics:metrics});
 return Response.json({row},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e instanceof BankError)return bankError(e);return bankError(new BankError(e instanceof Error&&!(e instanceof SyntaxError)?e.message:'Confira os dados informados.',400));}}
