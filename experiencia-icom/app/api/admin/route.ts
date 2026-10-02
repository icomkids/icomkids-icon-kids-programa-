import { authorize, config, db, errorResponse, log } from '@/lib/server';
import { Experience, relationArray, resolutions } from '@/lib/experience';
import {assertManagement,scopeRows,sellerFilter,sellerRegistration} from '@/lib/access';
import {appPath} from '@/lib/paths';
import {warrantySettings} from '@/lib/warranty';
import {sellerConnection,sendSurvey} from '@/lib/whatsapp-server';
import {closingParams} from '@/lib/sales-points';
import {saleDate} from '@/lib/sales-history';
import {scheduledDate} from '@/lib/whatsapp-schedule';
export async function GET() {try {
  const profile=await authorize();
  const raw=await db<Experience[]>('customer_experiences?select=*,customers(*),salespeople(*),vehicles(*),experience_responses(*),experience_alerts(*,experience_alert_events(*)),experience_warranty_sessions(*),experience_referrals(*),experience_referral_reminders(*),experience_sale_closings(*)&order=created_at.desc'+sellerFilter(profile));
  raw.forEach(r=>{r.experience_sale_closings=relationArray(r.experience_sale_closings);r.experience_responses=relationArray(r.experience_responses);r.experience_alerts=relationArray(r.experience_alerts);r.experience_warranty_sessions=relationArray(r.experience_warranty_sessions);r.experience_referrals=relationArray(r.experience_referrals);r.experience_referral_reminders=relationArray(r.experience_referral_reminders)});
  const rows=scopeRows(profile,profile.role==='seller'?raw.filter(r=>r.status!=='arquivada'):raw);
  if(profile.role==='seller') {
    const unique=(key:'customer_id'|'vehicle_id',relation:'customers'|'vehicles')=>[...new Map(rows.map(r=>[r[key],{id:r[key],...r[relation]}])).values()];
    return Response.json({profile,rows,connection:await sellerConnection(profile),settings:[],users:[],accesses:[],customers:unique('customer_id','customers'),salespeople:[{id:profile.salesperson_id,name:profile.name}],vehicles:unique('vehicle_id','vehicles')});
  }
  const [settings,users,customers,salespeople,vehicles,accesses,warranty]=await Promise.all([db('experience_settings?id=eq.1'),db('experience_users?active=eq.true&select=id,name,role'),db('customers?order=name'),db('salespeople?order=name'),db('vehicles?order=name'),['owner','admin'].includes(profile.role)?db('rpc/experience_seller_accesses','POST',{p_actor:profile.id}):Promise.resolve([]),db('experience_warranty_config?id=eq.1')]);
  return Response.json({profile,rows,settings,users,customers,salespeople,vehicles,accesses,warranty});
}catch(e){return errorResponse(e);}}
export async function POST(req:Request) {try {
  const user=await authorize(); const body=await req.json() as Record<string,unknown>; const action=String(body.action);
  if(action==='seller_close'){if(user.role!=='seller')throw new Error('Acesso não autorizado.');await db('rpc/experience_sale_close','POST',{p_actor:user.id,p_experience:String(body.id||''),...closingParams(body)});return Response.json({ok:true,message:'Fechamento registrado.'});}
  if(action==='seller_create') {
    const params=sellerRegistration(user,body);
    const due=scheduledDate(body.scheduled_at);
    const token=await db<string>('rpc/experience_seller_create_sale','POST',{...params,p_due:due,p_purchase:saleDate(body.purchase_date)});
    const [experience]=await db<{id:string;created_at:string;sent_at:string|null;whatsapp_due_at:string|null}[]>(`customer_experiences?token=eq.${encodeURIComponent(token)}${sellerFilter(user)}&select=id,created_at,sent_at,whatsapp_due_at`);
    if(!experience)throw new Error('Não foi possível localizar o atendimento salvo.');
    let delivery;
    try{delivery=experience.whatsapp_due_at&&Date.parse(experience.whatsapp_due_at)>Date.now()?{whatsapp_status:'not_sent',message:'Pesquisa agendada. O sistema enviará pelo seu número no horário escolhido, desde que seu WhatsApp esteja conectado.'}:await sendSurvey(user,experience.id)}catch{delivery={whatsapp_status:'unknown',message:'Cliente salvo. Não foi possível confirmar o envio. Atualize para conferir antes de reenviar.'}}
    return Response.json({token,...experience,...delivery});
  }
  if(action==='seller_connection')return Response.json({connection:await sellerConnection(user,body.connect===true,body.phone)});
  if(action==='seller_whatsapp')return Response.json(await sendSurvey(user,String(body.id||'')));
  if(action==='seller_sent') {
    if(user.role!=='seller')throw new Error('Acesso não autorizado.');
    sellerFilter(user);
    await db('rpc/experience_seller_sent','POST',{p_user:user.id,p_experience:String(body.id||'')});
    return Response.json({ok:true});
  }
  assertManagement(user);
  if(action==='warranty_settings'){const params=warrantySettings(body);await db('rpc/experience_warranty_settings','POST',{p_actor:user.id,...params});return Response.json({ok:true,message:'Orientações de garantia atualizadas. Os registros anteriores foram preservados.'});}
  if(action==='seller_access' || action==='seller_access_status') {
    if(!['owner','admin'].includes(user.role)) throw new Error('Acesso não autorizado.');
    const sellerId=String(body.salesperson_id||'');
    const [seller]=await db<{id:string;name:string}[]>(`salespeople?id=eq.${encodeURIComponent(sellerId)}`);
    if(!seller) throw new Error('Selecione um vendedor válido.');
    let target=String(body.user_id||''); let invited=false; let email=String(body.email||'').trim().toLowerCase();
    if(action==='seller_access') {

      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
      target=await findAuthUser(email);
      if(!target) {
        const {url,key}=config(); const redirect=`${process.env.APP_URL||'https://sistema.icomkids.com.br'}${appPath('/recuperar-senha')}`;
        const res=await fetch(`${url}/auth/v1/invite?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({email})});
        if(!res.ok) throw new Error('Não foi possível enviar o convite. Confira o e-mail e tente novamente.');
        const account=await res.json() as {id:string}; target=account.id; invited=true;
      }
    } else {
      const [existing]=await db<{role:string;access_email:string}[]>(`experience_users?id=eq.${encodeURIComponent(target)}`);
      if(existing?.role!=='seller') throw new Error('Acesso não autorizado.'); email=existing.access_email;
    }
    if(!target) throw new Error('Não foi possível identificar a conta.');
    await db('rpc/experience_set_seller_access','POST',{p_actor:user.id,p_target:target,p_seller:sellerId,p_active:action==='seller_access'||body.active===true,p_email:email});
    return Response.json({ok:true,message:invited?'Convite enviado. O vendedor define a senha pelo e-mail.':'Acesso atualizado. A conta usa a senha já existente.'});
  }
  if(action === 'create') {
    const customerId=String(body.customer_id || ''); const salespersonId=String(body.salesperson_id || ''); const vehicleId=String(body.vehicle_id || '');
    if(!customerId || !salespersonId || !vehicleId || !body.purchase_date || !body.delivery_date) throw new Error('Selecione cliente, veículo, vendedor e datas.');
    const token=await db<string>('rpc/experience_create','POST',{p_customer:customerId,p_seller:salespersonId,p_vehicle:vehicleId,p_purchase:body.purchase_date,p_delivery:body.delivery_date,p_payment:String(body.payment_method||''),p_trade:body.trade_in===true,p_demo:body.is_demo===true,p_user:user.id}); return Response.json({token});
  }
  if(action === 'catalog') {
    const table=String(body.table); if(!['customers','salespeople','vehicles'].includes(table) || !String(body.name || '').trim()) throw new Error('Cadastro inválido.');
    await db(table,'POST',{name:String(body.name).trim(),...(table === 'customers' ? {phone:String(body.phone || ''),customer_type:'novo'} : {})}); await log(user.id,`created_${table}`,table);
  } else if(action === 'settings') {
    if(user.role !== 'owner' && user.role !== 'admin') throw new Error('Acesso não autorizado.');
    const settings=body.settings as Record<string,unknown>; const url=String(settings.google_review_url || '');
    if(url && (!URL.canParse(url) || new URL(url).protocol !== 'https:')) throw new Error('Informe um link HTTPS válido.');
    await db('experience_settings?id=eq.1','PATCH',{company_name:settings.company_name,google_review_url:url,whatsapp_message_template:settings.whatsapp_message_template,survey_active:settings.survey_active === true,intro_text:settings.intro_text,final_text:settings.final_text,estimated_time:settings.estimated_time,updated_at:new Date().toISOString()}); await log(user.id,'settings_updated','1');
  } else if(action === 'alert') {
    if(!resolutions.includes(String(body.status))) throw new Error('Status inválido.');
    await db('rpc/experience_treat_alert','POST',{p_id:body.id,p_user:user.id,p_assigned:body.assigned_to || null,p_status:body.status,p_notes:String(body.notes || '').slice(0,4000)});
  } else if(action === 'manual_alert') {
    await db('rpc/experience_manual_alert','POST',{p_experience:body.id,p_user:user.id,p_reason:String(body.notes || '').slice(0,4000)});
  } else if(action === 'reopen' || action === 'archive' || action === 'sent') {
    await db('rpc/experience_admin_action','POST',{p_experience:body.id,p_user:user.id,p_action:action});
  } else if(action === 'demo') {
    await db('rpc/experience_create_demo','POST',{p_user:user.id});
  } else throw new Error('Ação inválida.');
  return Response.json({ok:true});
}catch(e){return errorResponse(e);}}

async function findAuthUser(email:string):Promise<string> {
 const {url,key}=config();
 for(let page=1;page<=100;page++) {
   const res=await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'});
   if(!res.ok) throw new Error('Não foi possível consultar as contas de acesso.');
   const data=await res.json() as {users:{id:string;email?:string}[]};
   const user=data.users.find(u=>u.email?.toLowerCase()===email);if(user)return user.id;
   if(data.users.length<200)return '';
 }
 throw new Error('A consulta de contas excedeu o limite. Contate a administração.');
}
