 'use client';
import {useEffect,useState} from 'react';
import {bankPath} from '@/lib/icom-bank/model';
import type {BankAccount,AccountLink} from '@/lib/icom-bank/accounts';
export default function BankAccountSelect({value,onChange,label,entryId,disabled=false,required=true}:{value:string;onChange:(v:string)=>void;label:string;entryId?:string;disabled?:boolean;required?:boolean}){
 const [accounts,setAccounts]=useState<BankAccount[]|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[fixed,setFixed]=useState('');
 useEffect(()=>{let live=true;setAccounts(null);setError('');fetch(bankPath('/api/accounts?select=options'),{cache:'no-store'}).then(async r=>{const d=await r.json() as {accounts:BankAccount[];links:AccountLink[];error?:string};if(!r.ok)throw new Error(d.error||'Não foi possível consultar as contas.');if(live){setAccounts(d.accounts);const l=d.links.find(l=>l.ledger_entry_id===entryId);if(l){setFixed(l.account_id);onChange(l.account_id);}}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[entryId,retry]); // callback only sets parent state
 if(error)return <label>{label}<span className="bank-error" role="alert">{error}</span><button type="button" onClick={()=>setRetry(x=>x+1)}>Tentar novamente</button><input required aria-label="Contas indisponíveis" value="" onChange={()=>{}}/></label>;
 if(!accounts)return <label>{label}<select disabled><option>Carregando contas…</option></select><input required value="" aria-label="Aguarde as contas" readOnly/></label>;
 const choices=accounts.filter(a=>a.active||a.id===fixed||a.id===value);
 if(!choices.length)return <p className="bank-note">Ainda não há contas cadastradas. Este movimento ficará em Sem conta identificada. <a href={bankPath('/administrativo/contas-bancarias')}>Cadastrar contas →</a></p>;
 return <label>{label}<select required={required} disabled={disabled||!!fixed} value={fixed||value} onChange={e=>onChange(e.target.value)}><option value="">Escolha a conta</option>{choices.map(a=><option key={a.id} value={a.id}>{a.name} · {a.bank} · {a.scope==='LOJA'?'Loja':'Pessoal'}{!a.active?' · Inativa':''}</option>)}</select><small>Registro interno do movimento já feito. Não acessa nem movimenta seu banco.</small></label>;
}
