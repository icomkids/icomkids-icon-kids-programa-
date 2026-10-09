import {accountPost} from '@/lib/icom-bank/accounts-server';
import {bankAuthorize,bankOrigin,bankAll,bankCashEntries,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {validId} from '@/lib/icom-bank/contracts';
import {payableInput} from '@/lib/icom-bank/payables';
export async function GET(req:Request){try{
 const {token}=await bankAuthorize('administrativo'),id=new URL(req.url).searchParams.get('id');
 if(id){if(!validId(id))throw new BankError('Conta inválida.',400);const [history,files]=await Promise.all([bankAll(token,`icom_bank_payable_history?payable_id=eq.${id}&select=*&order=created_at.desc,id.asc`),bankAll(token,`icom_bank_payable_files?payable_id=eq.${id}&status=eq.ANEXADO&select=id,payable_id,mime_type,size_bytes,created_at&order=created_at.desc,id.asc`)]);return Response.json({history,files},{headers:{'Cache-Control':'no-store'}});}
 const [rows,stock,entries]=await Promise.all([bankAll(token,'icom_bank_payables?select=*&order=created_at.desc,id.asc'),bankAll(token,'icom_bank_stock_vehicles?select=*&order=entry_date.desc,id.asc'),bankCashEntries(token)]);
 return Response.json({rows,stock,entries},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize('administrativo');const text=await req.text();if(text.length>6000)throw new BankError('Dados acima do limite.',413);
 const body=JSON.parse(text);let parsed;try{parsed=payableInput(body);}catch(e){throw new BankError(e instanceof Error?e.message:'Confira os dados.',400);}
 const names={schedule:'icom_bank_schedule_payable',pay:'icom_bank_pay_trade_debt',reverse:'icom_bank_reverse_payable',expense:'icom_bank_save_expense',archive:'icom_bank_archive_expense'};
 const row=parsed.action==='pay'?await accountPost(token,'PAGAR_CONTA',parsed.args,body.account_id):await bankQuery(token,'rpc/'+names[parsed.action],'POST',parsed.args);
 return Response.json({row},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
