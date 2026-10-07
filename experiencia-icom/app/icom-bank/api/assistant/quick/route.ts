import {bankError} from '@/lib/icom-bank/server';
import {authorizeAssistant,quickAssistant} from '@/lib/icom-bank/assistant-query';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){const start=performance.now();try{
 const auth=await authorizeAssistant(req);
 return Response.json({quick:await quickAssistant(auth)},{headers:{'Cache-Control':'private, no-store','Server-Timing':`query;dur=${Math.round(performance.now()-start)}`}});
}catch(e){return bankError(e);}}
