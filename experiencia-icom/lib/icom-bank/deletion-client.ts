'use client';
import {deletionTarget} from './deletion';
export type DeletionRequest={resolve:(password:string|null)=>void};
export async function bankSafeFetch(url:string,init?:RequestInit):Promise<Response>{
 let body:Record<string,unknown>|undefined;
 if(init?.method&&['POST','PATCH','DELETE'].includes(init.method.toUpperCase())&&typeof init.body==='string'){try{body=JSON.parse(init.body);}catch{}}
 if(body&&deletionTarget(url,body)){
  const password=await new Promise<string|null>(resolve=>window.dispatchEvent(new CustomEvent<DeletionRequest>('ia-bank-confirm-deletion',{detail:{resolve}})));
  if(password===null)throw new Error('Ação cancelada. Nenhum registro foi excluído.');
  return fetch(url,{...init,body:JSON.stringify({...body,deletion_password:password})});
 }
 return fetch(url,init);
}
