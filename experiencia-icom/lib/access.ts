import type {Experience} from './experience.ts';
import {validToken} from './experience.ts';
import {phoneBR} from './whatsapp.ts';
export interface AccessProfile {id:string;name:string;role:'admin'|'manager'|'owner'|'seller';leadership_access:boolean;salesperson_id:string|null}
export function sellerFilter(profile:AccessProfile) {
  if(profile.role!=='seller') return '';
  if(!profile.salesperson_id || !/^[0-9a-f-]{36}$/i.test(profile.salesperson_id)) throw new Error('Acesso não autorizado. Vendedor sem vínculo.');
  return `&salesperson_id=eq.${encodeURIComponent(profile.salesperson_id)}`;
}
export function assertManagement(profile:AccessProfile) {if(profile.role==='seller')throw new Error('Acesso não autorizado. Perfil de consulta.');}
export function sellerRegistration(profile:AccessProfile,body:Record<string,unknown>) {
  if(profile.role!=='seller')throw new Error('Acesso não autorizado.');
  sellerFilter(profile);
  const name=String(body.customer_name||'').trim(),vehicle=String(body.vehicle_name||'').trim(),plate=String(body.vehicle_plate||'').toUpperCase().replace(/[\s-]/g,''),request=String(body.request_id||'');
  if(name.length<2||name.length>120||vehicle.length<2||vehicle.length>120)throw new Error('Preencha o nome do cliente e o carro (2 a 120 caracteres).');
  if(!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate))throw new Error('Informe uma placa válida, como ABC1D23 ou ABC1234.');
  if(!validToken(request))throw new Error('Solicitação inválida. Atualize a página.');
  return {p_user:profile.id,p_customer:name,p_vehicle:vehicle,p_plate:plate,p_request:request,p_phone:phoneBR(body.customer_phone)};
}
export function scopeRows(profile:AccessProfile,rows:Experience[]) {
  sellerFilter(profile);
  const scoped=profile.role==='seller'?rows.filter(r=>r.salesperson_id===profile.salesperson_id):rows;
  return scoped.map(row=>({...row,experience_responses:row.experience_responses.map(response=>({...response,answers:Object.fromEntries(Object.entries(response.answers).filter(([key])=>profile.role!=='seller'&&profile.leadership_access||!/manager|owner|leadership/.test(key)))})),experience_alerts:profile.role==='seller'?[]:row.experience_alerts.map(alert=>({...alert,alert_reason:profile.leadership_access?alert.alert_reason:alert.alert_reason.replace(/Nota baixa: (manager_rating|owner_rating)/g,'Avaliação restrita requer atenção')}))}));
}
