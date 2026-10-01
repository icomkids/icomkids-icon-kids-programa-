import { headers } from 'next/headers';
export function config() {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw new Error('Banco não configurado.');
  return {url,key};
}
export async function db<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const {url,key} = config();
  const res = await fetch(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body === undefined ? undefined : JSON.stringify(body),cache:'no-store'});
  if(!res.ok) { console.error('Database request failed',res.status,path.split('?')[0]); throw new Error('Não foi possível acessar os dados.'); }
  const text = await res.text(); return text ? JSON.parse(text) as T : undefined as T;
}
export interface Profile {id: string; name: string; role: 'admin' | 'manager' | 'owner'; leadership_access: boolean}
export async function authorize() {
  const {url,key} = config(); const authorization = (await headers()).get('authorization');
  if(!authorization?.startsWith('Bearer ')) throw new Error('Acesso não autorizado.');
  const result = await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:authorization},cache:'no-store'});
  if(!result.ok) throw new Error('Acesso não autorizado.');
  const user = await result.json() as {id: string};
  const [profile] = await db<Profile[]>(`experience_users?id=eq.${encodeURIComponent(user.id)}&active=eq.true`);
  if(!profile) throw new Error('Acesso não autorizado.');
  return profile;
}
export async function log(userId: string, action: string, entity: string) {await db('experience_audit_logs','POST',{user_id:userId,action,entity_id:entity});}
export function errorResponse(error: unknown) {const message = error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.'; return Response.json({error:message},{status:message.includes('não autorizado') ? 403 : message.includes('não configurado') ? 503 : 400});}
