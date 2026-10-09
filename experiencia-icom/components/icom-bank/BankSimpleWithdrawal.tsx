 'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {bankPath,brazilDay,currency} from '@/lib/icom-bank/model';
import {adminMoneyInput,adminMoneyText} from '@/lib/icom-bank/administrative';
import {withdrawalInput} from '@/lib/icom-bank/daily-cash';
import {accountSummary,type AccountData} from '@/lib/icom-bank/accounts';
import BankAccountSelect from './BankAccountSelect';

export default function BankSimpleWithdrawal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>Promise<void>}){
 const [account,setAccount]=useState(''),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[purpose,setPurpose]=useState('PESSOAL'),[date,setDate]=useState(brazilDay()),[method,setMethod]=useState('PIX'),[recipient,setRecipient]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[data,setData]=useState<AccountData|null>(null),[request]=useState(()=>crypto.randomUUID());
 const saving=useRef(false);
 useEffect(()=>{let live=true;const reload=()=>{void fetch(bankPath('/api/accounts'),{cache:'no-store'}).then(async r=>{const d=await r.json() as AccountData;if(r.ok&&live)setData(d);}).catch(()=>{});};reload();window.addEventListener('icom-bank-accounts-changed',reload);window.addEventListener('icom-bank-ledger-changed',reload);return()=>{live=false;window.removeEventListener('icom-bank-accounts-changed',reload);window.removeEventListener('icom-bank-ledger-changed',reload);};},[]);
 let cents=0;try{cents=adminMoneyInput(amount||'0');}catch{}
 const summary=data?accountSummary(data):null,selected=summary?.rows.find(a=>a.id===account);
 const changed=()=>setConfirmed(false);
 async function save(e:FormEvent){e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError('');let saved=false;
  try{const body={action:'withdrawal',id:request,account_id:account,date,amount_cents:adminMoneyInput(amount),reason,recipient:recipient.trim()||'Retirada registrada',purpose,method,confirmed};withdrawalInput(body);
   const response=await fetch(bankPath('/api/daily-cash'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),result=await response.json() as {row?:unknown;error?:string};
   if(!response.ok||!result.row)throw new Error(result.error||'Não foi possível registrar. Confira o histórico antes de repetir.');saved=true;
   window.dispatchEvent(new Event('icom-bank-ledger-changed'));window.dispatchEvent(new Event('icom-bank-wealth-changed'));await onSaved();
  }catch(e){setError(saved?'A retirada foi salva. Atualize os saldos; não registre novamente.':e instanceof Error?e.message:'Confira os dados da retirada.');}finally{saving.current=false;setBusy(false);}
 }
 return <form className="bank-panel bank-simple-withdrawal" data-bank-manual-view="retirada_pessoal_form" onSubmit={save}><div className="bank-panel-title"><h2>Registrar retirada</h2><button type="button" disabled={busy} onClick={onClose}>Fechar</button></div><p>Registre o dinheiro que já saiu da conta. Se a compra ou conta já foi lançada, não registre outra saída.</p><fieldset disabled={busy}><div className="bank-form-grid">
  <BankAccountSelect requireAccount label="1. De qual conta saiu o dinheiro?" value={account} onChange={id=>{changed();setAccount(id);}} hint="Pode ser uma conta pessoal ou da loja. O saldo será descontado somente da conta escolhida."/>
  <label>2. Quanto você retirou? (R$)<input required inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>{changed();setAmount(e.target.value);}} onBlur={()=>{try{setAmount(adminMoneyText(adminMoneyInput(amount)));}catch{}}}/></label>
  <label>3. Qual foi o motivo?<input required minLength={2} maxLength={1200} placeholder="Ex.: compra pessoal ou pagamento da loja" value={reason} onChange={e=>{changed();setReason(e.target.value);}}/></label>
  <label>Essa saída é pessoal ou da loja?<select value={purpose} onChange={e=>{changed();setPurpose(e.target.value);}}><option value="PESSOAL">Pessoal</option><option value="LOJA">Da loja</option></select><small>A finalidade pode ser diferente de quem é dono da conta.</small></label>
 </div>{selected&&<p className="bank-note">Saldo registrado em <strong>{selected.name}: {currency(selected.balance)}</strong>{cents>0&&<> · após esta retirada: <strong>{currency(selected.balance-cents)}</strong></>}.</p>}
 {summary&&cents>summary.available&&<p className="bank-payable-warning">A retirada supera o saldo livre total de {currency(summary.available)}. Confira as reservas dos investidores antes de continuar.</p>}
 <details><summary>Data, forma e destinatário (opcional)</summary><div className="bank-form-grid"><label>Quando saiu?<input required type="date" min="2000-01-01" max={brazilDay()} value={date} onChange={e=>{changed();setDate(e.target.value);}}/></label><label>Como saiu?<select value={method} onChange={e=>{changed();setMethod(e.target.value);}}><option value="PIX">Pix</option><option value="TRANSFERENCIA">Transferência</option><option value="DINHEIRO">Dinheiro</option></select></label><label>Quem recebeu? (opcional)<input maxLength={110} value={recipient} onChange={e=>{changed();setRecipient(e.target.value);}}/></label></div></details>
 <label className="bank-checkbox"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>O dinheiro já saiu e esta saída ainda não está registrada.</label><div className="bank-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="bank-primary" disabled={!confirmed||!account}>{busy?'Salvando…':'Salvar retirada'}</button></div></fieldset>{error&&<p className="bank-error" role="alert">{error}</p>}</form>;
}
