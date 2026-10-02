import {db} from '@/lib/server';
import {appPath} from '@/lib/paths';
import {connection,sendText} from '@/lib/whatsapp';
import {storedInstance} from '@/lib/whatsapp-instances';
import {dispatchSurveys} from '@/lib/whatsapp-dispatch';
type Reminder={id:string;experience_id:string};
type Dispatch={id:string;salesperson_id:string;token:string;name:string;phone:string};
export async function POST(req:Request){
 const secret=req.headers.get('x-experience-cron');
 if(!secret||secret.length!==64||!await db<boolean>('rpc/experience_reminder_authorize','POST',{p_secret:secret}))return Response.json({error:'Acesso não autorizado.'},{status:401});
 const origin=process.env.APP_URL;if(!origin||new URL(origin).protocol!=='https:')return Response.json({error:'Endereço não configurado.'},{status:503});
 const started=Date.now(),surveys=await dispatchSurveys(started);
 // Interrupted/uncertain sends stay unknown and are never resent automatically.
 await db(`experience_referral_reminders?status=eq.sending&attempted_at=lt.${encodeURIComponent(new Date(Date.now()-10*60000).toISOString())}`,'PATCH',{status:'unknown'});
 await db(`experience_referral_reminders?status=eq.pending&expires_at=lt.${encodeURIComponent(new Date().toISOString())}`,'PATCH',{status:'expired'});
 const jobs=await db<Reminder[]>(`experience_referral_reminders?status=eq.pending&due_at=lte.${encodeURIComponent(new Date().toISOString())}&order=due_at&limit=10`);
 let accepted=0,waiting=0,uncertain=0;
 for(const job of jobs){if(Date.now()-started>90000)break;try{
  const [row]=await db<{salesperson_id:string;token:string}[]>(`customer_experiences?id=eq.${job.experience_id}&select=salesperson_id,token`);
  if(!row){waiting++;continue;}
  const instance=await storedInstance(row.salesperson_id);if(!instance){waiting++;continue;}
  const status=await fetch(`${instance.url}/instance/status`,{headers:{token:instance.token},cache:'no-store',signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!status.ok||!connection(await status.json(),instance.phone).connected){waiting++;continue;}
  const claimed=await db<Dispatch|null>('rpc/experience_referral_claim','POST',{p_id:job.id});if(!claimed)continue;
  if(claimed.salesperson_id!==row.salesperson_id){await db('rpc/experience_referral_result','POST',{p_id:job.id,p_status:'failed',p_provider:null});continue;}
  const url=`${origin.replace(/\/$/,'')}${appPath('/experiencia/')}${claimed.token}?indicacao=1`;
  const result=await sendText(instance,claimed.phone,`Olá, ${claimed.name.trim().split(' ')[0]}! Você nos contou que gostaria de indicar a Icom e autorizou este lembrete. Se desejar, compartilhe um contato autorizado pelo link: ${url}\nVocê também pode cancelar o lembrete nesse link. Obrigado!`);
  await db('rpc/experience_referral_result','POST',{p_id:job.id,p_status:result.status,p_provider:result.providerId??null});
  if(result.status==='accepted')accepted++;else uncertain++;
 }catch{uncertain++;}}
 return Response.json({accepted,waiting,uncertain,surveys});
}
