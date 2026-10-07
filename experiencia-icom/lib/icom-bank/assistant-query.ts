import {createHash} from 'node:crypto';
import {bankAuthorize,bankAll,bankQuery,bankCashEntries,BankError} from './server';
import {assistantReadInput,readAssistantData} from './assistant-data';
import {sharedAssistantCache} from './assistant-cache';
import {brazilDay} from './model';

const cache=sharedAssistantCache();
export async function authorizeAssistant(req:Request){
 const signal=AbortSignal.any([req.signal,AbortSignal.timeout(6000)]);
 try{return {...await bankAuthorize('dashboard',undefined,signal),signal};}
 catch(e){if(signal.aborted)throw new BankError('A conexão demorou mais que o esperado. Tente novamente.',503);throw e;}
}
type Authorization=Awaited<ReturnType<typeof authorizeAssistant>>;
export async function queryAssistant(auth:Authorization,raw:unknown){
 const {token,profile,signal}=auth,today=brazilDay(),input=assistantReadInput(raw,profile.role,today);
 const key=createHash('sha256').update(token+'\0'+profile.role+'\0'+JSON.stringify(input)+'\0'+today).digest('hex');
 try{return await cache.read(key,()=>readAssistantData({rows:path=>bankAll(token,path,signal),ledger:()=>bankCashEntries(token,signal),staff:()=>bankQuery(token,'rpc/icom_bank_list_staff','POST',{},signal)},raw,profile.role,today));}
 catch(e){if(signal.aborted)throw new BankError('Não consegui consultar os dados a tempo. Tente novamente; nenhum valor foi presumido.',503);throw e;}
}
export async function quickAssistant(auth:Authorization){
 if(auth.profile.role!=='OWNER')return {};
 const topics=['investidores','vendedores','caixa'] as const;
 const values=await Promise.allSettled(topics.map(topic=>queryAssistant(auth,{topic})));
 return Object.fromEntries(topics.map((topic,i)=>[topic,values[i].status==='fulfilled'?values[i].value:{ok:false,error:'Consulta temporariamente indisponível.'}]));
}
