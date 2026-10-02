import {db,type Profile} from './server';
import {appPath} from './paths';
import {sellerFilter} from './access';
import {storedInstance,providerStatus,provision} from './whatsapp-instances';
import {connection,sendText,surveyMessage,type Connection,type WhatsappStatus} from './whatsapp';
import type {Experience} from './experience';

export async function sellerConnection(user:Profile,connect=false,phone?:unknown):Promise<Connection> {
 if(user.role!=='seller')throw new Error('Acesso não autorizado.');
 sellerFilter(user);
 if(connect&&!await storedInstance(user.salesperson_id!))await provision(user,phone);
 const config=await storedInstance(user.salesperson_id!);
 if(!config){const provider=await providerStatus();return {configured:false,connected:false,canProvision:provider.configured,message:provider.configured?'Informe seu número e conecte seu WhatsApp pelo QR Code.':'A gestão precisa ativar a integração do WhatsApp em Configurações.'};}
 try {
  if(connect){const current=await fetch(`${config.url}/instance/status`,{headers:{token:config.token},cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});if(current.ok){const state=connection(await current.json(),config.phone);if(state.connected||state.connecting||state.wrongNumber)return state;}}
  const res=await fetch(`${config.url}/instance/${connect?'connect':'status'}`,{method:connect?'POST':'GET',headers:{'Content-Type':'application/json',token:config.token},...(connect?{body:JSON.stringify({})}:{}),cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!res.ok)return {configured:true,connected:false,phone:config.phone,message:'Não foi possível consultar o WhatsApp. Tente atualizar a conexão.'};
  return connection(await res.json(),config.phone);
 }catch{return {configured:true,connected:false,phone:config.phone,message:'Não foi possível consultar o WhatsApp. Tente atualizar a conexão.'}}
}

export async function sendSurvey(user:Profile,id:string):Promise<{whatsapp_status:WhatsappStatus;message:string}> {
 if(user.role!=='seller')throw new Error('Acesso não autorizado.');
 const [row]=await db<Experience[]>(`customer_experiences?id=eq.${encodeURIComponent(id)}${sellerFilter(user)}&select=*,customers(*),vehicles(*),salespeople(*)`);
 if(!row||row.is_demo||row.completed_at||row.status==='arquivada')throw new Error('Atendimento indisponível para envio.');
 if(row.whatsapp_due_at&&Date.parse(row.whatsapp_due_at)>Date.now())return {whatsapp_status:'not_sent',message:'Esta pesquisa está agendada para um horário futuro.'};
 if(row.whatsapp_status==='accepted')return {whatsapp_status:'accepted',message:'Pesquisa já enviada ao WhatsApp. Não foi reenviada.'};
 if(row.whatsapp_status==='sending'||row.whatsapp_status==='unknown')return {whatsapp_status:row.whatsapp_status,message:'O envio está em conferência. Não reenvie para evitar duplicidade.'};
 const config=await storedInstance(user.salesperson_id!);
 if(!config)return {whatsapp_status:'not_sent',message:'Cliente salvo e pesquisa na fila. Conecte seu número em Meu WhatsApp para liberar o envio automático.'};
 const state=await sellerConnection(user);
 if(!state.connected)return {whatsapp_status:'not_sent',message:`Cliente salvo. ${state.message}`};
 const origin=process.env.APP_URL;
 if(!origin||new URL(origin).protocol!=='https:')throw new Error('Endereço da pesquisa não configurado.');
 const claimed=await db<boolean>('rpc/experience_whatsapp_claim','POST',{p_user:user.id,p_experience:id});
 if(!claimed)return {whatsapp_status:'sending',message:'Este envio já está em processamento. Atualize para conferir.'};
 const result=await sendText(config,row.customers.phone,surveyMessage(row.customers.name,`${origin.replace(/\/$/,'')}${appPath('/experiencia/')}${row.token}`));
 await db('rpc/experience_whatsapp_result','POST',{p_user:user.id,p_experience:id,p_status:result.status,p_provider:result.providerId??null});
 return {whatsapp_status:result.status,message:result.status==='accepted'?'Envio aceito pelo WhatsApp. A entrega depende do serviço e da conexão do cliente.':result.status==='failed'?'Cliente salvo, mas o WhatsApp recusou o envio. Você pode tentar novamente.':'Cliente salvo. Não foi possível confirmar o envio. Confira a conversa antes de reenviar.'};
}
