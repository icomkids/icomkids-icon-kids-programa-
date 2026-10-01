import {db,type Profile} from './server';
import {appPath} from './paths';
import {sellerFilter} from './access';
import {connection,sellerInstance,sendText,surveyMessage,type Connection,type WhatsappStatus} from './whatsapp';
import type {Experience} from './experience';

export async function sellerConnection(user:Profile,connect=false):Promise<Connection> {
 if(user.role!=='seller')throw new Error('Acesso não autorizado.');
 sellerFilter(user);
 const config=sellerInstance(user.salesperson_id!,process.env.ICOM_WHATSAPP_SELLERS);
 if(!config)return {configured:false,connected:false,message:'Envio automático aguardando a conexão do seu número pela gestão.'};
 try {
  const res=await fetch(`${config.url}/instance/${connect?'connect':'status'}`,{method:connect?'POST':'GET',headers:{'Content-Type':'application/json',token:config.token},...(connect?{body:JSON.stringify({phone:config.phone})}:{}),cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!res.ok)return {configured:true,connected:false,phone:config.phone,message:'Não foi possível consultar o WhatsApp. Tente atualizar a conexão.'};
  return connection(await res.json(),config.phone);
 }catch{return {configured:true,connected:false,phone:config.phone,message:'Não foi possível consultar o WhatsApp. Tente atualizar a conexão.'}}
}

export async function sendSurvey(user:Profile,id:string):Promise<{whatsapp_status:WhatsappStatus;message:string}> {
 if(user.role!=='seller')throw new Error('Acesso não autorizado.');
 const [row]=await db<Experience[]>(`customer_experiences?id=eq.${encodeURIComponent(id)}${sellerFilter(user)}&select=*,customers(*),vehicles(*),salespeople(*)`);
 if(!row||row.is_demo||row.completed_at||row.status==='arquivada')throw new Error('Atendimento indisponível para envio.');
 if(row.whatsapp_status==='accepted')return {whatsapp_status:'accepted',message:'Pesquisa já enviada ao WhatsApp. Não foi reenviada.'};
 if(row.whatsapp_status==='sending'||row.whatsapp_status==='unknown')return {whatsapp_status:row.whatsapp_status,message:'O envio está em conferência. Não reenvie para evitar duplicidade.'};
 const config=sellerInstance(user.salesperson_id!,process.env.ICOM_WHATSAPP_SELLERS);
 if(!config)return {whatsapp_status:'not_sent',message:'Cliente salvo. Envio automático aguardando a conexão do seu número pela gestão.'};
 const state=await sellerConnection(user);
 if(!state.connected)return {whatsapp_status:'not_sent',message:`Cliente salvo. ${state.message}`};
 const origin=process.env.APP_URL;
 if(!origin||new URL(origin).protocol!=='https:')throw new Error('Endereço da pesquisa não configurado.');
 const claimed=await db<boolean>('rpc/experience_whatsapp_claim','POST',{p_user:user.id,p_experience:id});
 if(!claimed)return {whatsapp_status:'sending',message:'Este envio já está em processamento. Atualize para conferir.'};
 const result=await sendText(config,row.customers.phone,surveyMessage(row.customers.name,`${origin.replace(/\/$/,'')}${appPath('/experiencia/')}${row.token}`));
 await db('rpc/experience_whatsapp_result','POST',{p_user:user.id,p_experience:id,p_status:result.status,p_provider:result.providerId??null});
 return {whatsapp_status:result.status,message:result.status==='accepted'?'Pesquisa enviada ao WhatsApp do cliente.':result.status==='failed'?'Cliente salvo, mas o WhatsApp recusou o envio. Você pode tentar novamente.':'Cliente salvo. Não foi possível confirmar o envio. Confira a conversa antes de reenviar.'};
}
