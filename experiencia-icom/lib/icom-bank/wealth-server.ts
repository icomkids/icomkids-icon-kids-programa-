import {bankAll} from './server';
import type {WealthRecord} from './personal-wealth';
export async function bankWealth(token:string){return await bankAll(token,'icom_bank_personal_wealth?select=*&order=record_date.desc,id.asc') as WealthRecord[];}
