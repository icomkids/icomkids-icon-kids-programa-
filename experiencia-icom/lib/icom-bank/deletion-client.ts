'use client';
import {deletionTarget} from './deletion';
export type DeletionRequest={operation?:string;resolve:(password:string|null)=>void};
export async function bankSafeFetch(url:string,init?:RequestInit):Promise<Response>{
 let body:Record<string,unknown>|undefined;
 if(init?.method&&['POST','PATCH','DELETE'].includes(init.method.toUpperCase())&&typeof init.body==='string'){try{body=JSON.parse(init.body);}catch{}}
 const target=body?deletionTarget(url,body):null;
 if(body&&target){
  const password=await new Promise<string|null>(resolve=>window.dispatchEvent(new CustomEvent<DeletionRequest>('ia-bank-confirm-deletion',{detail:{resolve,operation:target.operation}})));
  if(password===null)throw new Error('Ação cancelada. Nenhum lançamento foi alterado.');
  return fetch(url,{...init,body:JSON.stringify({...body,deletion_password:password})});
 }
 return fetch(url,init);
}
