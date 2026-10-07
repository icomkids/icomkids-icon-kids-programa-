import {bankQuery} from './server';
import type {CashCheck,DailyContext,DailyCashData} from './daily-cash';
export async function dailyCashData(token:string,date:string):Promise<DailyCashData>{
 const [context,history]=await Promise.all([
  bankQuery<DailyContext>(token,'rpc/icom_bank_daily_context','POST',{p_day:date}),
  bankQuery<CashCheck[]>(token,`icom_bank_cash_checks?select=*&check_date=gte.${date.slice(0,7)}-01&check_date=lt.${nextMonth(date)}&order=created_at.desc&limit=1000`),
 ]);return {date,context,history};
}
function nextMonth(day:string){const [year,month]=day.split('-').map(Number);return `${month===12?year+1:year}-${String(month===12?1:month+1).padStart(2,'0')}-01`;}
