import {db} from '@/lib/server';
import {bankQuery} from './server';
import {assistantName,defaultPreferences,readPreferences,type BankPreferences} from './preferences';
export async function userPreferences(token:string,user:string):Promise<BankPreferences>{const rows=await bankQuery<unknown[]>(token,'icom_bank_user_preferences?user_id=eq.'+encodeURIComponent(user)+'&select=assistant_name,menu_order,layout_orders','GET',undefined,AbortSignal.timeout(7000));return rows.length?readPreferences(rows[0]):{...defaultPreferences};}
export async function botAssistantName(owner:string){const rows=await db<{assistant_name:string}[]>('icom_bank_user_preferences?user_id=eq.'+encodeURIComponent(owner)+'&select=assistant_name');try{return assistantName(rows[0]?.assistant_name||defaultPreferences.assistant_name);}catch{return defaultPreferences.assistant_name;}}
