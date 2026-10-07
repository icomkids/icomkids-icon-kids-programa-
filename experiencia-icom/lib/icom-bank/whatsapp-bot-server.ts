import {randomBytes} from 'node:crypto';
import {config,db} from '../server';
import {seal,unseal} from '../secret-box';
import {UAZAPI_URL,listInstances,type RemoteInstance} from '../uazapi';
import {connection,phoneBR,type Connection,type SellerInstance} from '../whatsapp';
import {botName} from './whatsapp-expenses';
import type {BankProfile} from './model';

export type BotConfig={id:number;owner_id:string;phone:string;allowed_phones:string[];enabled:boolean;status:'NOVO'|'CRIANDO'|'PRONTO'|'INCERTO'|'FALHOU';claim_id:string|null;instance_id:string|null;token_cipher:string|null;hook_cipher:string;worker_secret:string;updated_at:string};
const secret=()=>process.env.ICOM_WHATSAPP_ENCRYPTION_KEY||config().key;
export async function botConfig(){const [row]=await db<BotConfig[]>('icom_bank_whatsapp_bot?id=eq.1');return row||null;}
export function botCredentials(b:BotConfig):SellerInstance{if(b.status!=='PRONTO'||!b.token_cipher)throw new Error('Conecte o WhatsApp do ICOM Bank primeiro.');return {url:UAZAPI_URL,phone:b.phone,token:unseal(b.token_cipher,secret(),'icom-bank-bot')};}
export const botHook=(b:BotConfig)=>unseal(b.hook_cipher,secret(),'icom-bank-hook');
export function botOwned(value:unknown,owner:string):RemoteInstance|null{const row=value as RemoteInstance|null;return row&&typeof row.id==='string'&&typeof row.token==='string'&&row.token.length>=8&&row.name===botName&&row.adminField01===owner&&row.adminField02==='icom-bank-whatsapp'?row:null;}
async function providerToken(){const [row]=await db<{token_cipher:string}[]>('experience_whatsapp_provider?id=eq.1&select=token_cipher');if(!row)throw new Error('Configure primeiro a integração de WhatsApp da ICOM.');return unseal(row.token_cipher,secret(),'provider');}
export async function saveBot(profile:BankProfile,body:Record<string,unknown>){
 if(profile.role!=='OWNER')throw new Error('Somente o proprietário pode configurar os lançamentos por WhatsApp.');
 const phone=phoneBR(body.phone);if(!Array.isArray(body.allowed_phones)||body.allowed_phones.length<1||body.allowed_phones.length>10||typeof body.enabled!=='boolean')throw new Error('Informe de um a dez números autorizados e se deseja ativar o bot.');
 const allowed=Array.from(new Set(body.allowed_phones.map(phoneBR)));if(allowed.includes(phone))throw new Error('Use um número próprio para o ICOM Bank e envie os áudios de outro número autorizado.');
 const old=await botConfig();if(old&&old.owner_id!==profile.user_id)throw new Error('A integração já pertence a outro proprietário.');
 if(old&&body.expected_updated_at!==old.updated_at)throw new Error('A configuração mudou. Atualize a página antes de salvar.');
 if(old&&old.phone!==phone&&old.status!=='NOVO')throw new Error('O número já está vinculado à conexão. Desative e peça a troca da integração antes de alterar o número.');
 const payload={phone,allowed_phones:allowed,enabled:body.enabled,updated_at:new Date().toISOString()};
 if(old){const rows=await db<BotConfig[]>('icom_bank_whatsapp_bot?id=eq.1&updated_at=eq.'+encodeURIComponent(old.updated_at),'PATCH',payload);if(!rows.length)throw new Error('A configuração mudou. Atualize a página.');}
 else await db('icom_bank_whatsapp_bot','POST',{id:1,owner_id:profile.user_id,...payload,status:'NOVO',hook_cipher:seal(randomBytes(32).toString('base64url'),secret(),'icom-bank-hook'),worker_secret:randomBytes(32).toString('base64url')});
 await db('icom_bank_audit_logs','POST',{actor_id:profile.user_id,action:'WHATSAPP_CONFIGURADO',details:{enabled:body.enabled,authorized_count:allowed.length}});
}
async function ready(b:BotConfig,r:RemoteInstance){await db('icom_bank_whatsapp_bot?id=eq.1','PATCH',{status:'PRONTO',instance_id:r.id,token_cipher:seal(r.token,secret(),'icom-bank-bot'),updated_at:new Date().toISOString()});}
async function provisionBot(b:BotConfig){
 const token=await providerToken();const matches=(await listInstances(token)).map(r=>botOwned(r,b.owner_id)).filter((r):r is RemoteInstance=>!!r);
 if(matches.length>1)throw new Error('Há mais de uma conexão ICOM Bank. A gestão precisa conferir a integração.');
 if(matches[0]){await ready(b,matches[0]);return;}
 if(b.status==='CRIANDO'||b.status==='INCERTO')throw new Error('A criação está em conferência. Não foi criada outra instância; atualize a conexão em alguns instantes.');
 const claim=await db<{acquired:boolean;claim?:string}>('rpc/icom_bank_whatsapp_provision_claim','POST',{p_owner:b.owner_id});if(!claim.acquired)throw new Error('A conexão já está em preparação. Aguarde e atualize.');
 try{
  const options={method:'POST',headers:{admintoken:token,'Content-Type':'application/json'},body:JSON.stringify({name:botName,adminField01:b.owner_id,adminField02:'icom-bank-whatsapp'}),signal:AbortSignal.timeout(20000),redirect:'error' as const};
  let r=await fetch(UAZAPI_URL+'/instance/create',options);if(r.status===404)r=await fetch(UAZAPI_URL+'/instance/init',{...options,signal:AbortSignal.timeout(20000)});
  if(!r.ok){await db('icom_bank_whatsapp_bot?id=eq.1&claim_id=eq.'+claim.claim,'PATCH',{status:[400,401,403,404,422,429].includes(r.status)?'FALHOU':'INCERTO',updated_at:new Date().toISOString()});throw new Error('Não foi possível confirmar a criação. Confira a chave e o limite de instâncias.');}
  const raw=await r.json() as {instance?:RemoteInstance;token?:string},remote=botOwned({...raw.instance,token:raw.token||raw.instance?.token},b.owner_id);if(!remote)throw new Error('A criação não foi confirmada. Atualize a conexão antes de tentar novamente.');await ready(b,remote);
 }catch(e){await db('icom_bank_whatsapp_bot?id=eq.1&status=eq.CRIANDO&claim_id=eq.'+claim.claim,'PATCH',{status:'INCERTO',updated_at:new Date().toISOString()});throw e instanceof Error&&e.message.startsWith('Não foi')?e:new Error('A criação está em conferência. Atualize antes de tentar novamente.');}
}
export async function connectBot(profile:BankProfile):Promise<Connection>{
 let b=await botConfig();if(profile.role!=='OWNER'||!b||b.owner_id!==profile.user_id)throw new Error('Salve o número do ICOM Bank e os números autorizados primeiro.');
 if(b.status!=='PRONTO'){await provisionBot(b);b=(await botConfig())!;}
 const c=botCredentials(b),origin=process.env.APP_URL;if(!origin||new URL(origin).protocol!=='https:')throw new Error('Endereço seguro do sistema não configurado.');
 // This dedicated instance never modifies seller/global webhooks.
 const hook=await fetch(UAZAPI_URL+'/webhook',{method:'POST',headers:{token:c.token,'Content-Type':'application/json'},body:JSON.stringify({enabled:true,url:new URL('/experiencia-icom/icom-bank/api/whatsapp/webhook?key='+botHook(b),origin).href,events:['messages'],excludeMessages:['wasSentByApi','fromMeYes','isGroupYes'],addUrlEvents:false,addUrlTypesMessages:false}),signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!hook.ok)throw new Error('Não foi possível ativar o recebimento de áudios. Atualize a conexão.');
 const current=await readBotConnection(b);if(current.connected||current.wrongNumber||current.connecting)return current;
 const r=await fetch(UAZAPI_URL+'/instance/connect',{method:'POST',headers:{token:c.token,'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)throw new Error('Não foi possível gerar o QR Code. Atualize a conexão.');
 return connection(await r.json(),b.phone);
}
export async function readBotConnection(b:BotConfig):Promise<Connection>{if(b.status!=='PRONTO')return {configured:false,connected:false,message:'Salve os números e clique em Conectar WhatsApp.'};try{const c=botCredentials(b),r=await fetch(UAZAPI_URL+'/instance/status',{headers:{token:c.token},cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)throw new Error();const status=connection(await r.json(),b.phone);return {...status,message:status.connected?'ICOM Bank conectado. Envie uma despesa por áudio ou texto.':status.wrongNumber?'O número conectado é diferente do número do ICOM Bank. Nenhum lançamento será autorizado.':'Conecte o número do ICOM Bank pelo QR Code.'};}catch{return {configured:true,connected:false,message:'Não consegui consultar a conexão. Clique em Atualizar conexão.'};}}
export async function publicBotSettings(profile:BankProfile){const b=await botConfig();if(b&&b.owner_id!==profile.user_id)throw new Error('Acesso não autorizado.');return {settings:b?{phone:b.phone,allowed_phones:b.allowed_phones,enabled:b.enabled,status:b.status,updated_at:b.updated_at}:null,connection:b?await readBotConnection(b):null,ai_configured:!!process.env.OPENAI_API_KEY};}
