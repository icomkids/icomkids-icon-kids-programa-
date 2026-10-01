import type {Experience} from './experience.ts';
export interface AccessProfile {id:string;name:string;role:'admin'|'manager'|'owner'|'seller';leadership_access:boolean;salesperson_id:string|null}
export function sellerFilter(profile:AccessProfile) {
  if(profile.role!=='seller') return '';
  if(!profile.salesperson_id || !/^[0-9a-f-]{36}$/i.test(profile.salesperson_id)) throw new Error('Acesso não autorizado. Vendedor sem vínculo.');
  return `&salesperson_id=eq.${encodeURIComponent(profile.salesperson_id)}`;
}
export function assertManagement(profile:AccessProfile) {if(profile.role==='seller')throw new Error('Acesso não autorizado. Perfil de consulta.');}
export function scopeRows(profile:AccessProfile,rows:Experience[]) {
  sellerFilter(profile);
  const scoped=profile.role==='seller'?rows.filter(r=>r.salesperson_id===profile.salesperson_id):rows;
  return scoped.map(row=>({...row,experience_responses:row.experience_responses.map(response=>({...response,answers:Object.fromEntries(Object.entries(response.answers).filter(([key])=>profile.role!=='seller'&&profile.leadership_access||!/manager|owner|leadership/.test(key)))})),experience_alerts:profile.role==='seller'?[]:row.experience_alerts.map(alert=>({...alert,alert_reason:profile.leadership_access?alert.alert_reason:alert.alert_reason.replace(/Nota baixa: (manager_rating|owner_rating)/g,'Avaliação restrita requer atenção')}))}));
}
