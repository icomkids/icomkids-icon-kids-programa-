import {platformAuthorize,platformData,platformQuery} from '@/lib/icom-bank/platform-server';
import {bankOrigin,bankError,BankError} from '@/lib/icom-bank/server';
import {platformInput,platformKinds,type PlatformKind} from '@/lib/icom-bank/platform';
import {brazilDay} from '@/lib/icom-bank/model';
export const dynamic='force-dynamic';
export async function GET(){try{const {token}=await platformAuthorize();return Response.json(await platformData(token),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return bankError(e);}}
async function write(req:Request){try{
 bankOrigin(req);const {token}=await platformAuthorize();const raw=await req.text();if(raw.length>14000)throw new BankError('Cadastro muito longo.',400);
 const b=JSON.parse(raw) as {kind:PlatformKind;id:string;updated_at?:string;payload:Record<string,unknown>};
 if(!b||!platformKinds.includes(b.kind)||!b.payload||typeof b.payload!=='object'||Array.isArray(b.payload)||Object.keys(b).some(k=>!['kind','id','updated_at','payload'].includes(k)))throw new BankError('Cadastro inválido.',400);
 if(b.kind==='settings'?b.id!=='1':typeof b.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id))throw new BankError('Identificador inválido.',400);
 const payload=platformInput(b.kind,b.payload,brazilDay());const table='ia_bank_saas_'+b.kind;
 const rows=await platformQuery<Record<string,unknown>[]>(token,table+'?id=eq.'+encodeURIComponent(b.id)+'&select=*');const old=rows[0];
 if(req.method==='POST'){
  if(b.kind==='settings')throw new BankError('Use a configuração existente.',400);
  if(old){if(Object.entries(payload).every(([k,v])=>old[k]===v))return Response.json({saved:true,duplicate:true},{headers:{'Cache-Control':'no-store'}});throw new BankError('Esse cadastro mudou. Atualize a lista.',409);}
  await platformQuery(token,table,'POST',{...payload,id:b.id});
 }else{
  if(!old||!b.updated_at||old.updated_at!==b.updated_at)throw new BankError('O registro mudou em outra aba. Atualize a lista.',409);
  if(b.kind==='charges'){
   if(old.source!=='MANUAL'||old.status==='ESTORNADO')throw new BankError('Pagamento automático: corrija pelo provedor.',409);
   if(['CONFIRMADO','RECEBIDO'].includes(String(old.status))&&(payload.fee_cents===null||Object.entries(payload).some(([k,v])=>k!=='fee_cents'&&old[k]!==v)))throw new BankError('O pagamento já foi conciliado. Altere somente a taxa.',409);
  }
  const changed=await platformQuery<unknown[]>(token,table+'?id=eq.'+encodeURIComponent(b.id)+'&updated_at=eq.'+encodeURIComponent(b.updated_at),'PATCH',payload);
  if(!changed.length)throw new BankError('O registro mudou. Atualize a lista.',409);
 }
 return Response.json({saved:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return bankError(e);}}
export const POST=write;export const PATCH=write;
