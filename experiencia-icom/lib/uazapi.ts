export const UAZAPI_URL='https://logosiabrasilcom.uazapi.com';
export type RemoteInstance={id:string;token:string;name:string;adminField01?:string;adminField02?:string};
export function instanceName(seller:string){return `experiencia-icom-${seller}`}
export function ownedInstance(value:unknown,seller:string):RemoteInstance|null {
 if(!value||typeof value!=='object')return null;
 const row=value as RemoteInstance;
 return typeof row.id==='string'&&!!row.id&&typeof row.token==='string'&&!!row.token&&row.name===instanceName(seller)&&row.adminField01===seller&&row.adminField02==='experiencia-icom'?row:null;
}
export async function listInstances(adminToken:string,transport:typeof fetch=fetch):Promise<unknown[]> {
 const res=await transport(`${UAZAPI_URL}/instance/all`,{headers:{admintoken:adminToken},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw new Error(res.status===401||res.status===403?'A chave não tem acesso administrativo para criar instâncias.':'Não foi possível consultar as instâncias da Uazapi.');
 const rows:unknown=await res.json();if(!Array.isArray(rows))throw new Error('Resposta inesperada da Uazapi.');return rows;
}
export async function createInstance(adminToken:string,seller:string,transport:typeof fetch=fetch):Promise<{instance:RemoteInstance|null;status:'ready'|'failed'|'unknown'}> {
 try {
  const body=JSON.stringify({name:instanceName(seller),adminField01:seller,adminField02:'experiencia-icom'});
  const options={method:'POST',headers:{'Content-Type':'application/json',admintoken:adminToken},body,redirect:'error' as const,signal:AbortSignal.timeout(20000)};
  let res=await transport(`${UAZAPI_URL}/instance/create`,options);
  // Older Uazapi 2.0 uses /instance/init; only a definite 404 permits this fallback.
  if(res.status===404)res=await transport(`${UAZAPI_URL}/instance/init`,{...options,signal:AbortSignal.timeout(20000)});
  if(!res.ok)return {instance:null,status:[400,401,403,404,422,429].includes(res.status)?'failed':'unknown'};
  const value=await res.json() as {instance?:RemoteInstance;token?:string};
  const instance=ownedInstance({...value.instance,token:value.token??value.instance?.token},seller);
  return {instance,status:instance?'ready':'unknown'};
 }catch{return {instance:null,status:'unknown'}}
}
