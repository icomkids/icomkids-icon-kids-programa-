export type InstanceWebhook={id?:string;url:string;enabled?:boolean;events?:string[];excludeMessages?:string[];addUrlEvents?:boolean;addUrlTypesMessages?:boolean};
const filters=['wasSentByApi','fromMeYes','isGroupYes'];
export function ownedWebhookPlan(value:unknown,target:string){
 if(!Array.isArray(value)||value.length>100)throw new Error('Não consegui conferir os destinos do WhatsApp. Nenhum destino foi substituído.');
 const expected=new URL(target);if(expected.protocol!=='https:')throw new Error('Endereço seguro inválido.');
 const hooks=value as InstanceWebhook[],owned=hooks.filter(h=>{try{const url=new URL(h.url);return url.origin===expected.origin&&url.pathname===expected.pathname;}catch{return false;}});
 if(owned.length>1)throw new Error('Há mais de um destino IA Bank. A gestão precisa conferir antes de reconectar.');
 const current=owned[0],payload={enabled:true,url:target,events:['messages'],excludeMessages:filters,addUrlEvents:false,addUrlTypesMessages:false};
 if(current&&current.url===target&&current.enabled===true&&current.events?.includes('messages')&&filters.every(f=>current.excludeMessages?.includes(f))&&!current.addUrlEvents&&!current.addUrlTypesMessages)return null;
 if(current&&(typeof current.id!=='string'||!current.id||current.id.length>200))throw new Error('O destino IA Bank não tem identificação válida. Nenhum outro programa foi alterado.');
 return {...payload,action:current?'update':'add',...(current?{id:current.id}:{})};
}
export async function ensureOwnedWebhook(url:string,token:string,target:string,transport:typeof fetch=fetch){
 const options={headers:{token},cache:'no-store' as const,redirect:'error' as const,signal:AbortSignal.timeout(10000)};
 const r=await transport(url+'/webhook',options);if(!r.ok)throw new Error('Não consegui conferir os destinos do WhatsApp. Tente atualizar a conexão.');
 const mutation=ownedWebhookPlan(await r.json(),target);if(!mutation)return;
 const saved=await transport(url+'/webhook',{method:'POST',headers:{token,'Content-Type':'application/json'},body:JSON.stringify(mutation),redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!saved.ok)throw new Error('Não foi possível ativar o recebimento do IA Bank. Os outros destinos não foram substituídos.');
 const verified=await transport(url+'/webhook',{...options,signal:AbortSignal.timeout(10000)});
 if(!verified.ok||ownedWebhookPlan(await verified.json(),target)!==null)throw new Error('O destino IA Bank aguarda confirmação. Atualize antes de tentar novamente.');
}
