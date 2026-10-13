import {bankAll} from './server';
import type {ProlaboreRecord} from './prolabore';
export async function bankProlabore(token:string){return await bankAll(token,'icom_bank_prolabore?select=*&order=paid_at.desc,id.asc') as ProlaboreRecord[];}
