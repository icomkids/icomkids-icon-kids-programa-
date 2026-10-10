import 'server-only';
import {config} from '@/lib/server';
import {bankAuthorize,bankQuery,bankAll,BankError} from './server';
import type {PlatformData} from './platform';

export async function platformEnabled(token:string){return await bankQuery<boolean>(token,'rpc/ia_bank_platform_access','POST',{}).catch(()=>false);}
export async function platformAuthorize(){const access=await bankAuthorize();if(access.profile.role!=='OWNER'||!await platformEnabled(access.token))throw new BankError('Este controle é exclusivo do proprietário do IA Bank.',403);return access;}
export async function platformQuery<T>(token:string,path:string,method='GET',body?:unknown):Promise<T>{
 const {url,key}=config();const r=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new BankError(r.status===409?'Há um registro com esse identificador. Atualize a lista antes de salvar.':'Não foi possível salvar. Confira os campos e atualize a lista.',r.status===401?401:r.status===403?403:409);
 const t=await r.text();return (t?JSON.parse(t):undefined) as T;
}
export async function platformData(token:string):Promise<PlatformData>{
 const queries=['plans?select=*&order=created_at.desc','subscribers?select=*&order=created_at.desc','charges?select=id,subscriber_id,description,amount_cents,fee_cents,due_date,status,paid_at,received_at,refunded_cents,refunded_at,source,environment,updated_at&order=due_date.desc','costs?select=*&order=due_date.desc'];
 const [plans,subscribers,charges,costs,settings,events,audit]=await Promise.all([...queries.map(p=>bankAll(token,'ia_bank_saas_'+p)),bankQuery<PlatformData['settings'][]>(token,'ia_bank_saas_settings?id=eq.1&select=*'),bankQuery<PlatformData['events']>(token,'ia_bank_saas_events?select=id,provider,environment,kind,processed_at,outcome&order=processed_at.desc&limit=100'),bankQuery<PlatformData['audit']>(token,'ia_bank_saas_audit?select=id,entity,action,created_at&order=created_at.desc&limit=100')]);
 return {plans,subscribers,charges,costs,settings:(settings as PlatformData['settings'][])[0],events,audit,integration:{asaas_ready:!!process.env.IABANK_ASAAS_API_KEY&&!!process.env.IABANK_ASAAS_WEBHOOK_TOKEN}} as PlatformData;
}
