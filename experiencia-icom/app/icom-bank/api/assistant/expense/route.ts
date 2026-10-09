import {bankAccounts,accountPost} from '@/lib/icom-bank/accounts-server';
import {resolveAccount} from '@/lib/icom-bank/accounts';
import {refuseVoiceWithdrawal} from '@/lib/icom-bank/assistant-financial';
import {randomUUID} from 'node:crypto';
import {bankAuthorize,bankOrigin,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {claimVoiceRead} from '@/lib/icom-bank/assistant-server';
import {boundedVoiceBody,VoiceError} from '@/lib/icom-bank/assistant-session';
import {expenseVoiceText,signVoiceExpense,readVoiceExpense,sameVoiceExpense} from '@/lib/icom-bank/assistant-expense';
import {extractExpense} from '@/lib/icom-bank/whatsapp-ai';
import {expensePayload} from '@/lib/icom-bank/whatsapp-expenses';
import {sharedAssistantCache} from '@/lib/icom-bank/assistant-cache';
import {brazilDay} from '@/lib/icom-bank/model';
import type {AdminEntry} from '@/lib/icom-bank/administrative';
import {expensePlate} from '@/lib/icom-bank/spoken-plate';
import type {StockRow} from '@/lib/icom-bank/stock';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req:Request){try{
 bankOrigin(req);const {token,profile}=await bankAuthorize('administrativo');
 if(profile.role!=='OWNER')throw new BankError('Sua conta não pode lançar despesas por voz.',403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new BankError('Pedido inválido.',415);
 const raw=await boundedVoiceBody(req,17000) as Record<string,unknown>;
 if(!raw||Array.isArray(raw)||typeof raw!=='object'||Object.keys(raw).some(k=>!['id','name','arguments','confirmation'].includes(k))||typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/i.test(raw.id))throw new BankError('Pedido inválido.',400);
 claimVoiceRead(profile.user_id,raw.id);
 const key=process.env.OPENAI_API_KEY?.trim();if(!key)throw new BankError('Lançamento por voz indisponível.',503);
 if(raw.confirmation!==undefined){
  if(raw.name!==undefined||raw.arguments!==undefined)throw new BankError('Confirmação inválida.',400);
  const signed=readVoiceExpense(raw.confirmation,profile.user_id,key);const {account_id,...payload}=signed;
  const find=async()=>{const [row]=await bankQuery<AdminEntry[]>(token,'icom_bank_admin_entries?id=eq.'+payload.id+'&select=*');return row;};
  let row=await find();
  if(row&&!sameVoiceExpense(row as unknown as Record<string,unknown>,payload))throw new BankError('Este lançamento foi alterado. Confira o painel.',409);
  row=await accountPost(token,'LANCAMENTO',{p_payload:payload,p_expected:null},account_id) as AdminEntry;
  sharedAssistantCache().clear();return Response.json({ok:true,saved:true,row},{headers});
 }
 if(raw.name!=='preparar_despesa_icom')throw new BankError('Pedido inválido.',400);
 const transcript=expenseVoiceText(raw.arguments),today=brazilDay();refuseVoiceWithdrawal(transcript);const draft=await extractExpense(transcript,today,key);
 const plate=expensePlate(draft.plate,transcript);
 const stocks=draft.scope==='LOJA'&&plate?await bankQuery<StockRow[]>(token,'icom_bank_stock_vehicles?select=id,plate,active,status,entry_date&active=eq.true&plate=eq.'+plate+'&status=neq.VENDIDO&limit=2'):[];
 const {expected_updated_at:_,...base}=expensePayload(draft,transcript,randomUUID(),stocks,today,'VOICE');void _;const account=resolveAccount(await bankAccounts(token),draft.account_name,transcript),payload={...base,account_id:account?.id||null};
 return Response.json({ok:true,saved:false,pending:{payload,accountName:account?account.name+' · '+account.bank:undefined,confirmation:signVoiceExpense(payload,profile.user_id,key)},message:'Confira o resumo e toque em Confirmar lançamento. Ainda não foi salva.'},{headers});
}catch(e){return bankError(e instanceof VoiceError?new BankError(e.message,e.status):e instanceof BankError?e:new BankError(e instanceof Error?e.message:'Não foi possível lançar. Confira o histórico antes de repetir.',400));}}
