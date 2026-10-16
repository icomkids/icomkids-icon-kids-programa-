'use client';
import {useState} from 'react';
import {appPath} from '@/lib/paths';
import {addendumReceipt,type AddendumReceipt,type SaleAddendum} from '@/lib/sale-addendum';
import SaleAddendumCard from './SaleAddendumCard';
export default function SaleAddendumNotice({token,addendum,readOnly=false,onReceipt}:{token:string;addendum:SaleAddendum;readOnly?:boolean;onReceipt:(receipt:AddendumReceipt)=>void}){
 const [read,setRead]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const receipt=addendumReceipt(addendum);
 async function record(outcome:'agreed'|'questions'){
  if(!read||busy)return;setBusy(true);setError('');
  try{const response=await fetch(appPath(`/api/experience/${token}/addendum`),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({addendum_id:addendum.id,outcome,read:true})});const result=await response.json() as {error?:string;receipt?:AddendumReceipt};if(!response.ok)throw Error(result.error||'Não foi possível registrar.');if(!result.receipt||result.receipt.addendum_id!==addendum.id||!['agreed','questions'].includes(result.receipt.outcome))throw Error('Não foi possível confirmar o registro. Atualize a página para conferir.');onReceipt(result.receipt)}catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar. Tente novamente.')}finally{setBusy(false)}
 }
 return <div className="sale-addendum-notice"><SaleAddendumCard addendum={addendum}/>{!receipt&&!readOnly&&<div className="addendum-confirmation"><p>Confira os valores e as observações antes de confirmar. Se algo estiver diferente do combinado, sinalize suas dúvidas.</p><label className="checkbox"><input type="checkbox" checked={read} onChange={e=>setRead(e.target.checked)} disabled={busy}/> Li os valores e as observações deste adendo.</label><div className="addendum-actions"><button type="button" className="primary" disabled={!read||busy} onClick={()=>record('agreed')}>{busy?'REGISTRANDO…':'OK, ESTOU DE ACORDO'}</button><button type="button" disabled={!read||busy} onClick={()=>record('questions')}>Tenho dúvidas sobre o adendo</button></div>{error&&<p role="alert" className="error">{error}</p>}<small>A confirmação registra sua declaração sobre esta versão. Ela não substitui o contrato de compra e venda e não limita seus direitos.</small></div>}</div>;
}
