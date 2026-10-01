import { authorize, db, errorResponse, log } from '@/lib/server';
import { Experience, resolutions } from '@/lib/experience';
export async function GET() {try {
  const profile=await authorize(); const [rows,settings,users,customers,salespeople,vehicles]=await Promise.all([
    db<Experience[]>('customer_experiences?select=*,customers(*),salespeople(*),vehicles(*),experience_responses(*),experience_alerts(*,experience_alert_events(*))&order=created_at.desc'),
    db('experience_settings?id=eq.1'),db('experience_users?active=eq.true&select=id,name,role'),db('customers?order=name'),db('salespeople?order=name'),db('vehicles?order=name')]);
  if(!profile.leadership_access) rows.forEach(r=>{r.experience_responses.forEach(response=>{Object.keys(response.answers).filter(k=>/manager|owner|leadership/.test(k)).forEach(k=>delete response.answers[k]);});r.experience_alerts.forEach(a=>{a.alert_reason=a.alert_reason.replace(/Nota baixa: (manager_rating|owner_rating)/g,'Avaliação restrita requer atenção');});});
  return Response.json({profile,rows,settings,users,customers,salespeople,vehicles});
}catch(e){return errorResponse(e);}}
export async function POST(req:Request) {try {
  const user=await authorize(); const body=await req.json() as Record<string,unknown>; const action=String(body.action);
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
