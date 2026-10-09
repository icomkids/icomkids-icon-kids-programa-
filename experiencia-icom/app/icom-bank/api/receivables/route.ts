import {deletionQuery} from '@/lib/icom-bank/deletion-server';
import {accountPost} from '@/lib/icom-bank/accounts-server';
import {bankAuthorize,bankOrigin,bankAll,bankCashEntries,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {validId} from '@/lib/icom-bank/contracts';
import {receivableInput} from '@/lib/icom-bank/receivables';
export async function GET(req:Request){try{
 const {token}=await bankAuthorize('administrativo'),id=new URL(req.url).searchParams.get('id');
 if(id){if(!validId(id))throw new BankError('Conta inválida.',400);const history=await bankAll(token,`icom_bank_receivable_history?receivable_id=eq.${id}&select=*&order=created_at.desc,id.asc`);return Response.json({history},{headers:{'Cache-Control':'no-store'}});}
 const [rows,receipts,entries]=await Promise.all([bankAll(token,'icom_bank_receivables?select=*&order=created_at.desc,id.asc'),bankAll(token,'icom_bank_receipts?select=*&order=created_at.desc,id.asc'),bankCashEntries(token)]);
 return Response.json({rows,receipts,entries},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize('administrativo');const text=await req.text();if(text.length>6000)throw new BankError('Dados acima do limite.',413);
 const body=JSON.parse(text);let parsed;try{parsed=receivableInput(body);}catch(e){throw new BankError(e instanceof Error?e.message:'Confira os dados.',400);}
 const names={save:'icom_bank_save_receivable',receive:'icom_bank_receive',reverse:'icom_bank_reverse_receipt',archive:'icom_bank_archive_receivable'};
 const row=parsed.action==='receive'?await accountPost(token,'RECEBER_CONTA',parsed.args,body.account_id):parsed.action==='reverse'||parsed.action==='archive'&&body.active===false?await deletionQuery(token,parsed.action==='reverse'?'reverse_receipt':'archive_receivable',String(body.id),'rpc/'+names[parsed.action],parsed.args,body.deletion_password):await bankQuery(token,'rpc/'+names[parsed.action],'POST',parsed.args);return Response.json({row},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
