 'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {bankPath} from '@/lib/icom-bank/model';
import type {BankAccount,AccountLink} from '@/lib/icom-bank/accounts';
import BankAccountCreate from './BankAccountCreate';

type Props={value:string;onChange:(v:string)=>void;label:string;entryId?:string;disabled?:boolean;required?:boolean;requireAccount?:boolean;hint?:string};
export default function BankAccountSelect({value,onChange,label,entryId,disabled=false,required=true,requireAccount=false,hint}:Props){
 const selectId=useId(),change=useRef(onChange);change.current=onChange;
 const [accounts,setAccounts]=useState<BankAccount[]|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[fixed,setFixed]=useState(''),[creating,setCreating]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{const refresh=()=>setRetry(x=>x+1);window.addEventListener('icom-bank-accounts-changed',refresh);return()=>window.removeEventListener('icom-bank-accounts-changed',refresh);},[]);
 useEffect(()=>{
  let live=true;setAccounts(null);setFixed('');setError('');
  fetch(bankPath('/api/accounts?select=options'),{cache:'no-store'}).then(async r=>{
   const d=await r.json() as {accounts:BankAccount[];links:AccountLink[];error?:string};
   if(!r.ok||!Array.isArray(d.accounts)||!Array.isArray(d.links))throw new Error(d.error||'Não foi possível consultar as contas.');
   if(live){setAccounts(d.accounts);const link=d.links.find(l=>l.ledger_entry_id===entryId);setFixed(link?.account_id||'');if(link)change.current(link.account_id);}
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:'Não foi possível consultar as contas.');});
  return()=>{live=false;};
 },[entryId,retry]);
 const choices=(accounts||[]).filter(a=>a.active||a.id===fixed||a.id===value),loading=accounts===null&&!error;
 const mustChoose=required&&(requireAccount||choices.length>0||loading||!!error);
 function created(account:BankAccount){setAccounts(old=>[account,...(old||[]).filter(a=>a.id!==account.id)]);change.current(account.id);setCreating(false);setNotice('Conta cadastrada e selecionada. Continue preenchendo.');window.dispatchEvent(new Event('icom-bank-accounts-changed'));}
 return <div className="bank-account-select"><label htmlFor={selectId}>{label}</label>
  <select id={selectId} required={mustChoose} disabled={disabled||!!fixed} value={fixed||value} onChange={e=>{setNotice('');change.current(e.target.value);}}>
   <option value="">{loading?'Carregando contas…':error?'Não foi possível carregar as contas':choices.length?'Escolha a conta':requireAccount?'Cadastre uma conta abaixo para continuar':'Sem conta identificada'}</option>
   {choices.map(a=><option key={a.id} value={a.id} disabled={!a.active&&!fixed}>{a.name} · {a.bank} · {a.scope==='LOJA'?'Loja':'Pessoal'}{!a.active?' · Inativa':''}</option>)}
  </select>
  {error&&<><p className="bank-error" role="alert">{error}</p><button type="button" disabled={disabled} onClick={()=>setRetry(x=>x+1)}>Tentar novamente</button></>}
  {!loading&&!error&&!choices.length&&<small>{requireAccount?'Ainda não há contas cadastradas. Você pode criar a primeira aqui, sem sair desta tela.':'Ainda não há contas cadastradas. Você pode cadastrar aqui ou manter este movimento sem conta identificada.'}</small>}
  <small>{hint||'Registro interno do movimento já feito. Não acessa nem movimenta seu banco.'}</small>
  {!disabled&&!fixed&&!creating&&<button type="button" disabled={loading} className="bank-account-add" onClick={()=>{setCreating(true);setNotice('');}}>+ Cadastrar conta aqui</button>}
  {creating&&!disabled&&!fixed&&<BankAccountCreate onCreated={created} onCancel={()=>setCreating(false)}/>}
  {notice&&<p className="bank-note" role="status">{notice}</p>}
 </div>;
}
