import {db} from '@/lib/server';
import {brazilDay} from '@/lib/icom-bank/model';
import {validWebhookToken,normalizeAsaasPayment} from '@/lib/icom-bank/asaas-billing';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function POST(req:Request){
 if(!validWebhookToken(process.env.IABANK_ASAAS_WEBHOOK_TOKEN,req.headers.get('asaas-access-token')))return Response.json({error:'Unauthorized'},{status:401});
 try{
  const raw=await req.text();if(raw.length>120000)return Response.json({error:'Payload too large'},{status:413});
  const event=JSON.parse(raw) as {id?:unknown;event?:unknown;payment?:{id?:unknown}};
  if(typeof event.id!=='string'||!/^[a-zA-Z0-9_&-]{3,150}$/.test(event.id)||typeof event.event!=='string'||!/^PAYMENT_[A-Z_]{2,60}$/.test(event.event)||typeof event.payment?.id!=='string'||!/^[a-zA-Z0-9_-]{3,120}$/.test(event.payment.id))return Response.json({error:'Invalid event'},{status:400});
  const [settings]=await db<{provider:string;environment:string}[]>('ia_bank_saas_settings?id=eq.1&select=provider,environment');
  const key=process.env.IABANK_ASAAS_API_KEY;if(settings?.provider!=='ASAAS'||!key)return Response.json({error:'Integration not configured'},{status:503});
  const base=settings.environment==='SANDBOX'?'https://api-sandbox.asaas.com/v3':'https://api.asaas.com/v3';
  const response=await fetch(base+'/payments/'+encodeURIComponent(event.payment.id),{headers:{access_token:key,'User-Agent':'IA Bank Automotive'},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)return Response.json({error:'Provider verification unavailable'},{status:503});
  const canonical=await response.json() as Record<string,unknown>;const payment=normalizeAsaasPayment(canonical,event.payment.id,brazilDay());
  const result=await db('rpc/ia_bank_saas_apply_asaas','POST',{p_event_id:'ASAAS:'+settings.environment+':'+event.id,p_kind:event.event,p_environment:settings.environment,p_payment:payment});
  return Response.json({ok:true,result},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Payment requires verification; retry later'},{status:503});}
}
