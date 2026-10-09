import {config,db} from '@/lib/server';
import {bankAuthorize,bankOrigin,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {deletionPassword} from '@/lib/icom-bank/deletion';
export async function GET(){try{const {token,profile}=await bankAuthorize();const configured=await bankQuery<boolean>(token,'rpc/icom_bank_deletion_status','POST',{});return Response.json({configured,can_configure:profile.role==='OWNER'},{headers:{'Cache-Control':'no-store'}});}catch(e){return bankError(e);}}
export async function POST(req:Request){try{
 bankOrigin(req);const {token,profile}=await bankAuthorize('configuracoes');if(profile.role!=='OWNER')throw new BankError('Somente o proprietário pode criar ou alterar esta senha.');
 const raw=await req.text();if(raw.length>1000)throw new BankError('Solicitação acima do limite.',413);const b=JSON.parse(raw);const password=deletionPassword(b.password);
 if(Buffer.byteLength(password,'utf8')>72||password!==b.confirm_password||typeof b.login_password!=='string'||b.login_password.length>128)throw new BankError('Confira a confirmação da senha e sua senha de acesso.',400);
 const {url,key}=config();const userResponse=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},cache:'no-store'});if(!userResponse.ok)throw new BankError('Entre novamente.',401);const user=await userResponse.json() as {id:string;email:string};
 const verified=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:b.login_password}),cache:'no-store'});
 if(!verified.ok)throw new BankError('Sua senha de acesso está incorreta. A senha de exclusão não foi alterada.',403);const session=await verified.json() as {user?:{id:string}};if(session.user?.id!==profile.user_id)throw new BankError('Não foi possível confirmar sua conta.',403);
 await db('rpc/icom_bank_set_deletion_password','POST',{p_actor:profile.user_id,p_password:password});return Response.json({configured:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return bankError(e);}}
