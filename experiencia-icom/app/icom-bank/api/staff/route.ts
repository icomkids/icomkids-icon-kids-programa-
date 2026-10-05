import {config} from '@/lib/server';
import {bankAuthorize,bankOrigin,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {staffInput,type Staff} from '@/lib/icom-bank/management';
import {bankPath} from '@/lib/icom-bank/model';
export async function POST(req:Request){try{bankOrigin(req);const {token,profile}=await bankAuthorize('funcionarios');const text=await req.text();if(text.length>2500)throw new BankError('Solicitação acima do limite.',400);let input;try{input=staffInput(JSON.parse(text),profile);}catch(e){throw new BankError(e instanceof Error?e.message:'Confira os dados.',400);}let staff:Staff,invited=false;
 try{staff=await bankQuery<Staff>(token,'rpc/icom_bank_save_staff','POST',input);}catch(e){if(!(e instanceof BankError)||e.code!=='BANK_USER_NOT_FOUND'||input.p_expected!==null)throw e;if(!input.p_active)throw new BankError('Cadastre primeiro um acesso ativo para enviar o convite.',400);
 const {url,key}=config();const redirect=(process.env.APP_URL||'https://sistema.icomkids.com.br')+bankPath('/criar-senha');const r=await fetch(`${url}/auth/v1/invite?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({email:input.p_email,data:{name:input.p_name}}),cache:'no-store'});if(!r.ok)throw new BankError('Não foi possível enviar o convite. Verifique o e-mail e tente novamente mais tarde.',r.status===429?429:400);invited=true;
 try{staff=await bankQuery<Staff>(token,'rpc/icom_bank_save_staff','POST',input);}catch{throw new BankError('O convite foi enviado, mas o acesso não foi liberado. Reabra a lista e cadastre este e-mail novamente.',409);}}
 return Response.json({staff,invited},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
