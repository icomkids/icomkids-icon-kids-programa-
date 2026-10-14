import {botDb} from './whatsapp-expense-worker';
import {botConfig,botCredentials,readBotConnection} from './whatsapp-bot-server';
import {botAssistantName} from './preferences-server';
import {agendaMorningReply,agendaReminderWindow,type AgendaItem} from './agenda';
import {sendText} from '../whatsapp';
type Reminder={id:string;owner_id:string;recipient:string;claim_id:string;content:{day:string;events:AgendaItem[];bills:AgendaItem[];events_count:number;bills_count:number;bills_total:number}};
export async function processAgendaReminders(){
 if(!agendaReminderWindow())return;
 const b=await botConfig();if(!b?.enabled||b.status!=='PRONTO'||!(await readBotConnection(b)).connected)return;
 const job=await botDb<Reminder|null>('rpc/icom_bank_agenda_notification_claim',{});if(!job)return;
 let status:'ACEITO'|'FALHOU'|'INCERTO'='INCERTO';
 try{const fresh=await botConfig();if(!fresh?.enabled||fresh.status!=='PRONTO'||fresh.owner_id!==job.owner_id||fresh.allowed_phones[0]!==job.recipient){status='FALHOU';return;}
  const name=await botAssistantName(job.owner_id),body='IA Bank · '+name+':\n'+agendaMorningReply(job.content);
  const sent=await sendText(botCredentials(fresh),job.recipient,body);
  status=sent.status==='accepted'?'ACEITO':sent.status==='failed'?'FALHOU':'INCERTO';
 }finally{await botDb('rpc/icom_bank_agenda_notification_finish',{p_id:job.id,p_claim:job.claim_id,p_status:status});}
}
