// Short private read cache. Authorization is checked before every lookup.
export function createAssistantCache(ttl=10000,max=200){
 const entries=new Map<string,{until:number;value:Promise<unknown>}>();
 return {clear(){entries.clear();},async read<T>(key:string,load:()=>Promise<T>,now=Date.now()):Promise<T>{
  for(const [k,e] of entries)if(e.until<=now)entries.delete(k);
  const found=entries.get(key);if(found)return found.value as Promise<T>;
  const value=Promise.resolve().then(load);
  if(entries.size<max){const entry={until:now+ttl,value};entries.set(key,entry);void value.catch(()=>{if(entries.get(key)===entry)entries.delete(key);});}
  return value;
 }};
}
export function sharedAssistantCache(){
 const runtime=globalThis as unknown as {[key:symbol]:ReturnType<typeof createAssistantCache>|undefined};
 return runtime[Symbol.for('icom-bank.assistant-read-cache.v1')]??=createAssistantCache();
}
