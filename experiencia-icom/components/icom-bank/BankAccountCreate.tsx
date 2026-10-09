 'use client';
import {useId,useRef,useState} from 'react';
import {bankPath,brazilDay} from '@/lib/icom-bank/model';
import {accountBanks,accountInput,type BankAccount} from '@/lib/icom-bank/accounts';

// This editor sits inside financial forms, so it must never create a nested form.
export default function BankAccountCreate({onCreated,onCancel,defaultScope='PESSOAL'}:{onCreated:(account:BankAccount)=>void;onCancel:()=>void;defaultScope?:'LOJA'|'PESSOAL'}){
 const listId=useId(),saving=useRef(false);
 const [draft,setDraft]=useState(()=>({id:crypto.randomUUID(),name:'',bank:'',scope:defaultScope,active:true,initial_cents:0,initial_date:brazilDay(),expected_updated_at:null}));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){
  if(saving.current)return;saving.current=true;setBusy(true);setError('');
  try{
   const payload=accountInput(draft);
   const response=await fetch(bankPath('/api/accounts'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json() as {row?:BankAccount;error?:string};
   if(!response.ok||!data.row)throw new Error(data.error||'Não foi possível cadastrar a conta.');
   onCreated(data.row);
  }catch(e){setError(e instanceof Error?e.message:'Confira os dados da conta.');}finally{saving.current=false;setBusy(false);}
 }
 return <section className="bank-account-create" aria-label="Cadastrar conta sem sair desta tela" data-bank-manual-view="conta_bancaria_form" onKeyDown={e=>{if(e.key==='Enter'&&e.target instanceof HTMLInputElement){e.preventDefault();void save();}}}>
  <h3>Nova conta bancária</h3><p>Cadastre aqui e continue preenchendo. Os dados do patrimônio permanecem nesta tela.</p>
  <fieldset disabled={busy}><div className="bank-form-grid">
   <label>Qual é o banco?<input list={listId} maxLength={100} placeholder="Ex.: Santander, Itaú ou Nubank" value={draft.bank} onChange={e=>setDraft(d=>({...d,bank:e.target.value}))}/><datalist id={listId}>{accountBanks.map(bank=><option key={bank} value={bank}/>)}</datalist></label>
   <label>Como você chama esta conta?<input maxLength={100} placeholder="Ex.: Santander pessoal" value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/><small>Use esse nome para identificar a conta por voz.</small></label>
   <label>De quem é a conta?<select value={draft.scope} onChange={e=>setDraft(d=>({...d,scope:e.target.value as 'LOJA'|'PESSOAL'}))}><option value="PESSOAL">Pessoal</option><option value="LOJA">Loja</option></select></label>
  </div><p className="bank-note">Este cadastro começa com saldo zero e não lança aluguel nem pagamento. Para informar um saldo inicial, use Contas bancárias.</p><div className="bank-actions"><button type="button" onClick={onCancel}>Cancelar cadastro da conta</button><button type="button" className="bank-primary" onClick={()=>void save()}>{busy?'Cadastrando…':'Cadastrar e usar esta conta'}</button></div></fieldset>
  {error&&<p className="bank-error" role="alert">{error}</p>}
 </section>;
}
