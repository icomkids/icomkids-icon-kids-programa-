import {after} from 'next/server';
import {botConfig,botHook,botCredentials} from '@/lib/icom-bank/whatsapp-bot-server';
import {messageFromWebhook,secureEqual} from '@/lib/icom-bank/whatsapp-expenses';
import {botDb,processExpenses} from '@/lib/icom-bank/whatsapp-expense-worker';
export const runtime='nodejs';export const maxDuration=180;
export async function POST(req:Request){try{
 const b=await botConfig();if(!b?.enabled||b.status!=='PRONTO'||!secureEqual(new URL(req.url).searchParams.get('key'),botHook(b)))return new Response(null,{status:401});
 if(Number(req.headers.get('content-length'))>128000)return new Response(null,{status:413});
 const reader=req.body?.getReader();if(!reader)return new Response(null,{status:400});const parts:Uint8Array[]=[];let size=0;try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>128000)return new Response(null,{status:413});parts.push(next.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const raw=Buffer.concat(parts),body=JSON.parse(raw.toString('utf8')) as Record<string,unknown>;
 if(!secureEqual(body.token,botCredentials(b).token))return new Response(null,{status:401});
 const message=messageFromWebhook(body,b.phone);if(!message||!b.allowed_phones.includes(message.sender))return new Response(null,{status:204});
 const id=await botDb<string|null>('rpc/icom_bank_whatsapp_receive',{p_message:message});
 if(id)after(async()=>{try{await processExpenses();}catch{console.error('ICOM WhatsApp processing pending recovery');}});
 return Response.json({accepted:true},{headers:{'Cache-Control':'no-store'}});
}catch{return new Response(null,{status:503});}}
