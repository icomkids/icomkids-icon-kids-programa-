import {after} from 'next/server';
import {botConfig} from '@/lib/icom-bank/whatsapp-bot-server';
import {secureEqual} from '@/lib/icom-bank/whatsapp-expenses';
import {processExpenses} from '@/lib/icom-bank/whatsapp-expense-worker';
export const runtime='nodejs';export const maxDuration=180;
export async function POST(req:Request){try{const b=await botConfig();if(!b?.enabled||!secureEqual(req.headers.get('X-ICOM-Worker'),b.worker_secret))return new Response(null,{status:401});after(async()=>{try{await processExpenses();}catch{console.error('ICOM WhatsApp queue pending recovery');}});return Response.json({accepted:true});}catch{return new Response(null,{status:503});}}
