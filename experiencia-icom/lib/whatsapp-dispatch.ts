import {db,type Profile} from './server';
import {sendSurvey} from './whatsapp-server';
export async function dispatchSurveys(started:number){
 const now=new Date().toISOString();
 await db(`customer_experiences?whatsapp_status=eq.sending&whatsapp_attempted_at=lt.${encodeURIComponent(new Date(Date.now()-10*60000).toISOString())}`,'PATCH',{whatsapp_status:'unknown'});
 await db(`customer_experiences?whatsapp_auto_enabled=eq.true&whatsapp_expires_at=lt.${encodeURIComponent(now)}`,'PATCH',{whatsapp_auto_enabled:false});
 const jobs=await db<{id:string;salesperson_id:string}[]>(`customer_experiences?whatsapp_auto_enabled=eq.true&whatsapp_status=eq.not_sent&whatsapp_due_at=lte.${encodeURIComponent(now)}&whatsapp_expires_at=gt.${encodeURIComponent(now)}&is_demo=eq.false&completed_at=is.null&status=neq.arquivada&order=whatsapp_due_at&limit=5`);
 let accepted=0,waiting=0,unknown=0;
 for(const job of jobs){if(Date.now()-started>55000)break;try{const [seller]=await db<Profile[]>(`experience_users?salesperson_id=eq.${job.salesperson_id}&active=eq.true&role=eq.seller&limit=1`);if(!seller){waiting++;continue;}const result=await sendSurvey(seller,job.id);if(result.whatsapp_status==='accepted')accepted++;else if(result.whatsapp_status==='unknown')unknown++;else waiting++;}catch{waiting++;}}
 return {accepted,waiting,unknown};
}
