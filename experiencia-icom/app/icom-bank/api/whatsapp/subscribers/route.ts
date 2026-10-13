import {bankOrigin,bankError,BankError} from '@/lib/icom-bank/server';
import {platformAuthorize} from '@/lib/icom-bank/platform-server';
import {db} from '@/lib/server';
import {phoneBR} from '@/lib/whatsapp';
import {validId} from '@/lib/icom-bank/contracts';
type Contact={id:string;name:string;phone:string;subscriber_id:string|null;active:boolean;updated_at:string};
export async function GET(){try{
 await platformAuthorize();const [active,removed,subscribers]=await Promise.all([db<Contact[]>('ia_bank_whatsapp_subscriber_contacts?active=eq.true&select=id,name,phone,subscriber_id,active,updated_at&order=created_at.desc'),db<Contact[]>('ia_bank_whatsapp_subscriber_contacts?active=eq.false&select=id,name,phone,subscriber_id,active,updated_at&order=created_at.desc&limit=60'),db<unknown[]>('ia_bank_saas_subscribers?select=id,store_name,deployment_status&status=neq.CANCELADO&order=store_name.asc')]);
 return Response.json({rows:[...active,...removed],subscribers,routing_ready:false},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return bankError(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const {profile}=await platformAuthorize();const raw=await req.text();if(raw.length>2000)throw new BankError('Cadastro acima do limite.',400);
 const b=JSON.parse(raw) as Record<string,unknown>;if(Object.keys(b).some(k=>!['action','id','name','phone','subscriber_id','expected_updated_at'].includes(k)))throw new BankError('Confira o cadastro.',400);
 const action=String(b.action||'save');if(!['save','remove','restore'].includes(action))throw new BankError('Operação inválida.',400);
 const id=b.id;if(id!==undefined&&!validId(String(id)))throw new BankError('Reabra o cadastro antes de alterar.',400);
 const [old]=id?await db<Contact[]>('ia_bank_whatsapp_subscriber_contacts?id=eq.'+id+'&select=*'):[];
 if(id&&(!old||b.expected_updated_at!==old.updated_at))throw new BankError('O cadastro mudou. Atualize a lista.',409);
 let payload:Record<string,unknown>;
 if(action!=='save'){if(!old)throw new BankError('Contato não encontrado.',404);payload={active:action==='restore'};}
 else{
  if(typeof b.name!=='string'||b.name.trim().length<2||b.name.length>100||/[\x00-\x1f]/.test(b.name))throw new BankError('Informe o nome da pessoa ou da loja.',400);
  const phone=phoneBR(b.phone);const [bot]=await db<{phone:string;allowed_phones:string[]}[]>('icom_bank_whatsapp_bot?id=eq.1&select=phone,allowed_phones');
  if(bot&&(bot.phone===phone||bot.allowed_phones.includes(phone)))throw new BankError('Este número pertence à conexão ou à sua loja. Use um número de outra loja para cadastrar um assinante.',400);
  const [duplicate]=await db<Contact[]>('ia_bank_whatsapp_subscriber_contacts?phone=eq.'+phone+'&select=id,active');
  if(duplicate&&duplicate.id!==id)throw new BankError('Este número já está cadastrado. Edite ou restaure o cadastro existente.',409);
  if(b.subscriber_id){if(!validId(String(b.subscriber_id)))throw new BankError('Selecione a assinatura.',400);const [subscriber]=await db<unknown[]>('ia_bank_saas_subscribers?id=eq.'+b.subscriber_id+'&status=neq.CANCELADO&select=id');if(!subscriber)throw new BankError('Assinatura não encontrada ou cancelada.',400);}
  payload={name:b.name.trim(),phone,subscriber_id:b.subscriber_id||null,...(!old?{created_by:profile.user_id}:{}),active:old?.active??true};
 }
 const active=payload.active!==false;if(active){const count=await db<Contact[]>('ia_bank_whatsapp_subscriber_contacts?active=eq.true&select=id');if(count.filter(r=>r.id!==id).length>=40)throw new BankError('Você já tem 40 números ativos cadastrados.',400);}
 const rows=await db<Contact[]>(old?'ia_bank_whatsapp_subscriber_contacts?id=eq.'+old.id+'&updated_at=eq.'+encodeURIComponent(old.updated_at):'ia_bank_whatsapp_subscriber_contacts',old?'PATCH':'POST',payload);
 if(!rows.length)throw new BankError('O cadastro mudou. Atualize a lista.',409);
 await db('icom_bank_audit_logs','POST',{actor_id:profile.user_id,action:'WHATSAPP_ASSINANTE_'+action.toUpperCase(),details:{contact_id:rows[0].id}});
 return Response.json({row:rows[0],routing_ready:false},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
