'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {bankPath} from '@/lib/icom-bank/model';
import {defaultPreferences,mergePreferences,readPreferences,type BankPreferences} from '@/lib/icom-bank/preferences';
type Context={preferences:BankPreferences;organizing:boolean;setOrganizing:(value:boolean)=>void;save:(patch:Partial<BankPreferences>)=>Promise<void>;notice:string;loading:boolean};
const PreferenceContext=createContext<Context|null>(null);
export function useBankPreferences(){const value=useContext(PreferenceContext);if(!value)throw new Error('Preferências indisponíveis.');return value;}
export default function BankPreferencesProvider({user,children}:{user:string;children:ReactNode}){
 const [preferences,setPreferences]=useState<BankPreferences>(defaultPreferences),[organizing,setOrganizing]=useState(false),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true);
 const current=useRef(preferences),revision=useRef(0),queue=useRef(Promise.resolve()),storage='ia-bank-preferences:'+user;
 function apply(p:BankPreferences){current.current=p;setPreferences(p);try{localStorage.setItem(storage,JSON.stringify(p));}catch{/* Device storage may be disabled; server still persists. */}}
 useEffect(()=>{let disposed=false;const abort=new AbortController();try{const cached=localStorage.getItem(storage);if(cached){const local=readPreferences(JSON.parse(cached));queueMicrotask(()=>{if(!disposed&&revision.current===0)apply(local);});}}catch{/* Use server defaults. */}
  fetch(bankPath('/api/preferences'),{cache:'no-store',signal:abort.signal}).then(async r=>{if(!r.ok)throw new Error();const data=readPreferences(await r.json());if(!disposed&&revision.current===0)apply(data);}).catch(()=>{if(!disposed)setNotice('Não foi possível carregar sua organização. Tente atualizar a página.');}).finally(()=>{if(!disposed)setLoading(false);});
  return()=>{disposed=true;abort.abort();};
 // Each authenticated user has a separate cache and server record.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[storage]);
 function save(patch:Partial<BankPreferences>){const rev=++revision.current;apply(mergePreferences(current.current,patch));setNotice('Salvando organização…');
  const request=queue.current.catch(()=>{}).then(async()=>{const r=await fetch(bankPath('/api/preferences'),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch),signal:AbortSignal.timeout(12000)});const data=await r.json() as BankPreferences&{error?:string};if(!r.ok)throw new Error(data.error||'Não foi possível salvar.');if(rev===revision.current){apply(readPreferences(data));setNotice('Preferências salvas.');}});
  queue.current=request;return request.catch(e=>{if(rev===revision.current)setNotice('Não foi salvo. '+(e instanceof Error?e.message:'Tente novamente.'));throw e;});
 }
 return <PreferenceContext.Provider value={{preferences,organizing,setOrganizing,save,notice,loading}}>{children}</PreferenceContext.Provider>;
}
