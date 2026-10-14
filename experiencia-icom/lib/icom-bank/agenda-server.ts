import {bankAll,bankQuery} from './server';
import type {AgendaEvent} from './agenda';
import type {Payable} from './payables';
import type {StockRow} from './stock';
export type AgendaData={events:AgendaEvent[];payables:Payable[];stocks:Pick<StockRow,'id'|'active'|'status'>[];notifications:{id:string;notification_day:string;status:string;attempts:number;updated_at:string}[]};
export async function bankAgenda(token:string):Promise<AgendaData>{
 const [events,payables,stocks,notifications]=await Promise.all([
 bankAll(token,'icom_bank_agenda_events?select=*&order=due_date.asc,id.asc'),
 bankAll(token,'icom_bank_payables?active=eq.true&select=id,stock_id,kind,scope,title,amount_cents,due_date,active,status,paid_at,notes,created_at,updated_at&order=due_date.asc,id.asc'),
 bankAll(token,'icom_bank_stock_vehicles?select=id,active,status&order=id.asc'),
 bankQuery(token,'icom_bank_agenda_notifications?select=id,notification_day,status,attempts,updated_at&order=notification_day.desc&limit=5')]);
 return {events:events as AgendaEvent[],payables:payables as Payable[],stocks:stocks as AgendaData['stocks'],notifications:notifications as AgendaData['notifications']};
}
